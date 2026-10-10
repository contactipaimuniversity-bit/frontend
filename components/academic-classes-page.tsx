"use client";

import { FormEvent, useState } from "react";
import { askConfirm, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { studentCardsPdf } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { User } from "@/lib/types";
import { AcademicYear, NIVEAUX, Program } from "@/components/academic-structure-page";
import { Badge, Empty, FormActions, Modal, PageIntro, Panel, Tabs, number, personName, send, useAction, useForm, useLoad } from "@/components/ui-kit";

export type Student = { id: string; nom: string; prenom: string; matricule?: string | null; sexe?: string | null; telephone?: string | null; dateNaissance?: string | null };
export type ClassSummary = { id: string; nom: string; niveau: string; groupe: string; capacite?: number | null; effectif: number; filiere: Program; _count: { cours: number }; deliberations: Array<{ semestre: number; statut: string }> };
export type ClassList = { annee: AcademicYear | null; classes: ClassSummary[] };
type ClassDetail = ClassSummary & { anneeAcademique: AcademicYear; inscriptions: Array<{ id: string; statut: string; filiere: string; personne: Student }> };
type Candidate = { id: string; filiere: string; statut: string; correspond: boolean; personne: Student };
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
        <p className="panel-subtitle">Inscriptions de la même année et du même niveau, sans classe. Celles dont la filière correspond sont cochées d&apos;avance ; un matricule est attribué à la première affectation.</p>
        {candidates.error && <p className="form-error">{candidates.error}</p>}
        <div className="table-wrap pick-list">
          <table>
            <thead><tr><th /><th>Étudiant</th><th>Filière saisie à l&apos;inscription</th><th>Correspondance</th></tr></thead>
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

function ClassModal({ classId, canEdit, onClose, onChanged }: { classId: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  type Tab = "etudiants" | "cours" | "assiduite";
  const [tab, setTab] = useState<Tab>("etudiants");
  const [assigning, setAssigning] = useState(false);
  const detail = useLoad<ClassDetail>(`/academique/classes/${classId}`);
  const courses = useLoad<Course[]>(tab === "cours" ? `/academique/cours?classeId=${classId}` : null);
  const teachers = useLoad<{ data: Teacher[] }>(tab === "cours" && canEdit ? "/rh/employes?categorie=ENSEIGNANT&statut=ACTIF&limit=200" : null);
  const attendance = useLoad<Attendance>(tab === "assiduite" ? `/scolarite/assiduite/${classId}` : null);
  const action = useAction();
  const closed = detail.data?.anneeAcademique.statut === "CLOTUREE";
  const editable = canEdit && !closed;
  const remove = async (inscriptionId: string, name: string) => {
    if (!(await askConfirm({ title: `Retirer ${name} de la classe ?`, message: "Possible seulement s'il n'a encore ni note ni absence.", confirmLabel: "Retirer", danger: true }))) return;
    void action.run(async () => {
      await send(`/academique/classes/${classId}/affectations/${inscriptionId}`, "DELETE");
      detail.reload();
      onChanged();
    });
  };
  // Cartes d'étudiant de toute la classe, ou d'un seul étudiant.
  const cards = (inscriptionId?: string) =>
    action.run(async () => {
      const classe = detail.data;
      if (!classe) return;
      const students = classe.inscriptions.filter((item) => item.statut !== "ABANDONNEE" && (!inscriptionId || item.id === inscriptionId));
      if (!students.length) throw new Error("Aucun étudiant à qui éditer une carte.");
      await studentCardsPdf(
        students.map((item) => ({ nom: item.personne.nom, prenom: item.personne.prenom, matricule: item.personne.matricule, dateNaissance: item.personne.dateNaissance, filiere: classe.filiere.nom, niveau: classe.niveau, annee: classe.anneeAcademique.libelle })),
        inscriptionId ? `carte-${students[0].personne.matricule ?? students[0].personne.nom}.pdf` : `cartes-${classe.nom.replace(/\s+/g, "-")}.pdf`,
      );
      for (const item of students) logPrint({ typeDocument: "CARTE_ETUDIANT", mode: "PDF", dossierType: "inscription", dossierId: item.id, libelle: `${personName(item.personne)} · ${classe.nom}`, reference: item.personne.matricule });
    });
  return (
    <Modal wide title={detail.data ? `${detail.data.nom} · ${detail.data.anneeAcademique.libelle}` : "Classe"} onClose={onClose}>
      <Tabs label="Rubrique" value={tab} onChange={setTab} tabs={[["etudiants", "Étudiants"], ["cours", "Cours et enseignants"], ["assiduite", "Assiduité"]]} />
      {(action.error || detail.error) && <p className="form-error">{action.error || detail.error}</p>}
      {tab === "etudiants" && (
        <>
          <div className="finance-inline-form">
            <strong>{detail.data?.inscriptions.length ?? "--"} étudiant(s){detail.data?.capacite ? ` sur ${detail.data.capacite} places` : ""}</strong>
            {editable && <button className="outline-button small" onClick={() => setAssigning(true)}>+ Affecter des étudiants</button>}
            <button className="outline-button small" disabled={action.busy || !detail.data?.inscriptions.length} onClick={() => void cards()}>Cartes d&apos;étudiant (PDF)</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Matricule</th><th>Étudiant</th><th>Téléphone</th><th>Inscription</th><th /></tr></thead>
              <tbody>
                {(detail.data?.inscriptions ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="strong-cell">{item.personne.matricule ?? "—"}</td>
                    <td>{personName(item.personne)}</td>
                    <td>{item.personne.telephone ?? "—"}</td>
                    <td><Badge tone={item.statut === "ABANDONNEE" ? "bad" : item.statut === "COMPLETE" ? "ok" : "wait"}>{item.statut === "ABANDONNEE" ? "Abandonnée" : item.statut === "COMPLETE" ? "Complète" : "En cours"}</Badge></td>
                    <td className="action-group"><button className="row-action" disabled={action.busy} onClick={() => void cards(item.id)}>Carte</button>{editable && <button className="row-action danger-row-action" onClick={() => void remove(item.id, personName(item.personne))}>Retirer</button>}</td>
                  </tr>
                ))}
                {!detail.data?.inscriptions.length && <Empty columns={5}>{detail.data ? "Aucun étudiant dans cette classe." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "cours" && (
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
      )}
      {tab === "assiduite" && (
        <>
          <p className="panel-subtitle">{attendance.data ? `${number(attendance.data.heuresTenues, 1)} heure(s) de cours tenues · alerte à partir de ${attendance.data.seuil} % d'absences non justifiées.` : attendance.error || "Chargement..."}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Étudiant</th><th>Heures d&apos;absence</th><th>Dont non justifiées</th><th>Taux</th></tr></thead>
              <tbody>
                {(attendance.data?.etudiants ?? []).map((item) => (
                  <tr key={item.inscriptionId}>
                    <td className="strong-cell">{personName(item.personne)}</td>
                    <td>{number(item.heuresAbsence, 1)} h</td>
                    <td>{number(item.heuresInjustifiees, 1)} h</td>
                    <td><Badge tone={item.alerte ? "bad" : "ok"}>{number(item.taux, 1)} %</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {assigning && <AssignStudents classId={classId} onClose={() => setAssigning(false)} onSaved={() => { detail.reload(); onChanged(); }} />}
    </Modal>
  );
}

export function AcademicClassesPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "academics", "edit");
  const [yearId, setYearId] = useState("");
  const years = useLoad<AcademicYear[]>("/academique/annees", refreshSignal);
  const programs = useLoad<Program[]>("/academique/filieres", refreshSignal);
  const list = useLoad<ClassList>(`/academique/classes${yearId ? `?anneeId=${yearId}` : ""}`, refreshSignal);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const form = useForm({ filiereId: "", niveau: "L1", groupe: "A", capacite: "" });
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
        {canEdit && year && year.statut !== "CLOTUREE" && <button className="primary-button compact" onClick={() => { action.setError(""); form.setValues({ filiereId: programs.data?.find((item) => item.actif)?.id ?? "", niveau: "L1", groupe: "A", capacite: "" }); setCreating(true); }}>+ Nouvelle classe</button>}
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
                    <td><button className="dossier-open-button" onClick={() => setOpenId(item.id)}>{item.nom}</button></td>
                    <td>{item.filiere.nom}</td>
                    <td>{item.niveau}</td>
                    <td>{item.effectif}{item.capacite ? ` / ${item.capacite}` : ""}</td>
                    <td>{item._count.cours}</td>
                    <td><button className="row-action" onClick={() => setOpenId(item.id)}>Ouvrir</button></td>
                  </tr>
                ))}
                {!list.data?.classes.length && <Empty columns={6}>Aucune classe pour cette année.</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {openId && <ClassModal key={openId} classId={openId} canEdit={canEdit} onClose={() => setOpenId(null)} onChanged={list.reload} />}
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
              <label>Niveau<select {...form.bind("niveau")}>{NIVEAUX.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Groupe<input required maxLength={8} {...form.bind("groupe")} /></label>
            </div>
            <label>Capacité (facultatif)<input type="number" min="1" {...form.bind("capacite")} /></label>
            <p className="panel-subtitle">Les matières de la maquette de cette filière et de ce niveau sont rattachées automatiquement à la classe.</p>
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} label="Créer la classe" onCancel={() => setCreating(false)} />
          </form>
        </Modal>
      )}
    </div>
  );
}
