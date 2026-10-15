"use client";

import { FormEvent, useState } from "react";
import { BookOpen, CalendarCheck, Users } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { enrollmentCertificateNumber, enrollmentCertificatePdf, rosterPdf } from "@/lib/pdf-docs";
import { printStudentCards } from "@/lib/cards";
import { logPrint } from "@/lib/print-log";
import { ClassSection, navigateTo, pathForClass, pathForStudent, pathForView } from "@/lib/routes";
import { User } from "@/lib/types";
import { AcademicYear, Pole, Program, useLevels } from "@/components/academic-structure-page";
import { StudentJourneyPage } from "@/components/student-journey";
import { Badge, Empty, FormActions, HubBack, HubCard, HubCards, Modal, PageIntro, Panel, number, personName, send, useAction, useForm, useLoad } from "@/components/ui-kit";

export type Student = { id: string; nom: string; prenom: string; matricule?: string | null; sexe?: string | null; telephone?: string | null; dateNaissance?: string | null; lieuNaissance?: string | null };
export type ClassSummary = { id: string; nom: string; niveau: string; groupe: string; capacite?: number | null; effectif: number; filiere: Program; _count: { cours: number }; deliberations: Array<{ semestre: number; statut: string }> };
export type ClassList = { annee: AcademicYear | null; classes: ClassSummary[] };
type ClassDetail = ClassSummary & { anneeAcademique: AcademicYear; inscriptions: Array<{ id: string; statut: string; filiere: string; personne: Student }> };
type Candidate = { id: string; filiere: string; statut: string; correspond: boolean; personne: Student };
type ClassProgram = Program & { pole?: { id: string; nom: string } | null };
export type Course = {
  id: string;
  classeId: string;
  classeNom: string;
  enseignantId?: string | null;
  enseignant?: { id: string; nom: string; prenom: string } | null;
  matiere: { id: string; code: string; nom: string; coefficient: string; volumeHoraire: number; ue: { code: string; semestre: number } };
  heuresFaites: number;
  _count: { evaluations: number };
};
type Attendance = { heuresTenues: number; seuil: number; etudiants: Array<{ inscriptionId: string; personne: Student; heuresAbsence: number; heuresInjustifiees: number; taux: number; alerte: boolean }> };
type Teacher = { id: string; nom: string; prenom: string; matricule: string };

// Sélecteur d'année et de classe partagé par les pages académiques.
export function useClassPicker(signal: number) {
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const years = useLoad<AcademicYear[]>("/academique/annees", signal);
  const list = useLoad<ClassList>(`/academique/classes${yearId ? `?anneeId=${yearId}` : ""}`, signal);
  const classes = list.data?.classes ?? [];
  const selected = classes.find((item) => item.id === classId) ?? classes[0] ?? null;
  const picker = (
    <>
      <select className="expense-select" aria-label="Année académique" value={list.data?.annee?.id ?? ""} onChange={(event) => { setYearId(event.target.value); setClassId(""); }}>
        {(years.data ?? []).map((year) => <option key={year.id} value={year.id}>{year.libelle}{year.statut === "CLOTUREE" ? " (clôturée)" : ""}</option>)}
        {!years.data?.length && <option value="">Aucune année</option>}
      </select>
      <select className="expense-select" aria-label="Classe" value={selected?.id ?? ""} onChange={(event) => setClassId(event.target.value)}>
        {classes.map((item) => <option key={item.id} value={item.id}>{item.nom} · {item.effectif} étudiant(s)</option>)}
        {!classes.length && <option value="">Aucune classe</option>}
      </select>
    </>
  );
  return { picker, selected, year: list.data?.annee ?? null, classes, reload: list.reload, error: list.error || years.error, loaded: Boolean(list.data) };
}

