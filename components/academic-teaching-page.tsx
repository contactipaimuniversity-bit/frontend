"use client";

import { FormEvent, useState } from "react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { User, formatDate } from "@/lib/types";
import { Room } from "@/components/academic-structure-page";
import { Course, Student, useClassPicker } from "@/components/academic-classes-page";
import { Badge, Empty, FormActions, Modal, PageIntro, Panel, Tabs, downloadPdf, number, personName, send, today, useAction, useForm, useLoad } from "@/components/ui-kit";
import { apiFetch } from "@/lib/api";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
type Slot = { id: string; jour: number; heureDebut: string; heureFin: string; classeNom: string; salle?: Room | null; cours: { id: string; matiere: { nom: string; code: string }; enseignant?: { nom: string; prenom: string } | null } };
type Session = {
  id: string;
  date: string;
  heureDebut: string;
  dureeMinutes: number;
  contenu: string;
  saisieParNom: string;
  enseignant?: { nom: string; prenom: string } | null;
  cours: { id: string; matiere: { nom: string; code: string } };
  absences: Array<{ id: string; justifiee: boolean; motif?: string | null; inscription: { personne: Student } }>;
  /** Séance déclarée sans connexion, pas encore reçue par le serveur. */
  _offline?: boolean;
};
type ClassStudents = { inscriptions: Array<{ id: string; statut: string; personne: Student }> };

function Timetable({ classId, canEdit, closed }: { classId: string; canEdit: boolean; closed: boolean }) {
  const slots = useLoad<Slot[]>(`/academique/emploi-du-temps?classeId=${classId}`);
  const courses = useLoad<Course[]>(canEdit ? `/academique/cours?classeId=${classId}` : null);
  const rooms = useLoad<Room[]>(canEdit ? "/academique/salles" : null);
  const [adding, setAdding] = useState(false);
  const form = useForm({ coursId: "", jour: "1", heureDebut: "08:00", heureFin: "10:00", salleId: "" });
  const action = useAction();
  const editable = canEdit && !closed;
  const add = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/academique/creneaux", "POST", { ...form.values, jour: Number(form.values.jour) });
      setAdding(false);
      slots.reload();
    });
  };
  const remove = async (slot: Slot) => {
    if (!(await askConfirm({ title: `Retirer ${slot.cours.matiere.nom} du ${DAYS[slot.jour - 1].toLowerCase()} ?`, confirmLabel: "Retirer", danger: true }))) return;
    void action.run(async () => { await send(`/academique/creneaux/${slot.id}`, "DELETE"); slots.reload(); });
  };
  return (
    <>
      {editable && <div className="finance-inline-form"><button className="outline-button small" onClick={() => { action.setError(""); setAdding(true); }}>+ Ajouter un créneau</button></div>}
      {(slots.error || (action.error && !adding)) && <p className="form-error">{slots.error || action.error}</p>}
      <div className="timetable">
        {DAYS.map((day, index) => {
          const ofDay = (slots.data ?? []).filter((slot) => slot.jour === index + 1);
          return (
            <div className="timetable-day" key={day}>
              <h4>{day}</h4>
              {ofDay.map((slot) => (
                <article className="timetable-slot" key={slot.id}>
                  <strong>{slot.heureDebut} – {slot.heureFin}</strong>
                  <span>{slot.cours.matiere.nom}</span>
                  <small>{slot.cours.enseignant ? personName(slot.cours.enseignant) : "Enseignant non affecté"}{slot.salle ? ` · ${slot.salle.nom}` : ""}</small>
                  {editable && <button className="row-action danger-row-action" onClick={() => void remove(slot)}>Retirer</button>}
                </article>
              ))}
              {!ofDay.length && <p className="panel-subtitle">—</p>}
            </div>
          );
        })}
      </div>
      {adding && (
        <Modal title="Nouveau créneau hebdomadaire" onClose={() => setAdding(false)}>
          <form className="entity-form" onSubmit={add}>
            <label>Cours
              <select required {...form.bind("coursId")}>
                <option value="">Sélectionner une matière</option>
                {(courses.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.matiere.nom}{course.enseignant ? ` · ${personName(course.enseignant)}` : ""}</option>)}
              </select>
            </label>
            <label>Jour<select {...form.bind("jour")}>{DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
            <div className="form-grid">
              <label>Début<input required type="time" {...form.bind("heureDebut")} /></label>
              <label>Fin<input required type="time" {...form.bind("heureFin")} /></label>
            </div>
            <label>Salle
              <select {...form.bind("salleId")}>
                <option value="">Sans salle</option>
                {(rooms.data ?? []).filter((room) => room.actif).map((room) => <option key={room.id} value={room.id}>{room.nom}{room.capacite ? ` (${room.capacite} places)` : ""}</option>)}
              </select>
            </label>
            <p className="panel-subtitle">Un conflit de classe, d&apos;enseignant ou de salle est refusé avec son explication.</p>
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} label="Ajouter" onCancel={() => setAdding(false)} />
          </form>
        </Modal>
      )}
    </>
  );
}

