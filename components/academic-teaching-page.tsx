"use client";

import { FormEvent, useState } from "react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { User, formatDate } from "@/lib/types";
import { Room } from "@/components/academic-structure-page";
import { Course, Student, useClassPicker } from "@/components/academic-classes-page";
import { Badge, Empty, FormActions, Modal, PageIntro, Panel, Tabs, downloadPdf, number, personName, send, today, useAction, useForm, useLoad } from "@/components/ui-kit";
import { TeacherAttendance } from "@/components/attendance-pages";
import { apiFetch } from "@/lib/api";
import { timetablePdf } from "@/lib/pdf-docs";
import { CourseGradesPage, EvaluationGradesPage } from "@/components/grades-pages";
import { navigateTo, pathForGrades } from "@/lib/routes";

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
  const teachers = useLoad<{ data: Array<{ id: string; nom: string; prenom: string }> }>("/rh/employes?categorie=ENSEIGNANT&statut=ACTIF&limit=200");
  const [teacherId, setTeacherId] = useState("");
  // Emploi du temps de la classe, ou celui d'un enseignant toutes classes confondues.
  const printClass = () => { const name = slots.data?.[0]?.classeNom ?? "classe"; return action.run(() => timetablePdf({ title: "EMPLOI DU TEMPS", subtitle: `Classe ${name}`, fileName: `emploi-du-temps-${name.replace(/\s+/g, "-")}.pdf`, slots: (slots.data ?? []).map((slot) => ({ jour: slot.jour, heureDebut: slot.heureDebut, heureFin: slot.heureFin, lignes: [slot.cours.matiere.nom, slot.cours.enseignant ? personName(slot.cours.enseignant) : "Enseignant non affecté", slot.salle?.nom ?? ""].filter(Boolean) })) })); };
  const printTeacher = () =>
    action.run(async () => {
      const teacher = teachers.data?.data.find((item) => item.id === teacherId);
      if (!teacher) return;
      const own = await apiFetch<Slot[]>(`/academique/emploi-du-temps?enseignantId=${teacherId}`, { skipCache: true });
      await timetablePdf({ title: "EMPLOI DU TEMPS", subtitle: `Enseignant : ${personName(teacher)}`, fileName: `emploi-du-temps-${teacher.nom.replace(/\s+/g, "-")}.pdf`, slots: own.map((slot) => ({ jour: slot.jour, heureDebut: slot.heureDebut, heureFin: slot.heureFin, lignes: [slot.cours.matiere.nom, slot.classeNom, slot.salle?.nom ?? ""].filter(Boolean) })) });
    });
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
      <div className="finance-inline-form">
        {editable && <button className="outline-button small" onClick={() => { action.setError(""); setAdding(true); }}>+ Ajouter un créneau</button>}
        <button className="outline-button small" disabled={action.busy || !slots.data?.length} onClick={() => void printClass()}>Imprimer l&apos;emploi du temps de la classe (PDF)</button>
        <select className="expense-select" aria-label="Enseignant" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
          <option value="">Emploi du temps d&apos;un enseignant…</option>
          {(teachers.data?.data ?? []).map((teacher) => <option key={teacher.id} value={teacher.id}>{personName(teacher)}</option>)}
        </select>
        <button className="outline-button small" disabled={action.busy || !teacherId} onClick={() => void printTeacher()}>Imprimer (PDF)</button>
      </div>
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
  const slots = useLoad<Slot[]>(`/academique/emploi-du-temps?classeId=${classId}`);
  const form = useForm({ coursId: "", date: today(), heureDebut: "08:00", dureeMinutes: "120", contenu: "" });
  // Séance exceptionnelle : un rattrapage tenu en dehors de l'emploi du temps.
  const [exceptional, setExceptional] = useState(false);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const action = useAction();
  // Créneaux de ce cours prévus le jour choisi : une séance normale s'émarge sur l'un d'eux.
  const weekday = form.values.date ? new Date(`${form.values.date}T12:00:00`).getDay() : 0;
  const planned = (slots.data ?? []).filter((slot) => slot.cours.id === form.values.coursId && slot.jour === weekday);
  const minutesOf = (slot: Slot) => { const [h1, m1] = slot.heureDebut.split(":").map(Number); const [h2, m2] = slot.heureFin.split(":").map(Number); return h2 * 60 + m2 - h1 * 60 - m1; };
  const slot = planned.find((item) => item.heureDebut === form.values.heureDebut) ?? planned[0];
  const toggle = (id: string) => setAbsent((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      if (!exceptional && !slot) throw new Error("Ce cours n'a pas de créneau ce jour-là dans l'emploi du temps. Changez la date, ou cochez « Séance exceptionnelle » s'il s'agit d'un rattrapage.");
      const schedule = exceptional || !slot ? { heureDebut: form.values.heureDebut, dureeMinutes: Number(form.values.dureeMinutes) } : { heureDebut: slot.heureDebut, dureeMinutes: minutesOf(slot) };
      await send("/scolarite/seances", "POST", { ...form.values, ...schedule, horsCreneau: exceptional, absents: [...absent].map((inscriptionId) => ({ inscriptionId })) }, true);
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
          {exceptional ? (
            <label>Heure de début<input required type="time" {...form.bind("heureDebut")} /></label>
          ) : (
            <label>Créneau de l&apos;emploi du temps
              <select required value={slot?.heureDebut ?? ""} onChange={(event) => form.setValues({ ...form.values, heureDebut: event.target.value })}>
                {planned.map((item) => <option key={item.id} value={item.heureDebut}>{item.heureDebut} – {item.heureFin}</option>)}
                {!planned.length && <option value="">{form.values.coursId ? "Aucun créneau ce jour-là" : "Choisissez d'abord le cours"}</option>}
              </select>
            </label>
          )}
        </div>
        {exceptional && (
          <label>Durée
            <select {...form.bind("dureeMinutes")}>
              {[60, 90, 120, 150, 180, 240].map((minutes) => <option key={minutes} value={minutes}>{Math.floor(minutes / 60)} h{minutes % 60 ? " 30" : ""}</option>)}
            </select>
          </label>
        )}
        <label className="check-row"><input type="checkbox" checked={exceptional} onChange={(event) => setExceptional(event.target.checked)} /><span>Séance exceptionnelle (rattrapage)<small>À cocher seulement si le cours a eu lieu en dehors de l&apos;emploi du temps. Sinon, la séance s&apos;émarge sur son créneau prévu.</small></span></label>
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
                <td className="logbook-content">{session.contenu === "Cahier de textes à compléter" ? <Badge tone="wait">Émargée · cahier de textes à compléter</Badge> : session.contenu}{session._offline && <small className="local-payment-note">En attente de synchronisation</small>}</td>
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
  type Tab = "emploi" | "cahier" | "emargement";
  const [tab, setTab] = useState<Tab>("emploi");
  const canSign = hasAccess(user, "teaching", "edit") || hasAccess(user, "hr", "edit");
  const classes = useClassPicker(refreshSignal);
  const closed = classes.year?.statut === "CLOTUREE";
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Enseignement" text="L'emploi du temps de chaque classe, et le cahier de textes où chaque séance tenue est déclarée avec son appel.">{classes.picker}</PageIntro>
      {classes.error && <p className="form-error">{classes.error}</p>}
      <Tabs label="Rubrique" value={tab} onChange={setTab} tabs={[["emploi", "Emploi du temps"], ["cahier", "Cahier de textes et appel"], ["emargement", "Émargement des enseignants"]]} />
      {tab === "emargement" ? (
        <TeacherAttendance canEdit={canSign} />
      ) : classes.selected ? (
        <Panel eyebrow={classes.selected.nom} title={tab === "emploi" ? "Semaine type" : "Séances tenues"}>
          {tab === "emploi" && <Timetable key={classes.selected.id} classId={classes.selected.id} canEdit={hasAccess(user, "academics", "edit")} closed={closed} />}
          {tab === "cahier" && <p className="panel-subtitle">Pour compléter une séance déjà émargée, déclarez-la sur le même créneau : son contenu et son appel sont alors enregistrés.</p>}
          {tab === "cahier" && <Logbook key={classes.selected.id} classId={classes.selected.id} canEdit={hasAccess(user, "teaching", "edit")} closed={closed} />}
        </Panel>
      ) : (
        classes.loaded && <Panel title="Aucune classe">Créez d&apos;abord les classes de l&apos;année dans « Classes et étudiants ».</Panel>
      )}
    </div>
  );
}

