"use client";

import { FormEvent, useState } from "react";
import { Camera, Check, ChevronRight, ListChecks, UserX, ClipboardList, FileCheck2, HelpCircle, KeyRound, LockKeyhole, PencilLine, Plus, Printer, RotateCcw, ScanLine, Trash2 } from "lucide-react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { apiFetch } from "@/lib/api";
import { AnonymityTable, anonymitySlipsPdf, rosterPdf } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { navigateTo, pathForGrades, pathForHelp, pathForView } from "@/lib/routes";
import { formatDate } from "@/lib/types";
import { Room } from "@/components/academic-structure-page";
import { Student } from "@/components/academic-classes-page";
import { CameraScanner } from "@/components/camera-scanner";
import { Badge, Empty, FormActions, HubBack, Modal, PageIntro, Panel, downloadPdf, number, personName, send, useAction, useForm, useLoad } from "@/components/ui-kit";

type Evaluation = { id: string; type: string; libelle: string; date?: string | null; heureDebut?: string | null; heureFin?: string | null; bareme: string; statut: string; anonyme: boolean; notesSaisies: number; valideParNom?: string | null };
type Copies = { evaluation: { id: string; libelle: string; bareme: number }; copies: Array<{ code: string; valeur: number | null; absent: boolean }> };
type Grid = {
  cours: { id: string; matiere: { nom: string; code: string }; classeNom: string; annee: string; enseignant: string | null };
  verrouille: boolean;
  peutValider: boolean;
  // Scolarité qui ne corrige pas ce cours : elle seule génère et imprime les fiches d'anonymat.
  gereAnonymat?: boolean;
  anonymatObligatoire?: boolean;
  poidsControleContinu: number;
  evaluations: Evaluation[];
  // dispense : l'étudiant a déjà acquis l'unité de cette matière une année précédente.
  etudiants: Array<{ inscriptionId: string; personne: Student; notes: Array<{ evaluationId: string; valeur: number | null; absent: boolean; masquee?: boolean }>; moyenne: number | null; complet: boolean; dispense?: boolean }>;
};
type Draft = Record<string, { valeur: string; absent: boolean }>;

const TYPES: Record<string, string> = { CONTROLE: "Contrôle continu", EXAMEN: "Examen", RATTRAPAGE: "Rattrapage" };
const EMPTY = { type: "CONTROLE", libelle: "", date: "", heureDebut: "", heureFin: "", salleId: "", surveillant: "", bareme: "20" };
const when = (item: Evaluation) => (item.date ? `${formatDate(item.date)}${item.heureDebut ? ` · ${item.heureDebut}–${item.heureFin}` : ""}` : "Date à préciser");

// Où en est une évaluation, et ce qu'il reste à faire : c'est ce que la carte affiche.
function stage(evaluation: Evaluation, grid: Grid, graded: number) {
  if (evaluation.statut === "VALIDEE") return { tone: "ok" as const, label: "Validée", next: `Notes verrouillées${evaluation.valideParNom ? ` par ${evaluation.valideParNom}` : ""}.` };
  const complete = graded > 0 && evaluation.notesSaisies >= graded;
  if (complete) return { tone: "run" as const, label: "À valider", next: "Toutes les notes sont saisies : la scolarité peut valider." };
  if (evaluation.anonyme) return { tone: "wait" as const, label: "Sous anonymat", next: "Imprimez les fiches, puis saisissez les notes par code." };
  if (grid.anonymatObligatoire) return { tone: "wait" as const, label: "Fiches à générer", next: "La scolarité génère les fiches d'anonymat avant l'épreuve." };
  return { tone: "wait" as const, label: "Saisie en cours", next: "Saisissez la note de chaque étudiant." };
}

function Guide({ steps, more }: { steps: Array<{ title: string; detail: string }>; more?: () => void }) {
  return (
    <section className="guide-card" aria-label="Comment ça marche">
      <p className="guide-title"><HelpCircle size={17} aria-hidden="true" /> Comment ça marche</p>
      <ol>
        {steps.map((step, index) => (
          <li key={step.title}><span className="guide-number">{index + 1}</span><span><strong>{step.title}</strong><small>{step.detail}</small></span></li>
        ))}
      </ol>
      {more && <button type="button" className="text-button" onClick={more}>Aide complète de la page <span>→</span></button>}
    </section>
  );
}

// ---------- Page d'une matière : une carte par évaluation ----------