function SessionForm({ classId, onClose, onSaved }: { classId: string; onClose: () => void; onSaved: () => void }) {
  const courses = useLoad<Course[]>(`/academique/cours?classeId=${classId}`);
  const students = useLoad<ClassStudents>(`/academique/classes/${classId}`);
  const form = useForm({ coursId: "", date: today(), heureDebut: "08:00", dureeMinutes: "120", contenu: "" });
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const action = useAction();
  const toggle = (id: string) => setAbsent((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/scolarite/seances", "POST", { ...form.values, dureeMinutes: Number(form.values.dureeMinutes), absents: [...absent].map((inscriptionId) => ({ inscriptionId })) }, true);
      toast("Séance enregistrée au cahier de textes.");
      onSaved();
      onClose();
    });
  };
  const list = (students.data?.inscriptions ?? []).filter((item) => item.statut !== "ABANDONNEE");
  return (
    <Modal wide title="Déclarer une séance tenue" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>Cours
          <select required {...form.bind("coursId")}>
            <option value="">Sélectionner une matière</option>
            {(courses.data ?? []).map((course) => <option key={course.id} value={course.id} disabled={!course.enseignantId}>{course.matiere.nom}{course.enseignant ? ` · ${personName(course.enseignant)}` : " · aucun enseignant affecté"}</option>)}
          </select>
        </label>
        <div className="form-grid">
          <label>Date<input required type="date" max={today()} {...form.bind("date")} /></label>
          <label>Heure de début<input required type="time" {...form.bind("heureDebut")} /></label>
        </div>
        <label>Durée
          <select {...form.bind("dureeMinutes")}>
            {[60, 90, 120, 150, 180, 240].map((minutes) => <option key={minutes} value={minutes}>{minutes / 60} h{minutes % 60 ? " 30" : ""}</option>)}
          </select>
        </label>
        <label>Contenu enseigné (cahier de textes)<textarea required minLength={5} maxLength={2000} rows={3} placeholder="Chapitre, notions vues, exercices donnés..." {...form.bind("contenu")} /></label>
        <p className="form-section-label">Appel · {absent.size} absent(s) sur {list.length}</p>
        <div className="roll-call">
          {list.map((item) => (
            <label key={item.id} className={absent.has(item.id) ? "absent" : ""}>
              <input type="checkbox" checked={absent.has(item.id)} onChange={() => toggle(item.id)} />
              <span>{personName(item.personne)}</span>
              <small>{absent.has(item.id) ? "Absent" : "Présent"}</small>
            </label>
          ))}
          {!list.length && <p className="panel-subtitle">Aucun étudiant dans cette classe.</p>}
        </div>
        <p className="panel-subtitle">Cochez uniquement les absents. Les heures déclarées servent au suivi du programme et à la paie des vacataires.</p>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} label="Enregistrer la séance" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function Logbook({ classId, canEdit, closed }: { classId: string; canEdit: boolean; closed: boolean }) {
  const sessions = useLoad<Session[]>(`/scolarite/seances?classeId=${classId}`);
  const [declaring, setDeclaring] = useState(false);
  const action = useAction();
  const editable = canEdit && !closed;
  const remove = async (session: Session) => {
    if (!(await askConfirm({ title: "Supprimer cette séance ?", message: "Ses absences et ses heures seront retirées.", confirmLabel: "Supprimer", danger: true }))) return;
    void action.run(async () => { await send(`/scolarite/seances/${session.id}`, "DELETE"); sessions.reload(); });
  };
  const justify = async (absenceId: string, name: string, justified: boolean) => {
    const motif = justified ? null : await askReason({ title: `Justifier l'absence de ${name}`, confirmLabel: "Justifier", reason: { label: "Justificatif présenté", minLength: 3, placeholder: "Certificat médical, convocation..." } });
    if (!justified && !motif) return;
    void action.run(async () => { await send(`/scolarite/absences/${absenceId}`, "PATCH", { justifiee: !justified, motif }); sessions.reload(); });
  };
  const hours = (sessions.data ?? []).reduce((total, session) => total + session.dureeMinutes, 0) / 60;
  return (
    <>
      <div className="finance-inline-form">
        <strong>{sessions.data?.length ?? "--"} séance(s) · {number(hours, 1)} h</strong>
        {editable && <button className="outline-button small" onClick={() => setDeclaring(true)}>+ Déclarer une séance</button>}
      </div>
      {(sessions.error || action.error) && <p className="form-error">{sessions.error || action.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Matière</th><th>Contenu enseigné</th><th>Absents</th><th /></tr></thead>
          <tbody>
            {(sessions.data ?? []).map((session) => (
              <tr key={session.id}>
                <td className="strong-cell">{formatDate(session.date)}<small className="cell-detail">{session.heureDebut} · {number(session.dureeMinutes / 60, 1)} h</small></td>
                <td>{session.cours.matiere.nom}<small className="cell-detail">{session.enseignant ? personName(session.enseignant) : ""}</small></td>
                <td className="logbook-content">{session.contenu}{session._offline && <small className="local-payment-note">En attente de synchronisation</small>}</td>
                <td>
                  {session.absences.length ? session.absences.map((absence) => (
                    <button key={absence.id} className={`absence-chip ${absence.justifiee ? "justified" : ""}`} disabled={!editable || session._offline} title={absence.justifiee ? `Justifiée : ${absence.motif ?? ""} (cliquer pour annuler)` : "Non justifiée (cliquer pour justifier)"} onClick={() => void justify(absence.id, personName(absence.inscription.personne), absence.justifiee)}>
                      {personName(absence.inscription.personne)}{absence.justifiee ? " ✓" : ""}
                    </button>
                  )) : <small className="cell-detail">Aucun</small>}
                </td>
                <td>{editable && !session._offline && <button className="row-action danger-row-action" onClick={() => void remove(session)}>Supprimer</button>}</td>
              </tr>
            ))}
            {!sessions.data?.length && <Empty columns={5}>{sessions.data ? "Aucune séance déclarée pour cette classe." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
      {declaring && <SessionForm classId={classId} onClose={() => setDeclaring(false)} onSaved={sessions.reload} />}
    </>
  );
}

export function AcademicTeachingPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  type Tab = "emploi" | "cahier";
  const [tab, setTab] = useState<Tab>("emploi");
  const classes = useClassPicker(refreshSignal);
  const closed = classes.year?.statut === "CLOTUREE";
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Enseignement" text="L'emploi du temps de chaque classe, et le cahier de textes où chaque séance tenue est déclarée avec son appel.">{classes.picker}</PageIntro>
      {classes.error && <p className="form-error">{classes.error}</p>}
      <Tabs label="Rubrique" value={tab} onChange={setTab} tabs={[["emploi", "Emploi du temps"], ["cahier", "Cahier de textes et appel"]]} />
      {classes.selected ? (
        <Panel eyebrow={classes.selected.nom} title={tab === "emploi" ? "Semaine type" : "Séances tenues"}>
          {tab === "emploi" && <Timetable key={classes.selected.id} classId={classes.selected.id} canEdit={hasAccess(user, "academics", "edit")} closed={closed} />}
          {tab === "cahier" && <Logbook key={classes.selected.id} classId={classes.selected.id} canEdit={hasAccess(user, "teaching", "edit")} closed={closed} />}
        </Panel>
      ) : (
        classes.loaded && <Panel title="Aucune classe">Créez d&apos;abord les classes de l&apos;année dans « Classes et étudiants ».</Panel>
      )}
    </div>
  );
}

// ---------- Notes ----------

type Evaluation = { id: string; type: string; libelle: string; date?: string | null; heureDebut?: string | null; heureFin?: string | null; bareme: string; statut: string; anonyme: boolean; notesSaisies: number; valideParNom?: string | null };
type AnonymousCopies = { evaluation: { id: string; libelle: string; bareme: number }; copies: Array<{ numero: number; valeur: number | null; absent: boolean }> };
type GradeGrid = {
  cours: { id: string; matiere: { nom: string; code: string }; classeNom: string; annee: string; enseignant: string | null };
  verrouille: boolean;
  peutValider: boolean;
  poidsControleContinu: number;
  evaluations: Evaluation[];
  // dispense : l'étudiant a déjà acquis l'unité de cette matière une année précédente.
  etudiants: Array<{ inscriptionId: string; personne: Student; notes: Array<{ evaluationId: string; valeur: number | null; absent: boolean; masquee?: boolean }>; moyenne: number | null; complet: boolean; dispense?: boolean }>;
};
const EMPTY_EVALUATION = { type: "CONTROLE", libelle: "", date: "", heureDebut: "", heureFin: "", salleId: "", surveillant: "", bareme: "20" };
const schedule = (item: { date?: string | null; heureDebut?: string | null; heureFin?: string | null }) =>
  item.date ? `${formatDate(item.date)}${item.heureDebut ? ` · ${item.heureDebut}–${item.heureFin}` : ""}` : "";
const EVALUATION_TYPES: Record<string, string> = { CONTROLE: "Contrôle continu", EXAMEN: "Examen", RATTRAPAGE: "Rattrapage" };

// Saisie des notes d'une évaluation anonyme : le correcteur ne voit que des numéros.
function CopiesModal({ evaluationId, onClose }: { evaluationId: string; onClose: () => void }) {
  const copies = useLoad<AnonymousCopies>(`/notes/evaluations/${evaluationId}/copies`);
  const [draft, setDraft] = useState<Record<number, { valeur: string; absent: boolean }>>({});
  const action = useAction();
  const value = (copy: AnonymousCopies["copies"][number]) => draft[copy.numero] ?? { valeur: copy.valeur === null ? "" : String(copy.valeur), absent: copy.absent };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send(`/notes/evaluations/${evaluationId}/copies`, "PUT", { notes: Object.entries(draft).map(([numero, item]) => ({ numero: Number(numero), valeur: item.absent || item.valeur === "" ? null : item.valeur, absent: item.absent })) }, true);
      toast("Notes enregistrées sous anonymat.");
      onClose();
    });
  };
  return (
    <Modal title={copies.data ? `Copies anonymes · ${copies.data.evaluation.libelle}` : "Copies anonymes"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Reportez la note en face du numéro inscrit sur chaque copie. Les noms n&apos;apparaîtront qu&apos;à la validation par la scolarité.</p>
        {copies.error && <p className="form-error">{copies.error}</p>}
        <div className="copies-list">
          {(copies.data?.copies ?? []).map((copy) => {
            const current = value(copy);
            return (
              <div className="grade-cell" key={copy.numero}>
                <strong>Copie n° {copy.numero}</strong>
                <input type="number" min="0" max={copies.data?.evaluation.bareme} step="0.25" aria-label={`Note de la copie ${copy.numero}`} disabled={current.absent} value={current.absent ? "" : current.valeur} onChange={(event) => setDraft({ ...draft, [copy.numero]: { ...current, valeur: event.target.value } })} />
                <label><input type="checkbox" checked={current.absent} onChange={(event) => setDraft({ ...draft, [copy.numero]: { valeur: "", absent: event.target.checked } })} />copie absente</label>
              </div>
            );
          })}
        </div>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} disabled={!Object.keys(draft).length} label="Enregistrer les notes" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function GradesModal({ courseId, canEdit, onClose }: { courseId: string; canEdit: boolean; onClose: () => void }) {
  const grid = useLoad<GradeGrid>(`/notes/cours/${courseId}`);
  // Saisie en cours : « évaluation:étudiant » → valeur ou absence.
  const [draft, setDraft] = useState<Record<string, { valeur: string; absent: boolean }>>({});
  const [creating, setCreating] = useState(false);
  const [copiesOf, setCopiesOf] = useState<string | null>(null);
  const form = useForm(EMPTY_EVALUATION);
  const rooms = useLoad<Room[]>(creating ? "/academique/salles" : null);
  const action = useAction();
  const data = grid.data;
  const editable = canEdit && !data?.verrouille;
  // Ceux qui ont déjà acquis l'unité n'ont pas de note à recevoir.
  const graded = (data?.etudiants ?? []).filter((student) => !student.dispense).length;
  const cell = (evaluationId: string, inscriptionId: string) => {
    const key = `${evaluationId}:${inscriptionId}`;
    if (draft[key]) return draft[key];
    const note = data?.etudiants.find((item) => item.inscriptionId === inscriptionId)?.notes.find((item) => item.evaluationId === evaluationId);
    return { valeur: note?.valeur === null || note?.valeur === undefined ? "" : String(note.valeur), absent: note?.absent ?? false };
  };
  const edit = (evaluationId: string, inscriptionId: string, patch: Partial<{ valeur: string; absent: boolean }>) =>
    setDraft((current) => ({ ...current, [`${evaluationId}:${inscriptionId}`]: { ...cell(evaluationId, inscriptionId), ...patch } }));
  const dirty = Object.keys(draft).length > 0;
  const apply = (next: GradeGrid) => { grid.setData(next); setDraft({}); };
  const save = () =>
    action.run(async () => {
      let latest: GradeGrid | undefined;
      const evaluationIds = [...new Set(Object.keys(draft).map((key) => key.split(":")[0]))];
      for (const evaluationId of evaluationIds) {
        const notes = Object.entries(draft)
          .filter(([key]) => key.startsWith(`${evaluationId}:`))
          .map(([key, value]) => ({ inscriptionId: key.split(":")[1], valeur: value.absent || value.valeur === "" ? null : value.valeur, absent: value.absent }));
        latest = await send<GradeGrid>(`/notes/evaluations/${evaluationId}/notes`, "PUT", { notes }, true);
      }
      // Hors ligne, les notes attendent sur l'appareil : la grille locale les reprend.
      if (latest && Array.isArray(latest.etudiants)) {
        apply(latest);
        toast("Notes enregistrées.");
      } else {
        setDraft({});
        grid.reload();
      }
      return true;
    });
  const validate = async (evaluation: Evaluation) => {
    if (dirty && !(await save())) return;
    if (!(await askConfirm({ title: `Valider « ${evaluation.libelle} » ?`, message: "Les notes seront verrouillées. Une réouverture devra être motivée.", confirmLabel: "Valider" }))) return;
    void action.run(async () => apply(await send<GradeGrid>(`/notes/evaluations/${evaluation.id}/valider`, "POST", undefined, true)));
  };
  const reopen = async (evaluation: Evaluation) => {
    const motif = await askReason({ title: `Rouvrir « ${evaluation.libelle} »`, confirmLabel: "Rouvrir", reason: { label: "Motif de la réouverture", minLength: 10 } });
    if (!motif) return;
    void action.run(async () => apply(await send<GradeGrid>(`/notes/evaluations/${evaluation.id}/rouvrir`, "POST", { motif }, true)));
  };
  const anonymize = async (evaluation: Evaluation) => {
    if (!(await askConfirm({ title: `Corriger « ${evaluation.libelle} » sous anonymat ?`, message: "Chaque étudiant reçoit un numéro tiré au hasard. Le correcteur ne verra que ces numéros ; les noms réapparaissent à la validation.", confirmLabel: "Rendre anonyme" }))) return;
    void action.run(async () => apply(await send<GradeGrid>(`/notes/evaluations/${evaluation.id}/anonymat`, "POST", undefined, true)));
  };
  // Table numéro → étudiant, à reporter sur les copies avant la correction.
  const anonymityTable = (evaluation: Evaluation) =>
    action.run(async () => {
      const table = await apiFetch<{ lignes: Array<{ numero: number; nom: string; prenom: string; matricule?: string | null }> }>(`/notes/evaluations/${evaluation.id}/correspondance`, { skipCache: true });
      downloadPdf(`anonymat-${evaluation.libelle.replace(/\s+/g, "-")}.pdf`, "Table d'anonymat", evaluation.libelle, [["Numéro d'anonymat", "Nom", "Prénom", "Matricule"], ...table.lignes.map((line) => [line.numero, line.nom, line.prenom, line.matricule])]);
    });
  const remove = async (evaluation: Evaluation) => {
    if (!(await askConfirm({ title: `Supprimer « ${evaluation.libelle} » ?`, message: "Les notes déjà saisies pour cette évaluation seront perdues.", confirmLabel: "Supprimer", danger: true }))) return;
    void action.run(async () => { await send(`/notes/evaluations/${evaluation.id}`, "DELETE", undefined, true); setDraft({}); grid.reload(); });
  };
  const create = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/notes/evaluations", "POST", { ...form.values, coursId: courseId }, true);
      setCreating(false);
      form.setValues(EMPTY_EVALUATION);
      grid.reload();
    });
  };
  return (
    <Modal wide title={data ? `${data.cours.matiere.nom} · ${data.cours.classeNom}` : "Notes"} onClose={onClose}>
      {!data && <p className="empty-state">{grid.error || "Chargement..."}</p>}
      {data && (
        <div className="grades">
          <p className="panel-subtitle">
            {data.cours.enseignant ?? "Aucun enseignant affecté"} · moyenne = contrôle continu × {data.poidsControleContinu} % + examen × {100 - data.poidsControleContinu} %.
            {data.verrouille && " Semestre délibéré : notes définitives."}
          </p>
          {editable && !creating && <div className="finance-inline-form"><button className="outline-button small" onClick={() => { action.setError(""); setCreating(true); }}>+ Nouvelle évaluation</button></div>}
          {creating && (
            <form className="finance-inline-form" onSubmit={create}>
              <select className="expense-select" aria-label="Type" {...form.bind("type")}>{Object.entries(EVALUATION_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <input required minLength={2} placeholder="Intitulé (ex. Devoir n°1)" aria-label="Intitulé" {...form.bind("libelle")} />
              <label>Date<input type="date" {...form.bind("date")} /></label>
              <label>De<input type="time" required={Boolean(form.values.heureFin)} {...form.bind("heureDebut")} /></label>
              <label>à<input type="time" required={Boolean(form.values.heureDebut)} min={form.values.heureDebut || undefined} {...form.bind("heureFin")} /></label>
              <select className="expense-select" aria-label="Salle" {...form.bind("salleId")}>
                <option value="">Sans salle</option>
                {(rooms.data ?? []).filter((room) => room.actif).map((room) => <option key={room.id} value={room.id}>{room.nom}</option>)}
              </select>
              <input maxLength={160} placeholder="Surveillant (facultatif)" aria-label="Surveillant" {...form.bind("surveillant")} />
              <label>Barème<input required type="number" min="1" max="100" style={{ width: 80 }} {...form.bind("bareme")} /></label>
              <button className="outline-button small" disabled={action.busy}>Créer</button>
              <button type="button" className="row-action" onClick={() => setCreating(false)}>Annuler</button>
            </form>
          )}
          {action.error && <p className="form-error">{action.error}</p>}
          <div className="table-wrap">
            <table className="grades-table">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  {data.evaluations.map((evaluation) => (
                    <th key={evaluation.id}>
                      {evaluation.libelle}
                      <small className="cell-detail">{EVALUATION_TYPES[evaluation.type]} · /{Number(evaluation.bareme)}{evaluation.date ? ` · ${schedule(evaluation)}` : ""}</small>
                      <Badge tone={evaluation.statut === "VALIDEE" ? "ok" : "wait"}>{evaluation.statut === "VALIDEE" ? "Validée" : `${evaluation.notesSaisies}/${graded} saisies`}</Badge>
                      {!data.verrouille && (
                        <span className="grades-actions">
                          {data.peutValider && evaluation.statut === "OUVERTE" && <button className="row-action" onClick={() => void validate(evaluation)}>{evaluation.anonyme ? "Valider et lever l'anonymat" : "Valider"}</button>}
                          {data.peutValider && evaluation.statut === "OUVERTE" && !evaluation.anonyme && evaluation.type !== "CONTROLE" && evaluation.notesSaisies === 0 && <button className="row-action" onClick={() => void anonymize(evaluation)}>Rendre anonyme</button>}
                          {evaluation.anonyme && evaluation.statut === "OUVERTE" && canEdit && <button className="row-action" onClick={() => setCopiesOf(evaluation.id)}>Saisir par numéro</button>}
                          {evaluation.anonyme && evaluation.statut === "OUVERTE" && data.peutValider && <button className="row-action" onClick={() => void anonymityTable(evaluation)}>Table d&apos;anonymat</button>}
                          {data.peutValider && evaluation.statut === "VALIDEE" && <button className="row-action" onClick={() => void reopen(evaluation)}>Rouvrir</button>}
                          {canEdit && evaluation.statut === "OUVERTE" && <button className="row-action danger-row-action" onClick={() => void remove(evaluation)}>Supprimer</button>}
                        </span>
                      )}
                    </th>
                  ))}
                  <th>Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {data.etudiants.map((student) => (
                  <tr key={student.inscriptionId}>
                    <td className="strong-cell">{personName(student.personne)}<small className="cell-detail">{student.personne.matricule ?? ""}</small></td>
                    {data.evaluations.map((evaluation) => {
                      const value = cell(evaluation.id, student.inscriptionId);
                      const locked = !editable || evaluation.statut !== "OUVERTE";
                      if (student.dispense) return <td key={evaluation.id}><small className="cell-detail">Unité acquise</small></td>;
                      if (evaluation.anonyme && evaluation.statut === "OUVERTE") return <td key={evaluation.id}><small className="cell-detail">Sous anonymat</small></td>;
                      return (
                        <td key={evaluation.id}>
                          <span className="grade-cell">
                            <input type="number" min="0" max={Number(evaluation.bareme)} step="0.25" aria-label={`Note de ${personName(student.personne)} · ${evaluation.libelle}`} disabled={locked || value.absent} value={value.absent ? "" : value.valeur} onChange={(event) => edit(evaluation.id, student.inscriptionId, { valeur: event.target.value })} />
                            <label title="Absent à l'évaluation (compte zéro)"><input type="checkbox" disabled={locked} checked={value.absent} onChange={(event) => edit(evaluation.id, student.inscriptionId, { absent: event.target.checked, valeur: "" })} />abs.</label>
                          </span>
                        </td>
                      );
                    })}
                    <td>{student.dispense ? <Badge tone="run">Dispensé</Badge> : student.moyenne === null ? <small className="cell-detail">Incomplet</small> : <Badge tone={student.moyenne >= 10 ? "ok" : "bad"}>{number(student.moyenne)}</Badge>}</td>
                  </tr>
                ))}
                {!data.etudiants.length && <Empty columns={data.evaluations.length + 2}>Aucun étudiant dans cette classe.</Empty>}
              </tbody>
            </table>
          </div>
          {!data.evaluations.length && <p className="panel-subtitle">Aucune évaluation : créez un contrôle continu ou l&apos;examen pour commencer la saisie.</p>}
          <div className="form-actions">
            <button className="secondary-button" onClick={onClose}>Fermer</button>
            {editable && <button className="primary-button compact" disabled={!dirty || action.busy} onClick={() => void save()}>{action.busy ? "Enregistrement..." : "Enregistrer les notes"}</button>}
          </div>
        </div>
      )}
      {copiesOf && <CopiesModal evaluationId={copiesOf} onClose={() => { setCopiesOf(null); grid.reload(); }} />}
    </Modal>
  );
}

// ---------- Calendrier des épreuves ----------

type Exam = {
  id: string;
  type: string;
  libelle: string;
  date: string;
  heureDebut: string | null;
  heureFin: string | null;
  statut: string;
  salle: string | null;
  surveillant: string | null;
  matiere: string;
  classeId: string;
  classe: string;
  enseignant: string | null;
  conflits: string[];
  horaireManquant: boolean;
};
type ExamCalendar = { annee: { id: string; libelle: string } | null; sansDate: number; epreuves: Exam[] };

// Date, horaire, salle et surveillant d'une épreuve ; un conflit est refusé avec son explication.
function PlanExam({ exam, onClose, onSaved }: { exam: Exam; onClose: () => void; onSaved: () => void }) {
  const rooms = useLoad<Room[]>("/academique/salles");
  const form = useForm({ date: exam.date.slice(0, 10), heureDebut: exam.heureDebut ?? "", heureFin: exam.heureFin ?? "", salleId: "", surveillant: exam.surveillant ?? "" });
  // La salle actuelle n'est connue que par son nom : on la retrouve dans la liste.
  const roomId = form.values.salleId || (rooms.data ?? []).find((room) => room.nom === exam.salle)?.id || "";
  const action = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send(`/notes/evaluations/${exam.id}`, "PATCH", { ...form.values, salleId: form.values.salleId === "aucune" ? null : roomId || null }, true);
      toast("Épreuve planifiée.");
      onSaved();
      onClose();
    });
  };
  return (
    <Modal title={`Planifier · ${exam.libelle}`} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">{exam.matiere} · {exam.classe}</p>
        <label>Date<input required type="date" {...form.bind("date")} /></label>
        <div className="form-grid">
          <label>Début<input required type="time" {...form.bind("heureDebut")} /></label>
          <label>Fin<input required type="time" min={form.values.heureDebut || undefined} {...form.bind("heureFin")} /></label>
        </div>
        <label>Salle
          <select value={form.values.salleId === "aucune" ? "aucune" : roomId} onChange={(event) => form.setValues({ ...form.values, salleId: event.target.value || "aucune" })}>
            <option value="aucune">Sans salle</option>
            {(rooms.data ?? []).filter((room) => room.actif).map((room) => <option key={room.id} value={room.id}>{room.nom}{room.capacite ? ` (${room.capacite} places)` : ""}</option>)}
          </select>
        </label>
        <label>Surveillant<input maxLength={160} {...form.bind("surveillant")} /></label>
        <p className="panel-subtitle">Deux épreuves ne se chevauchent pas pour une même classe, une même salle ou un même surveillant.</p>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} label="Planifier" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function ExamCalendarPanel({ yearId, classId, className, canEdit, signal }: { yearId?: string; classId?: string; className?: string; canEdit: boolean; signal: number }) {
  const [scope, setScope] = useState<"toutes" | "classe">("toutes");
  const [types, setTypes] = useState("TOUS");
  const calendar = useLoad<ExamCalendar>(`/notes/calendrier${yearId ? `?anneeId=${yearId}` : ""}`, signal);
  const [planning, setPlanning] = useState<Exam | null>(null);
  const exams = (calendar.data?.epreuves ?? []).filter((exam) => (scope === "toutes" || exam.classeId === classId) && (types === "TOUS" || (types === "EXAMENS" ? exam.type !== "CONTROLE" : exam.type === types)));
  const conflicts = exams.filter((exam) => exam.conflits.length > 0);
  const unscheduled = exams.filter((exam) => exam.horaireManquant).length;
  const days = [...new Set(exams.map((exam) => exam.date.slice(0, 10)))];
  const weekday = (date: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date));
  const exportPdf = () =>
    downloadPdf(`calendrier-epreuves-${calendar.data?.annee?.libelle ?? ""}.pdf`, "Calendrier des épreuves", `${calendar.data?.annee?.libelle ?? ""}${scope === "classe" && className ? ` · ${className}` : ""}`, [
      ["Date", "Horaire", "Classe", "Matière", "Épreuve", "Type", "Salle", "Surveillant"],
      ...exams.map((exam) => [formatDate(exam.date), exam.heureDebut ? `${exam.heureDebut} - ${exam.heureFin}` : "", exam.classe, exam.matiere, exam.libelle, EVALUATION_TYPES[exam.type], exam.salle, exam.surveillant]),
    ]);
  return (
    <Panel
      eyebrow={calendar.data?.annee ? `Année ${calendar.data.annee.libelle}` : "Calendrier"}
      title={`${calendar.data ? exams.length : "--"} épreuve(s) datée(s)`}
      subtitle="Toutes les épreuves qui ont une date, dans l'ordre. Une épreuve se planifie à sa création dans la grille de notes, ou ici."
      actions={<button className="outline-button small" disabled={!exams.length} onClick={exportPdf}>Exporter en PDF</button>}
    >
      <div className="finance-inline-form">
        <select className="expense-select" aria-label="Classes" value={scope} onChange={(event) => setScope(event.target.value as "toutes" | "classe")}>
          <option value="toutes">Toutes les classes</option>
          {classId && <option value="classe">{className} seulement</option>}
        </select>
        <select className="expense-select" aria-label="Type d'épreuve" value={types} onChange={(event) => setTypes(event.target.value)}>
          <option value="TOUS">Toutes les épreuves</option>
          <option value="EXAMENS">Examens et rattrapages</option>
          <option value="CONTROLE">Contrôles continus</option>
        </select>
      </div>
      {calendar.error && <p className="form-error">{calendar.error}</p>}
      {(conflicts.length > 0 || unscheduled > 0 || Boolean(calendar.data?.sansDate)) && (
        <div className="expense-alert">
          <span>À vérifier</span>
          <ul>
            {conflicts.map((exam) => <li key={exam.id}>{formatDate(exam.date)} · « {exam.libelle} » ({exam.classe}) : {exam.conflits.join(" ; ")}</li>)}
            {unscheduled > 0 && <li>{unscheduled} épreuve(s) sans horaire : leurs conflits ne peuvent pas être contrôlés.</li>}
            {Boolean(calendar.data?.sansDate) && <li>{calendar.data?.sansDate} évaluation(s) de l&apos;année n&apos;ont pas encore de date et n&apos;apparaissent pas ici.</li>}
          </ul>
        </div>
      )}
      {days.map((day) => (
        <div className="curriculum-semester" key={day}>
          <div className="curriculum-head"><h4>{weekday(day)}</h4></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Horaire</th><th>Classe</th><th>Matière</th><th>Épreuve</th><th>Salle</th><th>Surveillant</th><th /></tr></thead>
              <tbody>
                {exams.filter((exam) => exam.date.slice(0, 10) === day).map((exam) => (
                  <tr key={exam.id}>
                    <td className="strong-cell">{exam.heureDebut ? `${exam.heureDebut} – ${exam.heureFin}` : <Badge tone="wait">À préciser</Badge>}</td>
                    <td>{exam.classe}</td>
                    <td>{exam.matiere}<small className="cell-detail">{exam.enseignant ?? "Aucun enseignant affecté"}</small></td>
                    <td>{exam.libelle}<small className="cell-detail">{EVALUATION_TYPES[exam.type]}</small>{exam.conflits.length > 0 && <Badge tone="bad">Conflit</Badge>}</td>
                    <td>{exam.salle ?? "—"}</td>
                    <td>{exam.surveillant ?? "—"}</td>
                    <td>{canEdit && exam.statut === "OUVERTE" && <button className="row-action" onClick={() => setPlanning(exam)}>Planifier</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {calendar.data && !exams.length && <p className="empty-state">Aucune épreuve datée. Indiquez une date et un horaire en créant une évaluation dans « Saisie des notes ».</p>}
      {!calendar.data && !calendar.error && <p className="empty-state">Chargement...</p>}
      {planning && <PlanExam exam={planning} onClose={() => setPlanning(null)} onSaved={calendar.reload} />}
    </Panel>
  );
}

export function AcademicGradesPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const classes = useClassPicker(refreshSignal);
  const courses = useLoad<Course[]>(classes.selected ? `/academique/cours?classeId=${classes.selected.id}` : null, refreshSignal);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"notes" | "calendrier">("notes");
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Notes" text="Créez les évaluations de chaque matière, planifiez les épreuves et saisissez les notes. Un enseignant ne voit que ses propres matières.">{classes.picker}</PageIntro>
      {(classes.error || courses.error) && <p className="form-error">{classes.error || courses.error}</p>}
      <Tabs label="Rubrique" value={tab} onChange={setTab} tabs={[["notes", "Saisie des notes"], ["calendrier", "Calendrier des épreuves"]]} />
      {tab === "calendrier" ? (
        <ExamCalendarPanel yearId={classes.year?.id} classId={classes.selected?.id} className={classes.selected?.nom} canEdit={hasAccess(user, "grades", "edit")} signal={refreshSignal} />
      ) : classes.selected ? (
        <Panel eyebrow={classes.selected.nom} title={`${courses.data?.length ?? "--"} matière(s)`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Semestre</th><th>Matière</th><th>Enseignant</th><th>Évaluations</th><th /></tr></thead>
              <tbody>
                {(courses.data ?? []).map((course) => (
                  <tr key={course.id}>
                    <td>S{course.matiere.ue.semestre} · {course.matiere.ue.code}</td>
                    <td><button className="dossier-open-button" onClick={() => setOpenId(course.id)}>{course.matiere.nom}</button><small className="cell-detail">Coefficient {Number(course.matiere.coefficient)}</small></td>
                    <td>{course.enseignant ? personName(course.enseignant) : <Badge tone="wait">Non affecté</Badge>}</td>
                    <td>{course._count.evaluations}</td>
                    <td><button className="row-action" onClick={() => setOpenId(course.id)}>Saisir les notes</button></td>
                  </tr>
                ))}
                {!courses.data?.length && <Empty columns={5}>{courses.data ? "Aucune matière à noter pour cette classe." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        classes.loaded && <Panel title="Aucune classe">Créez d&apos;abord les classes de l&apos;année dans « Classes et étudiants ».</Panel>
      )}
      {openId && <GradesModal key={openId} courseId={openId} canEdit={hasAccess(user, "grades", "edit")} onClose={() => { setOpenId(null); courses.reload(); }} />}
    </div>
  );
}