function AssignStudents({ classId, onClose, onSaved }: { classId: string; onClose: () => void; onSaved: () => void }) {
  const candidates = useLoad<Candidate[]>(`/academique/classes/${classId}/candidats`);
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const action = useAction();
  // Par défaut, ceux dont la filière saisie à l'inscription correspond à la classe.
  const selection = chosen ?? new Set((candidates.data ?? []).filter((item) => item.correspond).map((item) => item.id));
  const toggle = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send(`/academique/classes/${classId}/affectations`, "POST", { inscriptionIds: [...selection] }, true);
      toast(`${selection.size} étudiant(s) affecté(s) à la classe.`);
      onSaved();
      onClose();
    });
  };
  return (
    <Modal wide title="Affecter des étudiants à la classe" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Inscriptions de la même année et du même niveau, sans classe. Celles de la filière sont cochées d&apos;avance ; affecter un étudiant d&apos;une autre filière le rattache à celle de la classe. Un matricule est attribué à la première affectation.</p>
        {candidates.error && <p className="form-error">{candidates.error}</p>}
        <div className="table-wrap pick-list">
          <table>
            <thead><tr><th /><th>Étudiant</th><th>Filière de l&apos;inscription</th><th>Correspondance</th></tr></thead>
            <tbody>
              {(candidates.data ?? []).map((item) => (
                <tr key={item.id} onClick={() => toggle(item.id)}>
                  <td><input type="checkbox" aria-label={`Sélectionner ${personName(item.personne)}`} checked={selection.has(item.id)} onChange={() => toggle(item.id)} onClick={(event) => event.stopPropagation()} /></td>
                  <td className="strong-cell">{personName(item.personne)}</td>
                  <td>{item.filiere}</td>
                  <td>{item.correspond ? <Badge tone="ok">Même filière</Badge> : <Badge tone="wait">Autre filière</Badge>}</td>
                </tr>
              ))}
              {!candidates.data?.length && <Empty columns={4}>{candidates.data ? "Aucune inscription en attente de classe pour cette année et ce niveau." : "Chargement..."}</Empty>}
            </tbody>
          </table>
        </div>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} disabled={!selection.size} label={`Affecter ${selection.size} étudiant(s)`} onCancel={onClose} />
      </form>
    </Modal>
  );
}

const SECTION_TITLES: Record<ClassSection, string> = { etudiants: "Étudiants", cours: "Cours et enseignants", assiduite: "Assiduité" };

