"use client";

import { FormEvent, useState } from "react";
import { askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { DECISION_LABELS, GradeReport, MinutesData, Transcript, WithheldReport, attestationsPdf, deliberationMinutesPdf, diplomaTitle, diplomasPdf, documentNumber, gradeReportsPdf, tablePdf, transcriptsPdf } from "@/lib/pdf-docs";
import { PrintDocument, logPrint } from "@/lib/print-log";
import { User, formatDate } from "@/lib/types";
import { AcademicYear } from "@/components/academic-structure-page";
import { Student } from "@/components/academic-classes-page";
import { Badge, Empty, FormActions, Modal, PageIntro, Panel, Tabs, downloadPdf, number, personName, send, today, useAction, useForm, useLoad } from "@/components/ui-kit";

type Board = {
  annee: AcademicYear | null;
  annees: AcademicYear[];
  classes: Array<{ id: string; nom: string; niveau: string; filiere: string; effectif: number; semestres: number[]; deliberations: Array<{ semestre: number; statut: string }> }>;
};
type ResultLine = {
  inscriptionId: string;
  personne: Student;
  moyenne: number | null;
  creditsAcquis: number;
  creditsTotal: number;
  rang: number | null;
  mention: string | null;
  decision: string;
  detail: { unites?: Array<{ code: string; nom: string; moyenne: number | null; validee: boolean; acquise?: string | null }>; semestres?: Array<{ semestre: number; moyenne: number | null; creditsAcquis: number; creditsTotal: number }> };
};
type Results = Omit<MinutesData, "classe" | "resultats" | "synthese"> & {
  classe: MinutesData["classe"] & { id: string; anneeCloturee: boolean };
  statut: string;
  problemes: string[];
  resultats: ResultLine[];
  synthese: MinutesData["synthese"] & { plusForte: number | null; plusFaible: number | null };
};
type Promotion = { anneeSuivante: string; anneeSuivanteOuverte: boolean; etudiants: Array<{ inscriptionId: string; personne: Student; decision: string; niveauSuivant: string | null; dejaInscrit: boolean; creditsARattraper: number; creditsConserves: number }> };
type YearDocument = "releve" | "attestation" | "diplome";
const YEAR_DOCUMENTS: Record<YearDocument, { label: string; type: PrintDocument; file: string }> = {
  releve: { label: "Relevé de notes annuel", type: "RELEVE_NOTES", file: "releves" },
  attestation: { label: "Attestation de réussite", type: "ATTESTATION_REUSSITE", file: "attestations" },
  diplome: { label: "Diplôme", type: "DIPLOME", file: "diplomes" },
};

const decisionTone = (decision: string) => (["VALIDE", "ADMIS"].includes(decision) ? "ok" : decision === "ADMIS_AVEC_DETTES" ? "run" : decision === "INCOMPLET" ? "wait" : "bad");
const semesterLabel = (semestre: number) => (semestre === 0 ? "Résultats annuels" : `Semestre ${semestre}`);

function PromotionModal({ classId, onClose }: { classId: string; onClose: () => void }) {
  const promotion = useLoad<Promotion>(`/deliberations/classes/${classId}/passage`);
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const action = useAction();
  const eligible = (promotion.data?.etudiants ?? []).filter((item) => item.niveauSuivant && !item.dejaInscrit);
  const selection = chosen ?? new Set(eligible.map((item) => item.inscriptionId));
  const toggle = (id: string) => { const next = new Set(selection); if (next.has(id)) next.delete(id); else next.add(id); setChosen(next); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const result = await send<{ creees: number; ignorees: Array<{ nom: string; raison: string }> }>(`/deliberations/classes/${classId}/reinscriptions`, "POST", { inscriptionIds: [...selection] }, true);
      toast(`${result.creees} réinscription(s) créée(s) pour ${promotion.data?.anneeSuivante}.${result.ignorees.length ? ` ${result.ignorees.length} ignorée(s).` : ""}`);
      onClose();
    });
  };
  return (
    <Modal wide title={`Passage vers ${promotion.data?.anneeSuivante ?? "l'année suivante"}`} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Chaque réinscription passe par le circuit normal : les pièces et les frais du niveau sont créés, l&apos;étudiant devra régler sa scolarité. Un admis avec dettes passe et garde ses unités à rattraper ; un ajourné reprend le même niveau en conservant les unités qu&apos;il a acquises.</p>
        {promotion.data && !promotion.data.anneeSuivanteOuverte && <p className="form-error">Ouvrez d&apos;abord l&apos;année {promotion.data.anneeSuivante} dans « Structure académique ».</p>}
        {promotion.error && <p className="form-error">{promotion.error}</p>}
        <div className="table-wrap pick-list">
          <table>
            <thead><tr><th /><th>Étudiant</th><th>Décision</th><th>Crédits</th><th>Année suivante</th></tr></thead>
            <tbody>
              {(promotion.data?.etudiants ?? []).map((item) => {
                const available = Boolean(item.niveauSuivant) && !item.dejaInscrit;
                return (
                  <tr key={item.inscriptionId}>
                    <td><input type="checkbox" aria-label={`Réinscrire ${personName(item.personne)}`} disabled={!available} checked={available && selection.has(item.inscriptionId)} onChange={() => toggle(item.inscriptionId)} /></td>
                    <td className="strong-cell">{personName(item.personne)}</td>
                    <td><Badge tone={decisionTone(item.decision)}>{DECISION_LABELS[item.decision] ?? item.decision}</Badge></td>
                    <td>{item.creditsARattraper ? `${item.creditsARattraper} à rattraper` : item.creditsConserves ? `${item.creditsConserves} conservés` : "—"}</td>
                    <td>{item.dejaInscrit ? "Déjà réinscrit" : item.niveauSuivant ? `Inscription en ${item.niveauSuivant}` : "Fin de parcours"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} disabled={!selection.size || !promotion.data?.anneeSuivanteOuverte} label={`Créer ${selection.size} réinscription(s)`} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function ResultsModal({ classId, semestre, canEdit, onClose, onChanged }: { classId: string; semestre: number; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const results = useLoad<Results>(`/deliberations/classes/${classId}/semestres/${semestre}`);
  const [closing, setClosing] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const form = useForm({ president: "", membres: "", observations: "" });
  const action = useAction();
  const data = results.data;
  const closed = data?.statut === "CLOTUREE";
  const editable = canEdit && !data?.classe.anneeCloturee;
  const units = data?.resultats[0]?.detail.unites ?? [];
  const close = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      results.setData(await send<Results>(`/deliberations/classes/${classId}/semestres/${semestre}/cloturer`, "POST", form.values, true));
      setClosing(false);
      toast("Délibération clôturée : les résultats sont définitifs.");
      onChanged();
    });
  };
  const reopen = async () => {
    const motif = await askReason({ title: "Rouvrir cette délibération", message: "Les résultats figés seront effacés et recalculés à la prochaine clôture.", confirmLabel: "Rouvrir", danger: true, reason: { label: "Motif de la réouverture", minLength: 10 } });
    if (!motif) return;
    void action.run(async () => {
      results.setData(await send<Results>(`/deliberations/classes/${classId}/semestres/${semestre}/rouvrir`, "POST", { motif }, true));
      onChanged();
    });
  };
  const reports = (inscriptionId?: string) =>
    action.run(async () => {
      const list = inscriptionId
        ? [await apiFetch<GradeReport>(`/deliberations/bulletins/${inscriptionId}/${semestre}`, { skipCache: true })]
        : await apiFetch<Array<GradeReport | WithheldReport>>(`/deliberations/classes/${classId}/semestres/${semestre}/bulletins`, { skipCache: true });
      const ready = list.filter((item): item is GradeReport => !item.retenu);
      const withheld = list.length - ready.length;
      if (!ready.length) throw new Error("Tous les bulletins sont retenus pour scolarité non soldée.");
      await gradeReportsPdf(ready, `bulletins-${data?.classe.nom.replace(/\s+/g, "-")}-${semestre === 0 ? "annuel" : `s${semestre}`}.pdf`);
      for (const report of ready)
        logPrint({ typeDocument: "BULLETIN_NOTES", mode: "PDF", dossierType: "inscription", dossierId: report.inscriptionId, libelle: `${report.etudiant.nom} ${report.etudiant.prenom} · ${report.classe.nom}`, reference: semesterLabel(semestre) });
      if (withheld) toast(`${withheld} bulletin(s) retenu(s) pour scolarité non soldée.`, "info");
    });
  // Documents de fin d'année : relevé pour tous, attestation pour les admis, diplôme en fin de parcours.
  const yearDocuments = (kind: YearDocument, inscriptionId?: string) =>
    action.run(async () => {
      const list = inscriptionId
        ? [await apiFetch<Transcript>(`/deliberations/releves/${inscriptionId}`, { skipCache: true })]
        : await apiFetch<Array<Transcript | WithheldReport>>(`/deliberations/classes/${classId}/releves`, { skipCache: true });
      const delivered = list.filter((item): item is Transcript => !item.retenu);
      const withheld = list.length - delivered.length;
      const ready = delivered.filter((item) => (kind === "releve" ? true : kind === "attestation" ? item.resultat.decision === "ADMIS" : item.diplomable));
      const { label, type, file } = YEAR_DOCUMENTS[kind];
      if (!ready.length)
        throw new Error(
          kind === "releve"
            ? "Tous les relevés sont retenus pour scolarité non soldée."
            : kind === "attestation"
              ? "Aucun étudiant admis sans dette à qui délivrer une attestation."
              : delivered.some((item) => item.finDeCycle)
                ? "Aucun diplôme à délivrer : il faut être admis en fin de parcours, sans crédit restant à rattraper."
                : "Cette classe n'est pas en fin de parcours : le diplôme se délivre à l'issue du dernier niveau.",
        );
      const name = `${file}-${data?.classe.nom.replace(/\s+/g, "-")}-${data?.classe.annee}.pdf`;
      await (kind === "releve" ? transcriptsPdf : kind === "attestation" ? attestationsPdf : diplomasPdf)(ready, name);
      for (const item of ready)
        logPrint({ typeDocument: type, mode: "PDF", dossierType: "inscription", dossierId: item.inscriptionId, libelle: `${item.etudiant.nom} ${item.etudiant.prenom} · ${item.classe.nom}`, reference: kind === "releve" ? item.classe.annee : `${kind === "diplome" ? diplomaTitle(item) : label} n° ${documentNumber(item)}` });
      if (kind !== "releve") toast(`${ready.length} ${label.toLowerCase()}(s) éditée(s).`);
      if (withheld) toast(`${withheld} document(s) retenu(s) pour scolarité non soldée.`, "info");
    });
  const minutes = () =>
    action.run(async () => {
      if (!data) return;
      await deliberationMinutesPdf(data);
      logPrint({ typeDocument: "PV_DELIBERATION", mode: "PDF", libelle: `${data.classe.nom} · ${semesterLabel(semestre)} · ${data.classe.annee}` });
    });
  const exportCsv = () =>
    data &&
    downloadPdf(`resultats-${data.classe.nom}-${semestre}.pdf`, "Résultats de la classe", `${data.classe.nom} · ${semesterLabel(semestre)} · ${data.classe.annee}`, [
      ["Rang", "Matricule", "Nom", "Prénom", ...units.map((unit) => unit.code), "Moyenne", "Crédits acquis", "Crédits", "Mention", "Décision"],
      ...data.resultats.map((line) => [line.rang, line.personne.matricule, line.personne.nom, line.personne.prenom, ...(line.detail.unites ?? []).map((unit) => unit.moyenne), line.moyenne, line.creditsAcquis, line.creditsTotal, line.mention, DECISION_LABELS[line.decision] ?? line.decision]),
    ]);
  return (
    <Modal wide title={data ? `${data.classe.nom} · ${semesterLabel(semestre)}` : "Résultats"} onClose={onClose}>
      {!data && <p className="empty-state">{results.error || "Calcul des résultats..."}</p>}
      {data && (
        <div className="expense-detail">
          <div className="expense-detail-head">
            <Badge tone={closed ? "ok" : "wait"}>{closed ? "Délibération clôturée" : "Résultats provisoires"}</Badge>
            {closed && data.deliberation?.president && <span className="panel-subtitle">Président du jury : {data.deliberation.president}</span>}
          </div>
          {data.problemes.length > 0 && (
            <div className="expense-alert">
              <span>À régler avant de délibérer</span>
              <ul>{data.problemes.map((problem) => <li key={problem}>{problem}</li>)}</ul>
            </div>
          )}
          <dl className="expense-facts">
            <div><dt>Effectif</dt><dd>{data.synthese.effectif}</dd></div>
            <div><dt>{semestre === 0 ? "Admis" : "Semestre validé"}</dt><dd>{data.synthese.reussis} · {data.synthese.taux ?? "—"} %</dd></div>
            <div><dt>Moyenne de la classe</dt><dd>{number(data.synthese.moyenneClasse)}</dd></div>
            <div><dt>Plus forte / plus faible</dt><dd>{number(data.synthese.plusForte)} / {number(data.synthese.plusFaible)}</dd></div>
          </dl>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Étudiant</th>
                  {semestre === 0 ? <><th>S1</th><th>S2</th></> : units.map((unit) => <th key={unit.code} title={unit.nom}>{unit.code}</th>)}
                  <th>Moyenne</th>
                  <th>Crédits</th>
                  <th>Mention</th>
                  <th>Décision</th>
                  {closed && <th />}
                </tr>
              </thead>
              <tbody>
                {data.resultats.map((line) => (
                  <tr key={line.inscriptionId}>
                    <td>{line.rang ?? "—"}</td>
                    <td className="strong-cell">{personName(line.personne)}<small className="cell-detail">{line.personne.matricule ?? ""}</small></td>
                    {semestre === 0
                      ? [1, 2].map((index) => <td key={index}>{number(line.detail.semestres?.find((item) => item.semestre === index)?.moyenne)}</td>)
                      : (line.detail.unites ?? []).map((unit) => <td key={unit.code} className={unit.validee ? "" : "debt-action"} title={unit.acquise ? `Unité acquise en ${unit.acquise} : conservée, non repassée` : undefined}>{number(unit.moyenne)}{unit.acquise && <small className="cell-detail">acquise</small>}</td>)}
                    <td className="strong-cell">{number(line.moyenne)}</td>
                    <td>{line.creditsAcquis} / {line.creditsTotal}</td>
                    <td>{line.mention ?? "—"}</td>
                    <td><Badge tone={decisionTone(line.decision)}>{DECISION_LABELS[line.decision] ?? line.decision}</Badge></td>
                    {closed && <td className="action-group"><button className="row-action" disabled={action.busy} onClick={() => void (semestre === 0 ? yearDocuments("releve", line.inscriptionId) : reports(line.inscriptionId))}>{semestre === 0 ? "Relevé" : "Bulletin"}</button>{semestre === 0 && line.decision === "ADMIS" && <button className="row-action" disabled={action.busy} onClick={() => void yearDocuments("attestation", line.inscriptionId)}>Attestation</button>}</td>}
                  </tr>
                ))}
                {!data.resultats.length && <Empty columns={8}>Aucun étudiant.</Empty>}
              </tbody>
            </table>
          </div>
          {action.error && !closing && <p className="form-error">{action.error}</p>}
          {!closing && (
            <div className="form-actions expense-actions">
              <button className="secondary-button" onClick={() => exportCsv()}>Exporter en PDF</button>
              {closed && <button className="secondary-button" disabled={action.busy} onClick={() => void minutes()}>Procès-verbal (PDF)</button>}
              {closed && semestre !== 0 && <button className="secondary-button" disabled={action.busy} onClick={() => void reports()}>Tous les bulletins (PDF)</button>}
              {closed && semestre === 0 && <button className="secondary-button" disabled={action.busy} onClick={() => void yearDocuments("releve")}>Relevés annuels (PDF)</button>}
              {closed && semestre === 0 && <button className="secondary-button" disabled={action.busy} onClick={() => void yearDocuments("attestation")}>Attestations de réussite (PDF)</button>}
              {closed && semestre === 0 && <button className="secondary-button" disabled={action.busy} onClick={() => void yearDocuments("diplome")}>Diplômes (PDF)</button>}
              {closed && editable && <button className="danger-button" onClick={() => void reopen()}>Rouvrir</button>}
              {closed && semestre === 0 && editable && <button className="primary-button compact" onClick={() => setPromoting(true)}>Passage et réinscriptions</button>}
              {!closed && editable && <button className="primary-button compact" disabled={data.problemes.length > 0} title={data.problemes.length ? "Réglez d'abord les points signalés" : undefined} onClick={() => { action.setError(""); setClosing(true); }}>Clôturer la délibération</button>}
            </div>
          )}
          {closing && (
            <form className="entity-form expense-panel" onSubmit={close}>
              <p className="form-section-label">Clôture : les résultats deviennent définitifs et les notes sont verrouillées</p>
              <label>Président du jury<input required minLength={3} autoFocus {...form.bind("president")} /></label>
              <label>Membres du jury<input placeholder="Noms séparés par des virgules" {...form.bind("membres")} /></label>
              <label>Observations<textarea rows={2} maxLength={1000} {...form.bind("observations")} /></label>
              {action.error && <p className="form-error">{action.error}</p>}
              <FormActions busy={action.busy} label="Clôturer" onCancel={() => setClosing(false)} />
            </form>
          )}
        </div>
      )}
      {promoting && <PromotionModal classId={classId} onClose={() => setPromoting(false)} />}
    </Modal>
  );
}

type DebtSubject = { code: string; nom: string; coefficient: number; moyenne: number | null };
type DebtAttempt = { date: string; session: string | null; notes: Array<{ code: string; nom: string; note: number }>; moyenne: number | null; validee: boolean; saisiParNom: string };
type Debt = {
  id: string;
  personne: Student;
  filiere: string;
  niveau: string;
  annee: string;
  semestre: number;
  code: string;
  nom: string;
  credits: number;
  moyenne: number | null;
  statut: string;
  mode: string | null;
  matieres: DebtSubject[];
  tentatives: DebtAttempt[];
  dateAcquisition: string | null;
};
type Debts = { moyenneValidation: number; dettes: Debt[] };

// Résultat d'une épreuve de rattrapage : une note par matière repassée.
function RetakeModal({ debt, threshold, onClose, onSaved }: { debt: Debt; threshold: number; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(today());
  const [session, setSession] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const action = useAction();
  const filled = Object.values(notes).some((value) => value !== "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const result = await send<{ statut: string; moyenne: string | null }>(`/deliberations/dettes/${debt.id}/rattrapage`, "POST", { date, session, notes: Object.entries(notes).filter(([, note]) => note !== "").map(([code, note]) => ({ code, note })) }, true);
      toast(result.statut === "ACQUISE" ? `${debt.code} est acquise : ${debt.credits} crédit(s) rattrapé(s).` : `Moyenne de l'unité : ${number(result.moyenne)}. ${debt.code} reste à rattraper.`, result.statut === "ACQUISE" ? "success" : "info");
      onSaved();
      onClose();
    });
  };
  return (
    <Modal title={`Rattrapage · ${debt.code} ${debt.nom}`} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">{personName(debt.personne)} · {debt.filiere} {debt.niveau} ({debt.annee}). Saisissez la note des matières repassées : une note ne remplace l&apos;ancienne que si elle est meilleure, et l&apos;unité est acquise dès que sa moyenne atteint {number(threshold)}/20.</p>
        <div className="form-grid">
          <label>Date de l&apos;épreuve<input required type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Session<input maxLength={120} placeholder="Ex. session de septembre" value={session} onChange={(event) => setSession(event.target.value)} /></label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Matière</th><th>Coefficient</th><th>Moyenne actuelle</th><th>Note du rattrapage (/20)</th></tr></thead>
            <tbody>
              {debt.matieres.map((subject) => (
                <tr key={subject.code}>
                  <td className="strong-cell">{subject.nom}<small className="cell-detail">{subject.code}</small></td>
                  <td>{number(subject.coefficient)}</td>
                  <td>{number(subject.moyenne)}</td>
                  <td><span className="grade-cell"><input type="number" min="0" max="20" step="0.25" aria-label={`Note de rattrapage · ${subject.nom}`} value={notes[subject.code] ?? ""} onChange={(event) => setNotes({ ...notes, [subject.code]: event.target.value })} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {debt.tentatives.length > 0 && (
          <p className="panel-subtitle">Déjà passé : {debt.tentatives.map((attempt) => `${formatDate(attempt.date)}${attempt.session ? ` (${attempt.session})` : ""} · moyenne ${number(attempt.moyenne)}`).join(" ; ")}.</p>
        )}
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} disabled={!filled} label="Enregistrer le rattrapage" onCancel={onClose} />
      </form>
    </Modal>
  );
}

// Unités dues par les étudiants admis avec dettes, jusqu'à leur rattrapage.
function DebtsPanel({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const [status, setStatus] = useState("DETTES");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const debts = useLoad<Debts>(`/deliberations/dettes?statut=${status}${query ? `&q=${encodeURIComponent(query)}` : ""}`, signal);
  const [retaking, setRetaking] = useState<Debt | null>(null);
  const list = debts.data?.dettes ?? [];
  const due = list.filter((item) => item.statut === "DETTE");
  const exportPdf = () =>
    downloadPdf("credits-a-rattraper.pdf", "Crédits à rattraper", status === "RATTRAPEES" ? "Unités rattrapées" : "Unités dues par les étudiants admis avec dettes", [
      ["Matricule", "Nom", "Prénom", "Filière", "Niveau", "Année", "Unité", "Crédits", "Moyenne", "État"],
      ...list.map((item) => [item.personne.matricule, item.personne.nom, item.personne.prenom, item.filiere, item.niveau, item.annee, `${item.code} ${item.nom}`, item.credits, number(item.moyenne), item.statut === "DETTE" ? "À rattraper" : "Rattrapée"]),
    ]);
  return (
    <Panel
      eyebrow="Admis avec dettes"
      title={debts.data ? `${due.length} unité(s) à rattraper · ${due.reduce((total, item) => total + item.credits, 0)} crédit(s) · ${new Set(due.map((item) => item.personne.id)).size} étudiant(s)` : "Crédits à rattraper"}
      subtitle="Un étudiant admis avec dettes passe en année supérieure et repasse les unités qui lui manquent. Tant qu'il en reste, son diplôme ne peut pas être délivré."
      actions={<button className="outline-button small" disabled={!list.length} onClick={exportPdf}>Exporter en PDF</button>}
    >
      <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}>
        <select className="expense-select" aria-label="État" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="DETTES">À rattraper</option>
          <option value="RATTRAPEES">Rattrapées</option>
          <option value="TOUTES">Toutes</option>
        </select>
        <input type="search" placeholder="Nom, prénom ou matricule…" aria-label="Rechercher un étudiant" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="outline-button small">Rechercher</button>
      </form>
      {debts.error && <p className="form-error">{debts.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Étudiant</th><th>Parcours</th><th>Unité d&apos;enseignement</th><th>Crédits</th><th>Moyenne</th><th>État</th><th /></tr></thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id}>
                <td className="strong-cell">{personName(item.personne)}<small className="cell-detail">{item.personne.matricule ?? ""}</small></td>
                <td>{item.filiere}<small className="cell-detail">{item.niveau} · {item.annee}</small></td>
                <td>{item.code} · {item.nom}<small className="cell-detail">Semestre {item.semestre} · {item.matieres.length} matière(s)</small></td>
                <td>{item.credits}</td>
                <td>{number(item.moyenne)}</td>
                <td>
                  <Badge tone={item.statut === "DETTE" ? "wait" : "ok"}>{item.statut === "DETTE" ? "À rattraper" : `Rattrapée${item.dateAcquisition ? ` le ${formatDate(item.dateAcquisition)}` : ""}`}</Badge>
                  {item.tentatives.length > 0 && <small className="cell-detail">{item.tentatives.length} épreuve(s) passée(s)</small>}
                </td>
                <td>{canEdit && item.statut === "DETTE" && <button className="row-action" onClick={() => setRetaking(item)}>Saisir le rattrapage</button>}</td>
              </tr>
            ))}
            {!list.length && <Empty columns={7}>{debts.data ? (status === "RATTRAPEES" ? "Aucune unité rattrapée." : "Aucun crédit à rattraper.") : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
      {retaking && <RetakeModal debt={retaking} threshold={debts.data?.moyenneValidation ?? 10} onClose={() => setRetaking(null)} onSaved={debts.reload} />}
    </Panel>
  );
}

export function AcademicResultsPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "deliberations", "edit");
  const [tab, setTab] = useState<"classes" | "dettes">("classes");
  const [yearId, setYearId] = useState("");
  const board = useLoad<Board>(`/deliberations${yearId ? `?anneeId=${yearId}` : ""}`, refreshSignal);
  const [open, setOpen] = useState<{ classId: string; semestre: number } | null>(null);
  const cell = (item: Board["classes"][number], semestre: number) => {
    if (semestre !== 0 && !item.semestres.includes(semestre)) return <small className="cell-detail">Aucune matière</small>;
    const closed = item.deliberations.some((deliberation) => deliberation.semestre === semestre && deliberation.statut === "CLOTUREE");
    return (
      <button className="row-action" onClick={() => setOpen({ classId: item.id, semestre })}>
        <Badge tone={closed ? "ok" : "wait"}>{closed ? "Clôturée" : "À délibérer"}</Badge>
      </button>
    );
  };
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Délibérations" text="Résultats de chaque classe par semestre et sur l'année : contrôle, clôture, procès-verbal, bulletins, relevés, attestations, diplômes, passage et crédits à rattraper.">
        <select className="expense-select" aria-label="Année académique" value={board.data?.annee?.id ?? ""} onChange={(event) => setYearId(event.target.value)}>
          {(board.data?.annees ?? []).map((year) => <option key={year.id} value={year.id}>{year.libelle}{year.statut === "CLOTUREE" ? " (clôturée)" : ""}</option>)}
          {!board.data?.annees.length && <option value="">Aucune année</option>}
        </select>
      </PageIntro>
      {board.error && <p className="form-error">{board.error}</p>}
      <Tabs label="Rubrique" value={tab} onChange={setTab} tabs={[["classes", "Délibérations par classe"], ["dettes", "Crédits à rattraper"]]} />
      {tab === "dettes" && <DebtsPanel canEdit={canEdit} signal={refreshSignal} />}
      {tab === "classes" && <Panel eyebrow={board.data?.annee ? `Année ${board.data.annee.libelle}` : "Délibérations"} title={`${board.data?.classes.length ?? "--"} classe(s)`} subtitle="Une délibération ne se clôture que lorsque toutes les notes du semestre sont saisies et validées.">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Classe</th><th>Filière</th><th>Effectif</th><th>Semestre 1</th><th>Semestre 2</th><th>Annuel</th></tr></thead>
            <tbody>
              {(board.data?.classes ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="strong-cell">{item.nom}</td>
                  <td>{item.filiere}</td>
                  <td>{item.effectif}</td>
                  <td>{cell(item, 1)}</td>
                  <td>{cell(item, 2)}</td>
                  <td>{cell(item, 0)}</td>
                </tr>
              ))}
              {!board.data?.classes.length && <Empty columns={6}>{board.data ? "Aucune classe pour cette année." : "Chargement..."}</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>}
      {open && <ResultsModal key={`${open.classId}:${open.semestre}`} classId={open.classId} semestre={open.semestre} canEdit={canEdit} onClose={() => setOpen(null)} onChanged={board.reload} />}
    </div>
  );
}

// ---------- Statistiques académiques ----------

type Distribution = Array<{ libelle: string; total: number }>;
type RateLine = { effectif: number; reussis: number; taux: number | null; moyenne: number | null; admisAvecDettes: number; ajournes: number } | null;
type Stats = {
  annee: AcademicYear | null;
  annees: AcademicYear[];
  evolution: Array<{ annee: string; inscrits: number }>;
  effectifs?: { inscrits: number; actifs: number; abandons: number; tauxAbandon: number | null; boursiers: number; enClasse: number; sansClasse: number; sansFiliere: number; parNiveau: Distribution; parFiliere: Distribution; parPole: Distribution; parSexe: Distribution };
  reussiteParPole?: Array<{ pole: string; effectif: number; reussis: number; taux: number | null }>;
  dettes?: { etudiants: number; unites: number; credits: number };
  reussite?: Array<{ classeId: string; classe: string; filiere: string; pole: string; niveau: string; effectif: number; semestre1: RateLine; semestre2: RateLine; annuel: RateLine }>;
  assiduite?: { heuresTenues: number; tauxAbsence: number | null; tauxAbsenceInjustifiee: number | null };
  enseignement?: { cours: number; coursSansEnseignant: number; enseignants: number; etudiantsParEnseignant: number | null; heuresPrevues: number; heuresFaites: number; avancement: number | null };
};

function Bars({ title, items }: { title: string; items: Distribution }) {
  const max = Math.max(1, ...items.map((item) => item.total));
  return (
    <div className="stat-bars">
      <h4>{title}</h4>
      {items.map((item) => (
        <div key={item.libelle}>
          <span>{item.libelle}</span>
          <i><b style={{ width: `${(item.total / max) * 100}%` }} /></i>
          <strong>{item.total}</strong>
        </div>
      ))}
      {!items.length && <p className="panel-subtitle">Aucune donnée.</p>}
    </div>
  );
}

export function AcademicStatsPage({ refreshSignal }: { refreshSignal: number }) {
  const [yearId, setYearId] = useState("");
  const [pole, setPole] = useState("");
  const stats = useLoad<Stats>(`/deliberations/statistiques${yearId ? `?anneeId=${yearId}` : ""}`, refreshSignal);
  const data = stats.data;
  const poles = [...new Set((data?.reussite ?? []).map((line) => line.pole))].sort();
  const success = (data?.reussite ?? []).filter((line) => !pole || line.pole === pole);
  const rate = (line: RateLine) => (line ? `${line.taux ?? "—"} % · moy. ${number(line.moyenne)}` : "—");
  const percent = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${value} %`);
  const exportPdf = () =>
    data?.reussite &&
    void tablePdf({
      title: "Statistiques académiques",
      subtitle: `Réussite par classe · ${data.annee?.libelle ?? ""}${pole ? ` · ${pole}` : ""}`,
      fileName: `statistiques-${data.annee?.libelle ?? ""}.pdf`,
      columns: [
        { label: "Classe", width: 28 }, { label: "Filière", width: 32 }, { label: "Pôle", width: 26 }, { label: "Niveau", width: 13, align: "center" }, { label: "Effectif", width: 15, align: "right" },
        { label: "S1 validés", width: 18, align: "right" }, { label: "S1 taux", width: 16, align: "right" }, { label: "S2 validés", width: 18, align: "right" }, { label: "S2 taux", width: 16, align: "right" },
        { label: "Admis", width: 14, align: "right" }, { label: "Avec dettes", width: 19, align: "right" }, { label: "Ajournés", width: 16, align: "right" }, { label: "Taux annuel", width: 19, align: "right" }, { label: "Moyenne", width: 17, align: "right" },
      ],
      rows: success.map((line) => [line.classe, line.filiere, line.pole, line.niveau, line.effectif, line.semestre1?.reussis, percent(line.semestre1?.taux), line.semestre2?.reussis, percent(line.semestre2?.taux), line.annuel?.reussis, line.annuel?.admisAvecDettes, line.annuel?.ajournes, percent(line.annuel?.taux), number(line.annuel?.moyenne)]),
    });
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Statistiques académiques" text="Effectifs, réussite, assiduité et encadrement de l'année : les chiffres à suivre et à transmettre au ministère.">
        <select className="expense-select" aria-label="Année académique" value={data?.annee?.id ?? ""} onChange={(event) => setYearId(event.target.value)}>
          {(data?.annees ?? []).map((year) => <option key={year.id} value={year.id}>{year.libelle}</option>)}
          {!data?.annees.length && <option value="">Aucune année</option>}
        </select>
        <button className="outline-button small" disabled={!data?.reussite} onClick={() => exportPdf()}>Exporter en PDF</button>
      </PageIntro>
      {stats.error && <p className="form-error">{stats.error}</p>}
      {data && !data.annee && <Panel title="Aucune année académique">Ouvrez une année dans « Structure académique ».</Panel>}
      {data?.effectifs && data.assiduite && data.enseignement && (
        <>
          <div className="stats-grid">
            <article className="stat-card blue"><span>Étudiants inscrits</span><strong>{data.effectifs.actifs}</strong><p>{data.effectifs.boursiers} boursier(s) · {data.effectifs.sansClasse} sans classe</p></article>
            <article className="stat-card orange"><span>Abandons</span><strong>{data.effectifs.tauxAbandon ?? 0} %</strong><p>{data.effectifs.abandons} sur {data.effectifs.inscrits} inscription(s)</p></article>
            <article className="stat-card mint"><span>Absences des étudiants</span><strong>{data.assiduite.tauxAbsence ?? 0} %</strong><p>Dont {data.assiduite.tauxAbsenceInjustifiee ?? 0} % non justifiées · {data.assiduite.heuresTenues} h tenues</p></article>
            <article className="stat-card violet"><span>Avancement des programmes</span><strong>{data.enseignement.avancement ?? 0} %</strong><p>{data.enseignement.heuresFaites} h faites sur {data.enseignement.heuresPrevues} h prévues</p></article>
            <article className="stat-card blue"><span>Enseignants en charge</span><strong>{data.enseignement.enseignants}</strong><p>{data.enseignement.etudiantsParEnseignant ?? "—"} étudiant(s) par enseignant</p></article>
            <article className={`stat-card ${data.enseignement.coursSansEnseignant ? "orange" : "mint"}`}><span>Cours sans enseignant</span><strong>{data.enseignement.coursSansEnseignant}</strong><p>Sur {data.enseignement.cours} cours de l&apos;année</p></article>
            <article className={`stat-card ${data.dettes?.unites ? "orange" : "mint"}`}><span>Crédits à rattraper</span><strong>{data.dettes?.credits ?? 0}</strong><p>{data.dettes?.unites ?? 0} unité(s) dues par {data.dettes?.etudiants ?? 0} étudiant(s) admis avec dettes</p></article>
            <article className={`stat-card ${data.effectifs.sansFiliere ? "orange" : "mint"}`}><span>Filières à rattacher</span><strong>{data.effectifs.sansFiliere}</strong><p>Inscription(s) dont la filière saisie n&apos;est pas dans le référentiel</p></article>
          </div>
          <Panel eyebrow="Effectifs" title="Répartition des étudiants">
            <div className="stat-columns">
              <Bars title="Par pôle" items={data.effectifs.parPole} />
              <Bars title="Par filière" items={data.effectifs.parFiliere} />
              <Bars title="Par niveau" items={data.effectifs.parNiveau} />
              <Bars title="Par sexe" items={data.effectifs.parSexe} />
              <Bars title="Inscriptions par année" items={data.evolution.map((item) => ({ libelle: item.annee, total: item.inscrits }))} />
            </div>
          </Panel>
          {Boolean(data.reussiteParPole?.length) && (
            <Panel eyebrow="Réussite" title="Admis sur l'année, par pôle" subtitle="Toutes les classes délibérées d'un pôle, admis avec dettes compris.">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Pôle</th><th>Étudiants délibérés</th><th>Admis</th><th>Taux de réussite</th></tr></thead>
                  <tbody>
                    {(data.reussiteParPole ?? []).map((line) => (
                      <tr key={line.pole}>
                        <td className="strong-cell">{line.pole}</td>
                        <td>{line.effectif}</td>
                        <td>{line.reussis}</td>
                        <td><Badge tone={(line.taux ?? 0) >= 50 ? "ok" : "bad"}>{line.taux ?? "—"} %</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          <Panel
            eyebrow="Réussite"
            title="Résultats par classe"
            subtitle="Calculés à partir des délibérations clôturées uniquement."
            actions={poles.length > 1 ? (
              <select className="expense-select" aria-label="Pôle" value={pole} onChange={(event) => setPole(event.target.value)}>
                <option value="">Tous les pôles</option>
                {poles.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            ) : undefined}
          >
            <div className="table-wrap">
              <table>
                <thead><tr><th>Classe</th><th>Effectif</th><th>Semestre 1</th><th>Semestre 2</th><th>Admis sur l&apos;année</th><th>Avec dettes</th><th>Ajournés</th></tr></thead>
                <tbody>
                  {success.map((line) => (
                    <tr key={line.classeId}>
                      <td className="strong-cell">{line.classe}<small className="cell-detail">{line.filiere} · {line.pole}</small></td>
                      <td>{line.effectif}</td>
                      <td>{rate(line.semestre1)}</td>
                      <td>{rate(line.semestre2)}</td>
                      <td>{line.annuel ? <Badge tone={(line.annuel.taux ?? 0) >= 50 ? "ok" : "bad"}>{line.annuel.reussis} · {line.annuel.taux ?? "—"} %</Badge> : "—"}</td>
                      <td>{line.annuel?.admisAvecDettes ?? "—"}</td>
                      <td>{line.annuel?.ajournes ?? "—"}</td>
                    </tr>
                  ))}
                  {!success.length && <Empty columns={7}>Aucune classe pour cette année.</Empty>}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
