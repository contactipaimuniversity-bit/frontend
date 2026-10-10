"use client";

import { FormEvent, useState } from "react";
import { askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { DECISION_LABELS, GradeReport, MinutesData, WithheldReport, deliberationMinutesPdf, gradeReportsPdf } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { User } from "@/lib/types";
import { AcademicYear } from "@/components/academic-structure-page";
import { Student } from "@/components/academic-classes-page";
import { Badge, Empty, FormActions, Modal, PageIntro, Panel, downloadCsv, number, personName, send, useAction, useForm, useLoad } from "@/components/ui-kit";

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
  detail: { unites?: Array<{ code: string; nom: string; moyenne: number | null; validee: boolean }>; semestres?: Array<{ semestre: number; moyenne: number | null; creditsAcquis: number; creditsTotal: number }> };
};
type Results = Omit<MinutesData, "classe" | "resultats" | "synthese"> & {
  classe: MinutesData["classe"] & { id: string; anneeCloturee: boolean };
  statut: string;
  problemes: string[];
  resultats: ResultLine[];
  synthese: MinutesData["synthese"] & { plusForte: number | null; plusFaible: number | null };
};
type Promotion = { anneeSuivante: string; anneeSuivanteOuverte: boolean; etudiants: Array<{ inscriptionId: string; personne: Student; decision: string; niveauSuivant: string | null; dejaInscrit: boolean }> };

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
        <p className="panel-subtitle">Chaque réinscription passe par le circuit normal : les pièces et les frais du niveau sont créés, l&apos;étudiant devra régler sa scolarité.</p>
        {promotion.data && !promotion.data.anneeSuivanteOuverte && <p className="form-error">Ouvrez d&apos;abord l&apos;année {promotion.data.anneeSuivante} dans « Structure académique ».</p>}
        {promotion.error && <p className="form-error">{promotion.error}</p>}
        <div className="table-wrap pick-list">
          <table>
            <thead><tr><th /><th>Étudiant</th><th>Décision</th><th>Année suivante</th></tr></thead>
            <tbody>
              {(promotion.data?.etudiants ?? []).map((item) => {
                const available = Boolean(item.niveauSuivant) && !item.dejaInscrit;
                return (
                  <tr key={item.inscriptionId}>
                    <td><input type="checkbox" aria-label={`Réinscrire ${personName(item.personne)}`} disabled={!available} checked={available && selection.has(item.inscriptionId)} onChange={() => toggle(item.inscriptionId)} /></td>
                    <td className="strong-cell">{personName(item.personne)}</td>
                    <td><Badge tone={decisionTone(item.decision)}>{DECISION_LABELS[item.decision] ?? item.decision}</Badge></td>
                    <td>{item.dejaInscrit ? "Déjà réinscrit" : item.niveauSuivant ? `Inscription en ${item.niveauSuivant}` : "Fin de cycle"}</td>
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
  const minutes = () =>
    action.run(async () => {
      if (!data) return;
      await deliberationMinutesPdf(data);
      logPrint({ typeDocument: "PV_DELIBERATION", mode: "PDF", libelle: `${data.classe.nom} · ${semesterLabel(semestre)} · ${data.classe.annee}` });
    });
  const exportCsv = () =>
    data &&
    downloadCsv(`resultats-${data.classe.nom}-${semestre}.csv`, [
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
                      : (line.detail.unites ?? []).map((unit) => <td key={unit.code} className={unit.validee ? "" : "debt-action"}>{number(unit.moyenne)}</td>)}
                    <td className="strong-cell">{number(line.moyenne)}</td>
                    <td>{line.creditsAcquis} / {line.creditsTotal}</td>
                    <td>{line.mention ?? "—"}</td>
                    <td><Badge tone={decisionTone(line.decision)}>{DECISION_LABELS[line.decision] ?? line.decision}</Badge></td>
                    {closed && <td><button className="row-action" disabled={action.busy} onClick={() => void reports(line.inscriptionId)}>Bulletin</button></td>}
                  </tr>
                ))}
                {!data.resultats.length && <Empty columns={8}>Aucun étudiant.</Empty>}
              </tbody>
            </table>
          </div>
          {action.error && !closing && <p className="form-error">{action.error}</p>}
          {!closing && (
            <div className="form-actions expense-actions">
              <button className="secondary-button" onClick={() => exportCsv()}>Exporter (Excel)</button>
              {closed && <button className="secondary-button" disabled={action.busy} onClick={() => void minutes()}>Procès-verbal (PDF)</button>}
              {closed && <button className="secondary-button" disabled={action.busy} onClick={() => void reports()}>Tous les bulletins (PDF)</button>}
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

export function AcademicResultsPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "deliberations", "edit");
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
      <PageIntro eyebrow="Académique" title="Délibérations" text="Résultats de chaque classe par semestre et sur l'année : contrôle, clôture, procès-verbal, bulletins et passage.">
        <select className="expense-select" aria-label="Année académique" value={board.data?.annee?.id ?? ""} onChange={(event) => setYearId(event.target.value)}>
          {(board.data?.annees ?? []).map((year) => <option key={year.id} value={year.id}>{year.libelle}{year.statut === "CLOTUREE" ? " (clôturée)" : ""}</option>)}
          {!board.data?.annees.length && <option value="">Aucune année</option>}
        </select>
      </PageIntro>
      {board.error && <p className="form-error">{board.error}</p>}
      <Panel eyebrow={board.data?.annee ? `Année ${board.data.annee.libelle}` : "Délibérations"} title={`${board.data?.classes.length ?? "--"} classe(s)`} subtitle="Une délibération ne se clôture que lorsque toutes les notes du semestre sont saisies et validées.">
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
      </Panel>
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
  effectifs?: { inscrits: number; actifs: number; abandons: number; tauxAbandon: number | null; boursiers: number; enClasse: number; sansClasse: number; parNiveau: Distribution; parFiliere: Distribution; parSexe: Distribution };
  reussite?: Array<{ classeId: string; classe: string; filiere: string; niveau: string; effectif: number; semestre1: RateLine; semestre2: RateLine; annuel: RateLine }>;
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
  const stats = useLoad<Stats>(`/deliberations/statistiques${yearId ? `?anneeId=${yearId}` : ""}`, refreshSignal);
  const data = stats.data;
  const rate = (line: RateLine) => (line ? `${line.taux ?? "—"} % · moy. ${number(line.moyenne)}` : "—");
  const exportCsv = () =>
    data?.reussite &&
    downloadCsv(`statistiques-${data.annee?.libelle ?? ""}.csv`, [
      ["Classe", "Filière", "Niveau", "Effectif", "S1 validés", "S1 taux", "S2 validés", "S2 taux", "Admis", "Dont avec dettes", "Ajournés", "Taux annuel", "Moyenne annuelle"],
      ...data.reussite.map((line) => [line.classe, line.filiere, line.niveau, line.effectif, line.semestre1?.reussis, line.semestre1?.taux, line.semestre2?.reussis, line.semestre2?.taux, line.annuel?.reussis, line.annuel?.admisAvecDettes, line.annuel?.ajournes, line.annuel?.taux, line.annuel?.moyenne]),
    ]);
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Statistiques académiques" text="Effectifs, réussite, assiduité et encadrement de l'année : les chiffres à suivre et à transmettre au ministère.">
        <select className="expense-select" aria-label="Année académique" value={data?.annee?.id ?? ""} onChange={(event) => setYearId(event.target.value)}>
          {(data?.annees ?? []).map((year) => <option key={year.id} value={year.id}>{year.libelle}</option>)}
          {!data?.annees.length && <option value="">Aucune année</option>}
        </select>
        <button className="outline-button small" onClick={() => exportCsv()}>Exporter (Excel)</button>
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
          </div>
          <Panel eyebrow="Effectifs" title="Répartition des étudiants">
            <div className="stat-columns">
              <Bars title="Par filière" items={data.effectifs.parFiliere} />
              <Bars title="Par niveau" items={data.effectifs.parNiveau} />
              <Bars title="Par sexe" items={data.effectifs.parSexe} />
              <Bars title="Inscriptions par année" items={data.evolution.map((item) => ({ libelle: item.annee, total: item.inscrits }))} />
            </div>
          </Panel>
          <Panel eyebrow="Réussite" title="Résultats par classe" subtitle="Calculés à partir des délibérations clôturées uniquement.">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Classe</th><th>Effectif</th><th>Semestre 1</th><th>Semestre 2</th><th>Admis sur l&apos;année</th><th>Avec dettes</th><th>Ajournés</th></tr></thead>
                <tbody>
                  {(data.reussite ?? []).map((line) => (
                    <tr key={line.classeId}>
                      <td className="strong-cell">{line.classe}<small className="cell-detail">{line.filiere}</small></td>
                      <td>{line.effectif}</td>
                      <td>{rate(line.semestre1)}</td>
                      <td>{rate(line.semestre2)}</td>
                      <td>{line.annuel ? <Badge tone={(line.annuel.taux ?? 0) >= 50 ? "ok" : "bad"}>{line.annuel.reussis} · {line.annuel.taux ?? "—"} %</Badge> : "—"}</td>
                      <td>{line.annuel?.admisAvecDettes ?? "—"}</td>
                      <td>{line.annuel?.ajournes ?? "—"}</td>
                    </tr>
                  ))}
                  {!data.reussite?.length && <Empty columns={7}>Aucune classe pour cette année.</Empty>}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