// Page d'une classe : trois cartes, et derrière chacune sa rubrique.
function ClassPage({ classId, section, canEdit, canPrintCards, refreshSignal }: { classId: string; section: ClassSection | null; canEdit: boolean; canPrintCards: boolean; refreshSignal: number }) {
  const [assigning, setAssigning] = useState(false);
  const detail = useLoad<ClassDetail>(`/academique/classes/${classId}`, refreshSignal);
  const courses = useLoad<Course[]>(`/academique/cours?classeId=${classId}`, refreshSignal);
  const teachers = useLoad<{ data: Teacher[] }>(section === "cours" && canEdit ? "/rh/employes?categorie=ENSEIGNANT&statut=ACTIF&limit=200" : null);
  const attendance = useLoad<Attendance>(`/scolarite/assiduite/${classId}`, refreshSignal);
  const action = useAction();
  const classe = detail.data;
  const closed = classe?.anneeAcademique.statut === "CLOTUREE";
  const editable = canEdit && !closed;
  const remove = async (inscriptionId: string, name: string) => {
    if (!(await askConfirm({ title: `Retirer ${name} de la classe ?`, message: "Possible seulement s'il n'a encore ni note ni absence.", confirmLabel: "Retirer", danger: true }))) return;
    void action.run(async () => {
      await send(`/academique/classes/${classId}/affectations/${inscriptionId}`, "DELETE");
      detail.reload();
    });
  };
  // Cartes d'étudiant de toute la classe, ou d'un seul étudiant. Une carte encore
  // valable est réimprimée à l'identique ; « Nouvelle carte » remplace une carte perdue.
  const cards = (inscriptionId?: string, renouveler = false) =>
    action.run(async () => {
      if (!classe) return;
      const students = classe.inscriptions.filter((item) => item.statut !== "ABANDONNEE" && (!inscriptionId || item.id === inscriptionId));
      if (!students.length) throw new Error("Aucun étudiant à qui éditer une carte.");
      if (renouveler && !(await askConfirm({ title: `Nouvelle carte pour ${personName(students[0].personne)} ?`, message: "L'ancienne carte est désactivée : son QR code ne passera plus au contrôle. À utiliser pour une carte perdue, volée ou abîmée.", confirmLabel: "Éditer une nouvelle carte", danger: true }))) return;
      const count = await printStudentCards(students.map((item) => item.id), {
        renouveler,
        fileName: inscriptionId ? `carte-${students[0].personne.matricule ?? students[0].personne.nom}.pdf` : `cartes-${classe.nom.replace(/\s+/g, "-")}.pdf`,
        libelle: (card) => `${card.personne.nom} ${card.personne.prenom} · ${classe.nom}`,
      });
      toast(`${count} carte(s) prête(s) : imprimez la page des rectos, puis celle des versos au dos (recto verso, bord long).`);
    });
  // Liste nominative de la classe, à afficher ou à remettre aux enseignants.
  const roster = () =>
    action.run(async () => {
      if (!classe) return;
      const students = classe.inscriptions.filter((item) => item.statut !== "ABANDONNEE");
      await rosterPdf({ title: "LISTE DE CLASSE", subtitle: `${classe.nom} · ${classe.anneeAcademique.libelle}`, infos: [`Filière : ${classe.filiere.nom} · Niveau : ${classe.niveau}`, `Effectif : ${students.length} étudiant(s)`], columns: [{ label: "N°", width: 12, align: "center" }, { label: "Matricule", width: 30 }, { label: "Nom", width: 55 }, { label: "Prénom", width: 53 }, { label: "Téléphone", width: 30 }], rows: students.map((item, index) => [index + 1, item.personne.matricule, item.personne.nom, item.personne.prenom, item.personne.telephone]), fileName: `liste-${classe.nom.replace(/\s+/g, "-")}.pdf` });
    });
  const certificate = (inscriptionId: string) =>
    action.run(async () => {
      const item = classe?.inscriptions.find((line) => line.id === inscriptionId);
      if (!classe || !item) return;
      const data = { etudiant: item.personne, annee: classe.anneeAcademique.libelle, niveau: classe.niveau, filiere: classe.filiere.nom, classe: classe.nom };
      await enrollmentCertificatePdf(data, `certificat-scolarite-${item.personne.matricule ?? item.personne.nom}.pdf`);
      logPrint({ typeDocument: "CERTIFICAT_SCOLARITE", mode: "PDF", dossierType: "inscription", dossierId: item.id, libelle: `${personName(item.personne)} · ${classe.nom}`, reference: enrollmentCertificateNumber(data) });
    });
  const unassigned = (courses.data ?? []).filter((course) => !course.enseignantId).length;
  const alerts = (attendance.data?.etudiants ?? []).filter((item) => item.alerte).length;
  const hub: HubCard<ClassSection>[] = [
    { key: "etudiants", icon: Users, title: "Étudiants", value: `${classe?.inscriptions.length ?? "—"}`, detail: classe?.capacite ? `étudiant(s) sur ${classe.capacite} places` : "étudiant(s) dans la classe", info: "La liste des étudiants de la classe : affectez les inscrits, éditez les cartes d'étudiant, et ouvrez le parcours complet d'un étudiant en cliquant sur son nom." },
    { key: "cours", icon: BookOpen, title: "Cours et enseignants", value: `${courses.data?.length ?? "—"}`, detail: !courses.data ? "matière(s)" : !courses.data.length ? "aucune matière dans la maquette" : unassigned ? `matière(s) · ${unassigned} sans enseignant` : "matière(s), toutes avec un enseignant", tone: unassigned ? "warn" : undefined, info: "Les matières de la maquette rattachées à la classe : l'enseignant de chacune et l'avancement des heures tenues face au volume prévu." },
    { key: "assiduite", icon: CalendarCheck, title: "Assiduité", value: `${attendance.data ? alerts : "—"}`, detail: attendance.data ? `étudiant(s) au-dessus de ${attendance.data.seuil} % d'absences non justifiées` : "étudiant(s) en alerte", tone: alerts ? "alert" : undefined, info: "Les heures d'absence de chaque étudiant, dont les non justifiées, et ceux qui dépassent le seuil d'alerte." },
  ];
  return (
    <div className="content-scroll">
      {section ? <HubBack label={classe?.nom ?? "Classe"} onBack={() => navigateTo(pathForClass(classId))} /> : <HubBack label="Classes et étudiants" onBack={() => navigateTo(pathForView("Classes et étudiants"))} />}
      <PageIntro
        eyebrow={classe ? `Classe · ${classe.anneeAcademique.libelle}` : "Classe"}
        title={classe ? (section ? `${classe.nom} · ${SECTION_TITLES[section]}` : classe.nom) : "Classe"}
        text={classe ? `${classe.filiere.nom} · ${classe.niveau}${closed ? " · année clôturée, consultation seule" : ""}` : detail.error ? "" : "Chargement..."}
      >
        {section === "etudiants" && editable && <button className="primary-button compact" onClick={() => setAssigning(true)}>+ Affecter des étudiants</button>}
        {section === "etudiants" && <button className="outline-button small" disabled={action.busy || !classe?.inscriptions.length} onClick={() => void roster()}>Liste de classe (PDF)</button>}
        {section === "etudiants" && canPrintCards && <button className="outline-button small" disabled={action.busy || !classe?.inscriptions.length} onClick={() => void cards()}>Cartes d&apos;étudiant (PDF)</button>}
      </PageIntro>
      {(action.error || detail.error) && <p className="form-error">{action.error || detail.error}</p>}
      {!section && <HubCards cards={hub} onOpen={(key) => navigateTo(pathForClass(classId, key))} />}
      {section === "etudiants" && (
        <Panel title={`${classe?.inscriptions.length ?? "--"} étudiant(s)${classe?.capacite ? ` sur ${classe.capacite} places` : ""}`} subtitle="Cliquez sur un étudiant pour ouvrir son parcours complet.">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Matricule</th><th>Étudiant</th><th>Téléphone</th><th>Inscription</th><th /></tr></thead>
              <tbody>
                {(classe?.inscriptions ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="strong-cell">{item.personne.matricule ?? "—"}</td>
                    <td><button className="dossier-open-button" onClick={() => navigateTo(pathForStudent(item.personne.id))}>{personName(item.personne)}</button></td>
                    <td>{item.personne.telephone ?? "—"}</td>
                    <td><Badge tone={item.statut === "ABANDONNEE" ? "bad" : item.statut === "COMPLETE" ? "ok" : "wait"}>{item.statut === "ABANDONNEE" ? "Abandonnée" : item.statut === "COMPLETE" ? "Complète" : "En cours"}</Badge></td>
                    <td className="action-group"><button className="row-action" onClick={() => navigateTo(pathForStudent(item.personne.id))}>Parcours</button>{canPrintCards && item.statut !== "ABANDONNEE" && <><button className="row-action" disabled={action.busy} onClick={() => void cards(item.id)}>Carte</button><button className="row-action" disabled={action.busy} title="Remplace une carte perdue ou volée : l'ancienne est désactivée" onClick={() => void cards(item.id, true)}>Nouvelle carte</button></>}{item.statut !== "ABANDONNEE" && <button className="row-action" disabled={action.busy} onClick={() => void certificate(item.id)}>Certificat</button>}{editable && <button className="row-action danger-row-action" onClick={() => void remove(item.id, personName(item.personne))}>Retirer</button>}</td>
                  </tr>
                ))}
                {!classe?.inscriptions.length && <Empty columns={5}>{classe ? "Aucun étudiant dans cette classe." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {section === "cours" && (
        <Panel title={`${courses.data?.length ?? "--"} matière(s)`} subtitle={editable ? "Choisissez l'enseignant de chaque matière ; le changement est enregistré aussitôt." : undefined}>
          {courses.error && <p className="form-error">{courses.error}</p>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Semestre</th><th>Matière</th><th>Enseignant</th><th>Avancement</th></tr></thead>
              <tbody>
                {(courses.data ?? []).map((course) => (
                  <tr key={course.id}>
                    <td>S{course.matiere.ue.semestre} · {course.matiere.ue.code}</td>
                    <td className="strong-cell">{course.matiere.nom}<small className="cell-detail">{course.matiere.code} · coefficient {Number(course.matiere.coefficient)}</small></td>
                    <td>
                      {editable ? (
                        <select className="expense-select" aria-label={`Enseignant de ${course.matiere.nom}`} value={course.enseignantId ?? ""} onChange={(event) => void action.run(async () => { await send(`/academique/cours/${course.id}`, "PATCH", { enseignantId: event.target.value || null }, true); courses.reload(); })}>
                          <option value="">Non affecté</option>
                          {(teachers.data?.data ?? []).map((teacher) => <option key={teacher.id} value={teacher.id}>{personName(teacher)}</option>)}
                        </select>
                      ) : course.enseignant ? personName(course.enseignant) : <Badge tone="wait">Non affecté</Badge>}
                    </td>
                    <td>{number(course.heuresFaites, 1)} h / {course.matiere.volumeHoraire} h</td>
                  </tr>
                ))}
                {!courses.data?.length && <Empty columns={4}>{courses.data ? "Aucune matière : complétez la maquette de cette filière et de ce niveau." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {section === "assiduite" && (
        <Panel title={attendance.data ? `${alerts} étudiant(s) en alerte` : "Assiduité"} subtitle={attendance.data ? `${number(attendance.data.heuresTenues, 1)} heure(s) de cours tenues · alerte à partir de ${attendance.data.seuil} % d'absences non justifiées.` : attendance.error || "Chargement..."}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Étudiant</th><th>Heures d&apos;absence</th><th>Dont non justifiées</th><th>Taux</th></tr></thead>
              <tbody>
                {(attendance.data?.etudiants ?? []).map((item) => (
                  <tr key={item.inscriptionId}>
                    <td><button className="dossier-open-button" onClick={() => navigateTo(pathForStudent(item.personne.id))}>{personName(item.personne)}</button></td>
                    <td>{number(item.heuresAbsence, 1)} h</td>
                    <td>{number(item.heuresInjustifiees, 1)} h</td>
                    <td><Badge tone={item.alerte ? "bad" : "ok"}>{number(item.taux, 1)} %</Badge></td>
                  </tr>
                ))}
                {attendance.data && !attendance.data.etudiants.length && <Empty columns={4}>Aucun étudiant dans cette classe.</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {assigning && <AssignStudents classId={classId} onClose={() => setAssigning(false)} onSaved={detail.reload} />}
    </div>
  );
}

export function AcademicClassesPage({ user, refreshSignal, classId, classSection, studentId }: { user: User | null; refreshSignal: number; classId: string | null; classSection: ClassSection | null; studentId: string | null }) {
  const canEdit = hasAccess(user, "academics", "edit");
  if (studentId) return <StudentJourneyPage key={studentId} personId={studentId} refreshSignal={refreshSignal} />;
  if (classId) return <ClassPage key={classId} classId={classId} section={classSection} canEdit={canEdit} canPrintCards={hasAccess(user, "enrollments", "edit") || hasAccess(user, "academics", "edit")} refreshSignal={refreshSignal} />;
  return <ClassListPage canEdit={canEdit} refreshSignal={refreshSignal} />;
}

// L'année et le pôle choisis restent en place quand on revient d'une classe.
const listFilters = { yearId: "", poleId: "" };

function ClassListPage({ canEdit, refreshSignal }: { canEdit: boolean; refreshSignal: number }) {
  const [yearId, setYear] = useState(listFilters.yearId);
  const [poleId, setPole] = useState(listFilters.poleId);
  const setYearId = (value: string) => { listFilters.yearId = value; setYear(value); };
  const setPoleId = (value: string) => { listFilters.poleId = value; setPole(value); };
  const years = useLoad<AcademicYear[]>("/academique/annees", refreshSignal);
  const programs = useLoad<Program[]>("/academique/filieres", refreshSignal);
  const poles = useLoad<Pole[]>("/academique/poles", refreshSignal);
  const levels = useLevels(refreshSignal);
  const list = useLoad<ClassList>(`/academique/classes${yearId || poleId ? `?${new URLSearchParams({ ...(yearId ? { anneeId: yearId } : {}), ...(poleId ? { poleId } : {}) }).toString()}` : ""}`, refreshSignal);
  const [creating, setCreating] = useState(false);
  const form = useForm({ filiereId: "", niveau: "", groupe: "A", capacite: "" });
  const action = useAction();
  const year = list.data?.annee ?? null;
  const create = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/academique/classes", "POST", { ...form.values, anneeAcademiqueId: year?.id });
      setCreating(false);
      list.reload();
    });
  };
  const students = (list.data?.classes ?? []).reduce((total, item) => total + item.effectif, 0);
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Classes et étudiants" text="Créez les classes de l'année, affectez-y les étudiants inscrits et suivez leurs cours et leur assiduité.">
        <select className="expense-select" aria-label="Année académique" value={year?.id ?? ""} onChange={(event) => setYearId(event.target.value)}>
          {(years.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.libelle}{item.statut === "CLOTUREE" ? " (clôturée)" : ""}</option>)}
          {!years.data?.length && <option value="">Aucune année</option>}
        </select>
        {Boolean(poles.data?.length) && (
          <select className="expense-select" aria-label="Pôle" value={poleId} onChange={(event) => setPoleId(event.target.value)}>
            <option value="">Tous les pôles</option>
            {(poles.data ?? []).map((pole) => <option key={pole.id} value={pole.id}>{pole.nom}</option>)}
            <option value="aucun">Sans pôle</option>
          </select>
        )}
        {canEdit && year && year.statut !== "CLOTUREE" && <button className="primary-button compact" onClick={() => { action.setError(""); form.setValues({ filiereId: programs.data?.find((item) => item.actif && (!poleId || item.poleId === poleId))?.id ?? "", niveau: levels.active[0]?.code ?? "", groupe: "A", capacite: "" }); setCreating(true); }}>+ Nouvelle classe</button>}
      </PageIntro>
      {list.error && <p className="form-error">{list.error}</p>}
      {list.data && !year && <Panel title="Aucune année académique">Ouvrez une année dans « Structure académique » pour créer des classes.</Panel>}
      {year && (
        <Panel eyebrow={`Année ${year.libelle}`} title={`${list.data?.classes.length ?? 0} classe(s) · ${students} étudiant(s)`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Classe</th><th>Filière</th><th>Niveau</th><th>Effectif</th><th>Matières</th><th /></tr></thead>
              <tbody>
                {(list.data?.classes ?? []).map((item) => (
                  <tr key={item.id}>
                    <td><button className="dossier-open-button" onClick={() => navigateTo(pathForClass(item.id))}>{item.nom}</button></td>
                    <td>{item.filiere.nom}<small className="cell-detail">{(item.filiere as ClassProgram).pole?.nom ?? "Sans pôle"}</small></td>
                    <td>{item.niveau}</td>
                    <td>{item.effectif}{item.capacite ? ` / ${item.capacite}` : ""}</td>
                    <td>{item._count.cours}</td>
                    <td><button className="row-action" onClick={() => navigateTo(pathForClass(item.id))}>Ouvrir</button></td>
                  </tr>
                ))}
                {!list.data?.classes.length && <Empty columns={6}>{poleId ? "Aucune classe de ce pôle pour cette année." : "Aucune classe pour cette année."}</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {creating && (
        <Modal title={`Nouvelle classe · ${year?.libelle ?? ""}`} onClose={() => setCreating(false)}>
          <form className="entity-form" onSubmit={create}>
            <label>Filière
              <select required {...form.bind("filiereId")}>
                <option value="">Sélectionner une filière</option>
                {(programs.data ?? []).filter((item) => item.actif).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label>Niveau<select required {...form.bind("niveau")}>{levels.active.map((item) => <option key={item.id} value={item.code}>{item.code} · {item.libelle}</option>)}</select></label>
              <label>Groupe<input required maxLength={8} {...form.bind("groupe")} /></label>
            </div>
            <label>Capacité (facultatif)<input type="number" min="1" {...form.bind("capacite")} /></label>
            <p className="panel-subtitle">Les matières de la maquette de cette filière et de ce niveau, pour cette année, sont rattachées automatiquement à la classe.</p>
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} label="Créer la classe" onCancel={() => setCreating(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}