export function CourseGradesPage({ courseId, canEdit, refreshSignal }: { courseId: string; canEdit: boolean; refreshSignal: number }) {
  const grid = useLoad<Grid>(`/notes/cours/${courseId}`, refreshSignal);
  const [creating, setCreating] = useState(false);
  const form = useForm(EMPTY);
  const rooms = useLoad<Room[]>(creating ? "/academique/salles" : null);
  const action = useAction();
  const data = grid.data;
  const editable = canEdit && !data?.verrouille;
  const graded = (data?.etudiants ?? []).filter((student) => !student.dispense).length;
  const create = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const created = await send<{ id: string }>("/notes/evaluations", "POST", { ...form.values, coursId: courseId }, true);
      setCreating(false);
      form.setValues(EMPTY);
      toast("Évaluation créée.");
      navigateTo(pathForGrades(courseId, created.id));
    });
  };
  return (
    <div className="content-scroll">
      <HubBack label="Évaluations et notes" onBack={() => navigateTo(pathForView("Évaluations et notes"))} />
      <PageIntro
        eyebrow={data ? `Évaluations et notes · ${data.cours.classeNom} · ${data.cours.annee}` : "Évaluations et notes"}
        title={data?.cours.matiere.nom ?? "Matière"}
        text={data ? `${data.cours.enseignant ?? "Aucun enseignant affecté"} · moyenne = contrôle continu × ${data.poidsControleContinu} % + examen × ${100 - data.poidsControleContinu} %.${data.verrouille ? " Semestre délibéré : notes définitives." : ""}` : grid.error ? "" : "Chargement..."}
      >
        {editable && <button className="primary-button compact" onClick={() => { action.setError(""); setCreating(true); }}><Plus size={16} aria-hidden="true" /> Nouvelle évaluation</button>}
      </PageIntro>
      {grid.error && <p className="form-error">{grid.error}</p>}
      {data && (
        <>
          <Guide
            more={() => navigateTo(pathForHelp("Évaluations et notes", pathForGrades(courseId)))}
            steps={[
              { title: "Créez l'évaluation", detail: "Contrôle continu, examen ou rattrapage, avec sa date et son barème." },
              { title: "Préparez l'anonymat", detail: "La scolarité génère et imprime les fiches : une par étudiant, avec un code." },
              { title: "Saisissez les notes", detail: "Par code de copie sous anonymat, sinon en face de chaque étudiant." },
              { title: "Faites valider", detail: "La scolarité verrouille les notes ; les noms réapparaissent alors." },
            ]}
          />
          <div className="eval-grid">
            {data.evaluations.map((evaluation) => {
              const state = stage(evaluation, data, graded);
              const percent = graded ? Math.min(100, Math.round((evaluation.notesSaisies / graded) * 100)) : 0;
              return (
                <button type="button" className="eval-card" key={evaluation.id} onClick={() => navigateTo(pathForGrades(courseId, evaluation.id))}>
                  <span className="eval-card-head"><span className="eval-type">{TYPES[evaluation.type]}</span><Badge tone={state.tone}>{state.label}</Badge></span>
                  <strong>{evaluation.libelle}</strong>
                  <small>{when(evaluation)} · noté sur {Number(evaluation.bareme)}</small>
                  <span className="eval-progress" role="img" aria-label={`${evaluation.notesSaisies} note(s) saisie(s) sur ${graded}`}><span style={{ width: `${evaluation.statut === "VALIDEE" ? 100 : percent}%` }} /></span>
                  <small>{evaluation.notesSaisies} / {graded} note(s) saisie(s){evaluation.anonyme ? " · sous anonymat" : ""}</small>
                  <span className="eval-next">{state.next}</span>
                  <span className="eval-open">Ouvrir <ChevronRight size={15} aria-hidden="true" /></span>
                </button>
              );
            })}
            {!data.evaluations.length && (
              <div className="eval-empty">
                <ClipboardList size={26} aria-hidden="true" />
                <strong>Aucune évaluation pour cette matière</strong>
                <small>Commencez par créer un contrôle continu ou l&apos;examen.</small>
                {editable && <button className="primary-button compact" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Nouvelle évaluation</button>}
              </div>
            )}
          </div>
          <Panel eyebrow="Résultats" title="Moyennes de la matière" subtitle="Une note sous anonymat reste masquée jusqu'à la validation de son évaluation.">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Étudiant</th>{data.evaluations.map((evaluation) => <th key={evaluation.id}>{evaluation.libelle}<small className="cell-detail">/{Number(evaluation.bareme)}</small></th>)}<th>Moyenne</th></tr></thead>
                <tbody>
                  {data.etudiants.map((student) => (
                    <tr key={student.inscriptionId}>
                      <td className="strong-cell">{personName(student.personne)}<small className="cell-detail">{student.personne.matricule ?? ""}</small></td>
                      {data.evaluations.map((evaluation) => {
                        const note = student.notes.find((item) => item.evaluationId === evaluation.id);
                        return <td key={evaluation.id}>{student.dispense ? "—" : note?.masquee ? <small className="cell-detail">Sous anonymat</small> : note?.absent ? "Absent" : number(note?.valeur)}</td>;
                      })}
                      <td>{student.dispense ? <Badge tone="run">Dispensé</Badge> : student.moyenne === null ? <small className="cell-detail">Incomplet</small> : <Badge tone={student.moyenne >= 10 ? "ok" : "bad"}>{number(student.moyenne)}</Badge>}</td>
                    </tr>
                  ))}
                  {!data.etudiants.length && <Empty columns={data.evaluations.length + 2}>Aucun étudiant dans cette classe.</Empty>}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      {creating && (
        <Modal title="Nouvelle évaluation" onClose={() => setCreating(false)}>
          <form className="entity-form" onSubmit={create}>
            <div className="form-grid">
              <label>Type<select {...form.bind("type")}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Noté sur<input required type="number" min="1" max="100" {...form.bind("bareme")} /></label>
            </div>
            <label>Intitulé<input required minLength={2} placeholder="Devoir n°1, Examen du semestre 1..." {...form.bind("libelle")} /></label>
            <label>Date de l&apos;épreuve (facultatif)<input type="date" {...form.bind("date")} /></label>
            <div className="form-grid">
              <label>De<input type="time" required={Boolean(form.values.heureFin)} {...form.bind("heureDebut")} /></label>
              <label>à<input type="time" required={Boolean(form.values.heureDebut)} min={form.values.heureDebut || undefined} {...form.bind("heureFin")} /></label>
            </div>
            <div className="form-grid">
              <label>Salle<select {...form.bind("salleId")}><option value="">Sans salle</option>{(rooms.data ?? []).filter((room) => room.actif).map((room) => <option key={room.id} value={room.id}>{room.nom}</option>)}</select></label>
              <label>Surveillant (facultatif)<input maxLength={160} {...form.bind("surveillant")} /></label>
            </div>
            <p className="panel-subtitle">Une matière a un seul examen et un seul rattrapage ; les contrôles continus sont libres. Le rattrapage s&apos;organise après validation de l&apos;examen.</p>
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} label="Créer l'évaluation" onCancel={() => setCreating(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// Liste d'appel d'une épreuve anonyme : la scolarité coche les absents par leur nom.
function RollCallModal({ evaluationId, onClose, onSaved }: { evaluationId: string; onClose: () => void; onSaved: () => void }) {
  type RollCall = { evaluation: string; etudiants: Array<{ inscriptionId: string; nom: string; prenom: string; matricule?: string | null; absent: boolean }> };
  const call = useLoad<RollCall>(`/notes/evaluations/${evaluationId}/absents`);
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const action = useAction();
  const absent = chosen ?? new Set((call.data?.etudiants ?? []).filter((student) => student.absent).map((student) => student.inscriptionId));
  const toggle = (id: string) => { const next = new Set(absent); if (next.has(id)) next.delete(id); else next.add(id); setChosen(next); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send(`/notes/evaluations/${evaluationId}/absents`, "PUT", { inscriptionIds: [...absent] }, true);
      toast(`${absent.size} absent(s) enregistré(s).`);
      onSaved();
    });
  };
  return (
    <Modal title="Absents à l'épreuve" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Cochez les étudiants qui n&apos;ont pas composé, d&apos;après la feuille d&apos;émargement. Le correcteur verra seulement « copie absente » en face de leur code, sans savoir de qui il s&apos;agit.</p>
        {call.error && <p className="form-error">{call.error}</p>}
        <div className="roll-call">
          {(call.data?.etudiants ?? []).map((student) => (
            <label key={student.inscriptionId} className={absent.has(student.inscriptionId) ? "absent" : ""}>
              <input type="checkbox" checked={absent.has(student.inscriptionId)} onChange={() => toggle(student.inscriptionId)} />
              <span>{personName(student)}</span>
              <small>{absent.has(student.inscriptionId) ? "Absent" : "Présent"}</small>
            </label>
          ))}
          {!call.data && !call.error && <p className="panel-subtitle">Chargement...</p>}
        </div>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} label={`Enregistrer ${absent.size} absent(s)`} onCancel={onClose} />
      </form>
    </Modal>
  );
}


// ---------- Page d'une évaluation : étapes, actions et saisie ----------

function Steps({ steps }: { steps: Array<{ label: string; detail: string; state: "done" | "current" | "todo" }> }) {
  return (
    <ol className="steps">
      {steps.map((step, index) => (
        <li key={step.label} className={step.state} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="step-mark">{step.state === "done" ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
          <span><strong>{step.label}</strong><small>{step.detail}</small></span>
        </li>
      ))}
    </ol>
  );
}

export function EvaluationGradesPage({ courseId, evaluationId, canEdit, refreshSignal }: { courseId: string; evaluationId: string; canEdit: boolean; refreshSignal: number }) {
  const grid = useLoad<Grid>(`/notes/cours/${courseId}`, refreshSignal);
  const data = grid.data;
  const evaluation = data?.evaluations.find((item) => item.id === evaluationId);
  const open = evaluation?.statut === "OUVERTE";
  const copies = useLoad<Copies>(evaluation?.anonyme && open ? `/notes/evaluations/${evaluationId}/copies` : null);
  const [draft, setDraft] = useState<Draft>({});
  const [scan, setScan] = useState("");
  const [scanError, setScanError] = useState("");
  const [printed, setPrinted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [rollCall, setRollCall] = useState(false);
  const action = useAction();
  const editable = canEdit && !data?.verrouille && open;
  const students = (data?.etudiants ?? []).filter((student) => !student.dispense);
  const graded = students.length;
  const back = () => navigateTo(pathForGrades(courseId));
  const apply = (next: Grid) => { grid.setData(next); setDraft({}); };
  const dirty = Object.keys(draft).length > 0;

  // Saisie nominative : une ligne par étudiant.
  const named = (inscriptionId: string) => {
    if (draft[inscriptionId]) return draft[inscriptionId];
    const note = data?.etudiants.find((item) => item.inscriptionId === inscriptionId)?.notes.find((item) => item.evaluationId === evaluationId);
    return { valeur: note?.valeur === null || note?.valeur === undefined ? "" : String(note.valeur), absent: note?.absent ?? false };
  };
  // Saisie sous anonymat : une ligne par code de copie.
  const coded = (copy: Copies["copies"][number]) => draft[copy.code] ?? { valeur: copy.valeur === null ? "" : String(copy.valeur), absent: copy.absent };
  const body = (key: "inscriptionId" | "code") => Object.entries(draft).map(([id, item]) => ({ [key]: id, valeur: item.absent || item.valeur === "" ? null : item.valeur, absent: item.absent }));
  const save = () =>
    action.run(async () => {
      if (evaluation?.anonyme) {
        copies.setData(await send<Copies>(`/notes/evaluations/${evaluationId}/copies`, "PUT", { notes: body("code") }, true));
        setDraft({});
        grid.reload();
      } else {
        const next = await send<Grid>(`/notes/evaluations/${evaluationId}/notes`, "PUT", { notes: body("inscriptionId") }, true);
        // Hors ligne, les notes attendent sur l'appareil : la grille locale les reprend.
        if (Array.isArray(next?.etudiants)) apply(next);
        else { setDraft({}); grid.reload(); }
      }
      toast("Notes enregistrées.");
      return true;
    });
  const validate = async () => {
    if (!evaluation) return;
    if (dirty && !(await save())) return;
    if (!(await askConfirm({ title: `Valider « ${evaluation.libelle} » ?`, message: evaluation.anonyme ? "Les notes seront verrouillées et les noms des étudiants réapparaîtront. Une réouverture devra être motivée." : "Les notes seront verrouillées. Une réouverture devra être motivée.", confirmLabel: "Valider" }))) return;
    void action.run(async () => { apply(await send<Grid>(`/notes/evaluations/${evaluationId}/valider`, "POST", undefined, true)); toast("Notes validées."); });
  };
  const reopen = async () => {
    const motif = await askReason({ title: `Rouvrir « ${evaluation?.libelle} »`, message: "Le motif est conservé dans le journal d'audit.", confirmLabel: "Rouvrir", reason: { label: "Motif de la réouverture", minLength: 10 } });
    if (motif) void action.run(async () => apply(await send<Grid>(`/notes/evaluations/${evaluationId}/rouvrir`, "POST", { motif }, true)));
  };
  const anonymize = async () => {
    if (!(await askConfirm({ title: "Corriger cette évaluation sous anonymat ?", message: "Chaque étudiant reçoit un code tiré au hasard, valable pour cette épreuve seulement. Le correcteur ne verra que ces codes ; les noms réapparaissent à la validation.", confirmLabel: "Générer les fiches" }))) return;
    void action.run(async () => { apply(await send<Grid>(`/notes/evaluations/${evaluationId}/anonymat`, "POST", undefined, true)); toast("Fiches d'anonymat générées : imprimez-les."); });
  };
  // Fiches à découper (18 par feuille A4) ou table code → étudiant : la scolarité seule.
  const print = (kind: "fiches" | "table") =>
    action.run(async () => {
      if (!evaluation) return;
      const table = await apiFetch<AnonymityTable>(`/notes/evaluations/${evaluationId}/correspondance`, { skipCache: true });
      const name = `${evaluation.libelle}-${table.classe}`.replace(/\s+/g, "-");
      if (kind === "fiches") await anonymitySlipsPdf(table, `fiches-anonymat-${name}.pdf`);
      else downloadPdf(`table-anonymat-${name}.pdf`, "Table d'anonymat", `${table.matiere} · ${evaluation.libelle} · ${table.classe}`, [["Code d'anonymat", "Nom", "Prénom", "Matricule"], ...table.lignes.map((line) => [line.code, line.nom, line.prenom, line.matricule])]);
      logPrint({ typeDocument: "FICHE_ANONYMAT", mode: "PDF", libelle: `${kind === "fiches" ? "Fiches" : "Table"} d'anonymat · ${table.matiere} · ${evaluation.libelle} · ${table.classe}`, reference: `${table.lignes.length} fiche(s)` });
      setPrinted(true);
    });
  // Feuille que le surveillant fait signer le jour de l'épreuve : aucun code n'y figure.
  const signSheet = () =>
    action.run(async () => {
      if (!data || !evaluation) return;
      await rosterPdf({ title: "FEUILLE D'ÉMARGEMENT", subtitle: `${data.cours.matiere.nom} · ${data.cours.classeNom}`, infos: [`Épreuve : ${evaluation.libelle} (${TYPES[evaluation.type]}) · ${when(evaluation)}`, `Année ${data.cours.annee} · ${students.length} étudiant(s) attendu(s)`, "Surveillant(s) : ______________________________________   Salle : ______________"], columns: [{ label: "N°", width: 10, align: "center" }, { label: "Matricule", width: 28 }, { label: "Nom et prénom", width: 72 }, { label: evaluation.anonyme || data.anonymatObligatoire ? "Fiche remise" : "Présent", width: 22, align: "center" }, { label: "Signature", width: 48 }], rows: students.map((student, index) => [index + 1, student.personne.matricule, personName(student.personne), "", ""]), rowHeight: 9.5, note: "Chaque étudiant présent signe en face de son nom. Les absents sont reportés ensuite dans le système par la scolarité.", fileName: `emargement-${evaluation.libelle}-${data.cours.classeNom}`.replace(/\s+/g, "-") + ".pdf" });
    });
  const remove = async () => {
    if (!(await askConfirm({ title: `Supprimer « ${evaluation?.libelle} » ?`, message: "Les notes déjà saisies pour cette évaluation seront perdues.", confirmLabel: "Supprimer", danger: true }))) return;
    void action.run(async () => { await send(`/notes/evaluations/${evaluationId}`, "DELETE", undefined, true); toast("Évaluation supprimée."); back(); });
  };
  // Le code lu sur la copie (douchette ou clavier) mène droit à sa case de note.
  const locate = (read?: string) => {
    const typed = (read ?? scan).trim().toUpperCase();
    if (!typed) return;
    const code = typed.startsWith("IPAIM-") ? typed : `IPAIM-${typed}`;
    const field = document.getElementById(`copie-${code}`) as HTMLInputElement | null;
    if (!field) { setScanError(`Le code ${code} n'appartient pas à cette épreuve.`); return; }
    setScanError("");
    setScan("");
    field.scrollIntoView({ block: "center" });
    field.focus();
    field.select();
  };

  if (!data || !evaluation)
    return (
      <div className="content-scroll">
        <HubBack label="Retour à la matière" onBack={back} />
        <p className={grid.error || data ? "form-error" : "empty-state"}>{grid.error || (data ? "Cette évaluation n'existe plus." : "Chargement...")}</p>
      </div>
    );

  const done = evaluation.anonyme && copies.data ? copies.data.copies.filter((copy) => { const value = coded(copy); return value.absent || value.valeur !== ""; }).length : students.filter((student) => { const value = named(student.inscriptionId); return value.absent || value.valeur !== ""; }).length;
  const total = evaluation.anonyme && copies.data ? copies.data.copies.length : graded;
  const complete = total > 0 && done >= total;
  const validated = evaluation.statut === "VALIDEE";
  const needsSlips = Boolean(data.anonymatObligatoire) && !evaluation.anonyme && open;
  const canValidate = open && !data.verrouille && (evaluation.anonyme ? Boolean(data.gereAnonymat) : data.peutValider);
  const state = stage(evaluation, data, graded);
  const anonymous = evaluation.anonyme || needsSlips;
  // Tant qu'aucune note n'est saisie, la scolarité peut encore placer l'épreuve sous anonymat.
  const showSlips = open && !evaluation.anonyme && Boolean(data.gereAnonymat) && evaluation.notesSaisies === 0 && !data.verrouille;
  const remaining = Math.max(0, total - done);
  const steps = anonymous
    ? [
        { label: "Générer les fiches", detail: "Scolarité · un code par étudiant", state: evaluation.anonyme ? "done" as const : "current" as const },
        { label: "Imprimer et distribuer", detail: "Scolarité · 18 fiches par feuille A4", state: !evaluation.anonyme ? "todo" as const : validated || printed || done > 0 ? "done" as const : "current" as const },
        { label: "Saisir par code", detail: `Correcteur · ${done} / ${total} copie(s)`, state: !evaluation.anonyme ? "todo" as const : validated || complete ? "done" as const : printed || done > 0 ? "current" as const : "todo" as const },
        { label: "Valider et lever l'anonymat", detail: validated ? `Par ${evaluation.valideParNom ?? "la scolarité"}` : "Scolarité", state: validated ? "done" as const : complete ? "current" as const : "todo" as const },
      ]
    : [
        { label: "Saisir les notes", detail: `Correcteur · ${done} / ${total} étudiant(s)`, state: validated || complete ? "done" as const : "current" as const },
        { label: "Valider", detail: validated ? `Par ${evaluation.valideParNom ?? "la scolarité"}` : "Scolarité", state: validated ? "done" as const : complete ? "current" as const : "todo" as const },
      ];
  return (
    <div className="content-scroll">
      <HubBack label={data.cours.matiere.nom} onBack={back} />
      <PageIntro eyebrow={`${TYPES[evaluation.type]} · ${data.cours.classeNom}`} title={evaluation.libelle} text={`${when(evaluation)} · noté sur ${Number(evaluation.bareme)} · ${data.cours.enseignant ?? "aucun enseignant affecté"}`}>
        <Badge tone={state.tone}>{state.label}</Badge>
      </PageIntro>
      <Steps steps={steps} />
      {(action.error || copies.error) && <p className="form-error">{action.error || copies.error}</p>}
      {open && <div className="action-bar"><button className="outline-button" disabled={action.busy || !students.length} onClick={() => void signSheet()}><ListChecks size={16} aria-hidden="true" /> Feuille d&apos;émargement de l&apos;épreuve (PDF)</button></div>}
      {rollCall && <RollCallModal evaluationId={evaluationId} onClose={() => setRollCall(false)} onSaved={() => { setRollCall(false); setDraft({}); copies.reload(); grid.reload(); }} />}

      {(showSlips || evaluation.anonyme) && data.gereAnonymat && (
        <section className="role-block" aria-label="Fiches d'anonymat">
          <div className="role-head"><span className="role-tag school">Scolarité</span><div><strong>Fiches d&apos;anonymat</strong><small>Réservé à la scolarité. Le professeur de la matière ne voit jamais ce bloc.</small></div></div>
          <div className="action-bar">
            {showSlips && <button className={needsSlips ? "primary-button compact" : "outline-button"} disabled={action.busy} onClick={() => void anonymize()}><KeyRound size={16} aria-hidden="true" /> Générer les fiches d&apos;anonymat</button>}
            {evaluation.anonyme && open && <button className={printed || done > 0 ? "outline-button" : "primary-button compact"} disabled={action.busy} onClick={() => void print("fiches")}><Printer size={16} aria-hidden="true" /> Imprimer les fiches d&apos;anonymat</button>}
            {evaluation.anonyme && <button className="outline-button" disabled={action.busy} onClick={() => void print("table")}><FileCheck2 size={16} aria-hidden="true" /> Table d&apos;anonymat (PDF)</button>}
            {evaluation.anonyme && open && <button className="outline-button" disabled={action.busy} onClick={() => { action.setError(""); setRollCall(true); }}><UserX size={16} aria-hidden="true" /> Absents à l&apos;épreuve</button>}
          </div>
        </section>
      )}

      {needsSlips && (
        <Panel eyebrow="Anonymat obligatoire" title="Les fiches d'anonymat ne sont pas encore générées">
          <p className="panel-subtitle">Aucune note ne peut être saisie au nom d&apos;un étudiant. {data.gereAnonymat ? "Cliquez « Générer les fiches d'anonymat » ci-dessus, puis imprimez-les avant l'épreuve." : "La scolarité doit générer et imprimer les fiches ; vous saisirez ensuite les notes par code."}</p>
        </Panel>
      )}

      {evaluation.anonyme && open && (
        <Panel eyebrow="Correcteur · saisie sous anonymat" title={`${done} / ${total} copie(s) notée(s)`} subtitle="À remplir par le professeur de la matière, ou par un agent habilité à saisir les notes. Reportez la note en face du code collé sur la copie ; une fiche sans copie rendue se coche « copie absente ».">
          <div className="scan-box">
            <ScanLine size={20} aria-hidden="true" />
            <label>Retrouver une copie par son code
              <input placeholder="IPAIM-785B ou 785B" aria-label="Code de la copie" disabled={!editable} value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); locate(); } }} />
            </label>
            <button type="button" className="outline-button" disabled={!editable} onClick={() => locate()}>Trouver la copie</button>
            <button type="button" className="primary-button compact" disabled={!editable} onClick={() => { setScanError(""); setCamera(true); }}><Camera size={16} aria-hidden="true" /> Scanner avec la caméra</button>
            <small>Tapez le code collé sur la copie (les quatre derniers caractères suffisent) puis Entrée, ou scannez son QR code : le curseur se place directement sur la note de cette copie, sans chercher dans la liste.</small>
          </div>
          {camera && <CameraScanner title="Scanner le QR code de la copie" hint="Présentez le QR code de la fiche devant la caméra : la copie est reconnue automatiquement et la fenêtre se ferme." extract={(raw) => raw.trim().toUpperCase().match(/IPAIM-\d{3}[A-Z]/)?.[0] ?? null} onClose={() => setCamera(false)} onCode={(code) => { setCamera(false); locate(code); }} />}
          {scanError && <p className="form-error">{scanError}</p>}
          <div className="copy-grid">
            {(copies.data?.copies ?? []).map((copy) => {
              const value = coded(copy);
              return (
                <div className={`copy-cell ${value.absent || value.valeur !== "" ? "filled" : ""}`} key={copy.code}>
                  <strong>{copy.code}</strong>
                  <input id={`copie-${copy.code}`} type="number" min="0" max={Number(evaluation.bareme)} step="0.25" placeholder={`/${Number(evaluation.bareme)}`} aria-label={`Note de la copie ${copy.code}`} disabled={!editable || value.absent} value={value.absent ? "" : value.valeur} onChange={(event) => setDraft({ ...draft, [copy.code]: { ...value, valeur: event.target.value } })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); (document.querySelector('[aria-label="Code de la copie"]') as HTMLInputElement | null)?.focus(); } }} />
                  <label><input type="checkbox" disabled={!editable} checked={value.absent} onChange={(event) => setDraft({ ...draft, [copy.code]: { valeur: "", absent: event.target.checked } })} />copie absente</label>
                </div>
              );
            })}
          </div>
          {!copies.data && !copies.error && <p className="empty-state">Chargement des copies...</p>}
          {editable && <div className="form-actions"><button className="primary-button compact" disabled={!dirty || action.busy} onClick={() => void save()}><PencilLine size={16} aria-hidden="true" /> {action.busy ? "Enregistrement..." : "Enregistrer les notes"}</button></div>}
        </Panel>
      )}

      {!evaluation.anonyme && !needsSlips && (
        <Panel eyebrow={validated ? "Notes validées" : "Correcteur · saisie des notes"} title={`${done} / ${total} étudiant(s) noté(s)`} subtitle={validated ? "Ces notes sont verrouillées. Pour corriger une erreur, la scolarité rouvre l'évaluation avec un motif." : "À remplir par le professeur de la matière, ou par un agent habilité à saisir les notes. « Absent » compte zéro."}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Étudiant</th><th>Note sur {Number(evaluation.bareme)}</th><th>Absent</th></tr></thead>
              <tbody>
                {data.etudiants.map((student) => {
                  const value = named(student.inscriptionId);
                  return (
                    <tr key={student.inscriptionId}>
                      <td className="strong-cell">{personName(student.personne)}<small className="cell-detail">{student.personne.matricule ?? ""}</small></td>
                      {student.dispense ? <td colSpan={2}><small className="cell-detail">Unité déjà acquise : pas de note à saisir</small></td> : (
                        <>
                          <td><span className="grade-cell"><input type="number" min="0" max={Number(evaluation.bareme)} step="0.25" aria-label={`Note de ${personName(student.personne)}`} disabled={!editable || value.absent} value={value.absent ? "" : value.valeur} onChange={(event) => setDraft({ ...draft, [student.inscriptionId]: { ...value, valeur: event.target.value } })} /></span></td>
                          <td><span className="grade-cell"><label><input type="checkbox" aria-label={`${personName(student.personne)} absent`} disabled={!editable} checked={value.absent} onChange={(event) => setDraft({ ...draft, [student.inscriptionId]: { valeur: "", absent: event.target.checked } })} />absent</label></span></td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {!data.etudiants.length && <Empty columns={3}>Aucun étudiant dans cette classe.</Empty>}
              </tbody>
            </table>
          </div>
          {editable && <div className="form-actions"><button className="primary-button compact" disabled={!dirty || action.busy} onClick={() => void save()}><PencilLine size={16} aria-hidden="true" /> {action.busy ? "Enregistrement..." : "Enregistrer les notes"}</button></div>}
        </Panel>
      )}

      {evaluation.anonyme && validated && (
        <Panel eyebrow="Anonymat levé" title="Notes validées" subtitle="Les noms sont rattachés aux notes depuis la validation.">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Étudiant</th><th>Note sur {Number(evaluation.bareme)}</th></tr></thead>
              <tbody>
                {students.map((student) => {
                  const note = student.notes.find((item) => item.evaluationId === evaluationId);
                  return <tr key={student.inscriptionId}><td className="strong-cell">{personName(student.personne)}<small className="cell-detail">{student.personne.matricule ?? ""}</small></td><td>{note?.absent ? "Absent" : number(note?.valeur)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {(canValidate || (validated && data.peutValider && !data.verrouille)) && (
        <section className="role-block" aria-label="Validation">
          <div className="role-head"><span className="role-tag school">Scolarité</span><div><strong>{validated ? "Notes validées" : evaluation.anonyme ? "Validation et levée de l'anonymat" : "Validation des notes"}</strong><small>{validated ? `Verrouillées${evaluation.valideParNom ? ` par ${evaluation.valideParNom}` : ""}. Une réouverture exige un motif, conservé dans l'audit.` : complete ? "Toutes les notes sont saisies : vous pouvez valider. Les notes seront verrouillées." : `Il reste ${remaining} ${evaluation.anonyme ? "copie(s)" : "étudiant(s)"} à noter (ou à marquer absent) avant de pouvoir valider.`}</small></div></div>
          <div className="action-bar">
            {canValidate && <button className="primary-button compact" disabled={action.busy || !complete} onClick={() => void validate()}><LockKeyhole size={16} aria-hidden="true" /> {evaluation.anonyme ? "Valider et lever l'anonymat" : "Valider les notes"}</button>}
            {validated && data.peutValider && !data.verrouille && <button className="outline-button" disabled={action.busy} onClick={() => void reopen()}><RotateCcw size={16} aria-hidden="true" /> Rouvrir l&apos;évaluation</button>}
          </div>
        </section>
      )}

      {open && canEdit && !data.verrouille && (
        <div className="danger-zone">
          <span><strong>Supprimer cette évaluation</strong><small>Les notes déjà saisies seront perdues. Impossible une fois l&apos;évaluation validée.</small></span>
          <button className="danger-button" disabled={action.busy} onClick={() => void remove()}><Trash2 size={16} aria-hidden="true" /> Supprimer</button>
        </div>
      )}

      <Guide
        more={() => navigateTo(pathForHelp("Évaluations et notes", pathForGrades(courseId, evaluationId)))}
        steps={
          anonymous
            ? [
                { title: "La scolarité prépare les fiches", detail: "Elle génère les codes, imprime les fiches et les découpe aux pointillés." },
                { title: "L'étudiant colle son code", detail: "Il garde le talon à son nom et colle sur sa copie la partie avec le code et le QR code." },
                { title: "Le correcteur saisit par code", detail: "Il scanne ou tape le code, puis la note. Il ne voit jamais les noms." },
                { title: "La scolarité valide", detail: "Les notes sont verrouillées et les noms réapparaissent. Le correcteur ne peut pas valider lui-même." },
              ]
            : [
                { title: "Saisissez les notes", detail: "Une note par étudiant, ou « absent ». Vous pouvez enregistrer en plusieurs fois." },
                { title: "Faites valider", detail: "Quand tout est saisi, la scolarité valide : les notes sont verrouillées." },
                { title: "Sous anonymat ?", detail: "Avant toute saisie, la scolarité peut générer des fiches d'anonymat pour cette évaluation." },
              ]
        }
      />
    </div>
  );
}