// ---------- Notes ----------

const EVALUATION_TYPES: Record<string, string> = { CONTROLE: "Contrôle continu", EXAMEN: "Examen", RATTRAPAGE: "Rattrapage" };

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

export function AcademicGradesPage({ user, refreshSignal, courseId, evaluationId }: { user: User | null; refreshSignal: number; courseId: string | null; evaluationId: string | null }) {
  const canEdit = hasAccess(user, "grades", "edit");
  // Une matière et chacune de ses évaluations ont leur propre page.
  if (courseId && evaluationId) return <EvaluationGradesPage key={evaluationId} courseId={courseId} evaluationId={evaluationId} canEdit={canEdit} refreshSignal={refreshSignal} />;
  if (courseId) return <CourseGradesPage key={courseId} courseId={courseId} canEdit={canEdit} refreshSignal={refreshSignal} />;
  return <GradesHome user={user} refreshSignal={refreshSignal} />;
}

function GradesHome({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const classes = useClassPicker(refreshSignal);
  const courses = useLoad<Course[]>(classes.selected ? `/academique/cours?classeId=${classes.selected.id}` : null, refreshSignal);
  const setOpenId = (id: string) => navigateTo(pathForGrades(id));
  const [tab, setTab] = useState<"notes" | "calendrier">("notes");
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Évaluations et notes" text="Créez les évaluations de chaque matière, planifiez les épreuves et saisissez les notes. Un enseignant ne voit que ses propres matières.">{classes.picker}</PageIntro>
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
                    <td><button className="row-action" onClick={() => setOpenId(course.id)}>Ouvrir les notes</button></td>
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
    </div>
  );
}
