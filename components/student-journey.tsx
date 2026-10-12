"use client";

import { useState } from "react";
import { DECISION_LABELS, Journey, enrollmentCertificateNumber, enrollmentCertificatePdf, journeyPdf, unitOutcome } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { navigateTo, pathForClass, pathForView } from "@/lib/routes";
import { formatDate } from "@/lib/types";
import { Badge, Empty, HubBack, PageIntro, Panel, number, personName, useAction, useLoad } from "@/components/ui-kit";

const decisionTone = (decision: string) => (["VALIDE", "ADMIS"].includes(decision) ? "ok" : decision === "ADMIS_AVEC_DETTES" ? "run" : decision === "INCOMPLET" ? "wait" : "bad");
const credits = (acquired: number, total: number) => `${acquired} / ${total}`;

// Parcours complet d'un étudiant : ses classes année par année, ses résultats,
// ses crédits et ses absences, avec le relevé cumulé de tout le cursus.
export function StudentJourneyPage({ personId, refreshSignal }: { personId: string; refreshSignal: number }) {
  const journey = useLoad<Journey>(`/deliberations/etudiants/${personId}/parcours`, refreshSignal);
  const [unitsOf, setUnitsOf] = useState<string | null>(null);
  const action = useAction();
  const data = journey.data;
  const years = data?.annees ?? [];
  const deliberated = years.filter((year) => year.semestres.length || year.resultat);
  const absences = years.reduce((total, year) => ({ total: total.total + year.absences.total, injustifiees: total.injustifiees + year.absences.injustifiees }), { total: 0, injustifiees: 0 });
  const owed = (data?.credits.dettes ?? []).reduce((total, debt) => total + debt.credits, 0);
  const back = () => (window.history.length > 1 ? window.history.back() : navigateTo(pathForView("Classes et étudiants")));
  const certificate = (year: Journey["annees"][number]) =>
    action.run(async () => {
      if (!data || !year.classe) return;
      const document = { etudiant: data.etudiant, annee: year.annee, niveau: year.niveau, filiere: year.filiere, classe: year.classe.nom };
      await enrollmentCertificatePdf(document, `certificat-scolarite-${data.etudiant.matricule ?? data.etudiant.nom}-${year.annee}.pdf`);
      logPrint({ typeDocument: "CERTIFICAT_SCOLARITE", mode: "PDF", dossierType: "inscription", dossierId: year.inscriptionId, libelle: `${personName(data.etudiant)} · ${year.classe.nom}`, reference: enrollmentCertificateNumber(document) });
    });
  const print = () =>
    action.run(async () => {
      if (!data) return;
      if (!deliberated.length) throw new Error("Aucune délibération clôturée : le relevé cumulé n'a encore rien à présenter.");
      const withheld = deliberated.find((year) => year.retenue);
      if (withheld) throw new Error(`${withheld.annee} · ${withheld.retenue}`);
      await journeyPdf(data, `releve-cumule-${data.etudiant.matricule ?? data.etudiant.nom}.pdf`);
      logPrint({ typeDocument: "RELEVE_NOTES", mode: "PDF", dossierType: "inscription", dossierId: deliberated[deliberated.length - 1].inscriptionId, libelle: `${personName(data.etudiant)} · relevé cumulé`, reference: data.etudiant.matricule });
    });
  return (
    <div className="content-scroll">
      <HubBack label="Retour" onBack={back} />
      <PageIntro
        eyebrow="Parcours de l'étudiant"
        title={data ? personName(data.etudiant) : "Étudiant"}
        text={data ? `Matricule ${data.etudiant.matricule ?? "non attribué"}${data.etudiant.dateNaissance ? ` · né(e) le ${formatDate(data.etudiant.dateNaissance)}` : ""}${data.etudiant.telephone ? ` · ${data.etudiant.telephone}` : ""}` : journey.error ? "" : "Chargement..."}
      >
        <button className="primary-button compact" disabled={action.busy || !data} onClick={() => void print()}>Relevé cumulé (PDF)</button>
      </PageIntro>
      {(journey.error || action.error) && <p className="form-error">{journey.error || action.error}</p>}
      {data && (
        <>
          <div className="stats-grid">
            <article className="stat-card blue"><span>Années suivies</span><strong>{years.length}</strong><p>{deliberated.length} délibérée(s)</p></article>
            <article className={`stat-card ${owed ? "orange" : "mint"}`}><span>Crédits acquis</span><strong>{data.credits.acquis}</strong><p>{owed ? `${owed} crédit(s) à rattraper` : "Aucun crédit à rattraper"}</p></article>
            <article className="stat-card violet"><span>Absences</span><strong>{number(absences.total, 1)} h</strong><p>dont {number(absences.injustifiees, 1)} h non justifiées</p></article>
          </div>
          {!years.length && <Panel title="Aucune inscription">Cette personne n&apos;a encore aucune inscription.</Panel>}
          {[...years].reverse().map((year) => {
            const open = unitsOf === year.inscriptionId;
            const hasUnits = year.semestres.some((semester) => semester.unites.length);
            return (
              <Panel
                key={year.inscriptionId}
                eyebrow={`Année ${year.annee}`}
                title={`${year.classe?.nom ?? "Sans classe"} · ${year.niveau} · ${year.filiere}`}
                subtitle={year.classe ? `Absences : ${number(year.absences.total, 1)} h, dont ${number(year.absences.injustifiees, 1)} h non justifiées.` : "Inscription pas encore affectée à une classe."}
                actions={
                  <>
                    {year.statut === "ABANDONNEE" && <Badge tone="bad">Abandon</Badge>}
                    {year.resultat ? <Badge tone={decisionTone(year.resultat.decision)}>{DECISION_LABELS[year.resultat.decision] ?? year.resultat.decision}</Badge> : <Badge tone="off">Année non délibérée</Badge>}
                    {hasUnits && <button className="outline-button small" aria-expanded={open} onClick={() => setUnitsOf(open ? null : year.inscriptionId)}>{open ? "Masquer les unités" : "Détail des unités"}</button>}
                    {year.classe && year.statut !== "ABANDONNEE" && <button className="outline-button small" disabled={action.busy} onClick={() => void certificate(year)}>Certificat de scolarité</button>}
                    {year.classe && <button className="outline-button small" onClick={() => navigateTo(pathForClass(year.classe!.id))}>Ouvrir la classe</button>}
                  </>
                }
              >
                {year.retenue && <p className="form-error">{year.retenue}</p>}
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Période</th><th>Moyenne</th><th>Crédits</th><th>Rang</th><th>Mention</th><th>Décision</th></tr></thead>
                    <tbody>
                      {year.semestres.map((semester) => (
                        <tr key={semester.semestre}>
                          <td>Semestre {semester.semestre}</td>
                          <td>{number(semester.moyenne)}</td>
                          <td>{credits(semester.creditsAcquis, semester.creditsTotal)}</td>
                          <td>—</td>
                          <td>—</td>
                          <td><Badge tone={decisionTone(semester.decision)}>{DECISION_LABELS[semester.decision] ?? semester.decision}</Badge></td>
                        </tr>
                      ))}
                      {year.resultat && (
                        <tr>
                          <td className="strong-cell">Année</td>
                          <td className="strong-cell">{number(year.resultat.moyenne)}</td>
                          <td>{credits(year.resultat.creditsAcquis, year.resultat.creditsTotal)}</td>
                          <td>{year.resultat.rang ? `${year.resultat.rang} sur ${year.resultat.effectif}` : "—"}</td>
                          <td>{year.resultat.mention ?? "—"}</td>
                          <td><Badge tone={decisionTone(year.resultat.decision)}>{DECISION_LABELS[year.resultat.decision] ?? year.resultat.decision}</Badge></td>
                        </tr>
                      )}
                      {!year.semestres.length && !year.resultat && <Empty columns={6}>Aucune délibération clôturée pour cette année.</Empty>}
                    </tbody>
                  </table>
                </div>
                {open && (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Semestre</th><th>Unité d&apos;enseignement</th><th>Crédits</th><th>Moyenne</th><th>Résultat</th></tr></thead>
                      <tbody>
                        {year.semestres.flatMap((semester) =>
                          semester.unites.map((unit) => (
                            <tr key={`${semester.semestre}:${unit.code}`}>
                              <td>S{semester.semestre}</td>
                              <td className="strong-cell">{unit.nom}<small className="cell-detail">{unit.code} · {unit.matieres.map((subject) => `${subject.nom} ${number(subject.moyenne)}`).join(" · ")}</small></td>
                              <td>{unit.credits}</td>
                              <td>{number(unit.moyenne)}</td>
                              <td><Badge tone={unit.statut === "ACQUISE" ? "ok" : unit.statut === "DETTE" ? "run" : "bad"}>{unitOutcome(unit)}</Badge></td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            );
          })}
          {Boolean(data.credits.dettes.length) && (
            <Panel eyebrow="Crédits à rattraper" title={`${data.credits.dettes.length} unité(s) encore due(s)`} subtitle="Le rattrapage se saisit dans « Délibérations ».">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Année</th><th>Niveau</th><th>Unité d&apos;enseignement</th><th>Crédits</th></tr></thead>
                  <tbody>
                    {data.credits.dettes.map((debt) => (
                      <tr key={`${debt.annee}:${debt.code}`}><td>{debt.annee}</td><td>{debt.niveau}</td><td className="strong-cell">{debt.nom}<small className="cell-detail">{debt.code}</small></td><td>{debt.credits}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
