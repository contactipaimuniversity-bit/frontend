"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ReceiptSheet } from "@/components/etudiant/student-receipt";
import { gradeTone } from "@/components/etudiant/student-screens";
import { EmptyState, Loaded, Pill, ScreenHeader, Section } from "@/components/etudiant/student-ui";
import { FeePayment, Fees, Grade, Grades, StudentProfile, money, shortDate, useStudentResource } from "@/lib/student-api";

const DECISIONS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" }> = {
  VALIDE: { label: "Validé", tone: "ok" },
  ADMIS: { label: "Admis", tone: "ok" },
  ADMIS_AVEC_DETTES: { label: "Admis avec dettes", tone: "warn" },
  AJOURNE: { label: "Ajourné", tone: "bad" },
  NON_VALIDE: { label: "Non validé", tone: "bad" },
  REDOUBLE: { label: "Redouble", tone: "bad" },
  EXCLU: { label: "Exclu", tone: "bad" },
};

// ---------- Notes ----------

type SubjectGroup = { id: string; nom: string; coefficient: number; notes: Grade[] };
type UnitGroup = { code: string; nom: string; credits: number; semestre: number; subjects: SubjectGroup[] };

function groupGrades(notes: Grade[]) {
  const units = new Map<string, UnitGroup>();
  for (const note of notes) {
    const unit = units.get(note.ue.code) ?? { ...note.ue, subjects: [] };
    units.set(note.ue.code, unit);
    let subject = unit.subjects.find((item) => item.id === note.matiere.id);
    if (!subject) {
      subject = { id: note.matiere.id, nom: note.matiere.nom, coefficient: note.matiere.coefficient, notes: [] };
      unit.subjects.push(subject);
    }
    subject.notes.push(note);
  }
  return [...units.values()].sort((first, second) => first.semestre - second.semestre || first.code.localeCompare(second.code));
}

export function GradesScreen() {
  const grades = useStudentResource<Grades>("/etudiant/moi/notes");
  const [semester, setSemester] = useState(1);
  const groups = useMemo(() => groupGrades(grades.data?.notes ?? []), [grades.data]);
  const visible = groups.filter((unit) => unit.semestre === semester);

  return (
    <div className="stu-screen">
      <ScreenHeader title="Notes" subtitle="Épreuves validées uniquement." />
      <div className="stu-segmented">
        {[1, 2].map((item) => (
          <button key={item} type="button" className={semester === item ? "on" : ""} onClick={() => setSemester(item)}>Semestre {item}</button>
        ))}
      </div>
      <Loaded resource={grades} lines={5}>
        {(data) => {
          const result = data.resultats.find((item) => item.semestre === semester);
          return (
            <>
              {result?.disponible ? (
                <section className="stu-total">
                  <div className="stu-total-head">
                    <div>
                      <span>Moyenne du semestre</span>
                      <strong>{result.resultat.moyenne !== null ? result.resultat.moyenne.toFixed(2) : "—"}<small>/20</small></strong>
                    </div>
                    {DECISIONS[result.resultat.decision] ? <Pill tone={DECISIONS[result.resultat.decision].tone}>{DECISIONS[result.resultat.decision].label}</Pill> : <Pill tone="info">{result.resultat.decision}</Pill>}
                  </div>
                  <dl className="stu-figures">
                    <div><dt>Crédits</dt><dd>{result.resultat.creditsAcquis}/{result.resultat.creditsTotal}</dd></div>
                    <div><dt>Rang</dt><dd>{result.resultat.rang ? `${result.resultat.rang}${result.resultat.rang === 1 ? "er" : "e"} / ${result.classe.effectif}` : "—"}</dd></div>
                    <div><dt>Moy. classe</dt><dd>{result.classe.moyenne !== null ? result.classe.moyenne.toFixed(2) : "—"}</dd></div>
                  </dl>
                  {result.resultat.mention && <p className="stu-muted">Mention {result.resultat.mention}</p>}
                </section>
              ) : (
                result && (
                  <div className="stu-info">
                    <p>{result.message}</p>
                  </div>
                )
              )}

              {visible.length ? (
                visible.map((unit) => (
                  <Section key={unit.code} title={`${unit.code} · ${unit.nom}`} action={<span className="stu-muted">{unit.credits} crédits</span>}>
                    <div className="stu-card stu-rows">
                      {unit.subjects.map((subject) => (
                        <div key={subject.id} className="stu-subject">
                          <div className="stu-subject-head">
                            <strong>{subject.nom}</strong>
                            <span>coef. {subject.coefficient}</span>
                          </div>
                          {subject.notes.map((note) => (
                            <div key={note.id} className="stu-row stu-row-compact">
                              <div>
                                <span>{note.evaluation.libelle}</span>
                                {note.evaluation.date && <small>{shortDate(note.evaluation.date)}</small>}
                              </div>
                              <b className={gradeTone(note.valeur, note.evaluation.bareme)}>{note.absent ? "Absent" : note.valeur === null ? "—" : `${note.valeur}/${note.evaluation.bareme}`}</b>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </Section>
                ))
              ) : (
                <EmptyState icon={null} title={`Aucune note validée pour le semestre ${semester}.`} />
              )}
            </>
          );
        }}
      </Loaded>
    </div>
  );
}

// ---------- Paiements ----------

function lineStatus(line: { reste: number; paye: number; dateLimite?: string | null }) {
  if (line.reste <= 0) return { label: "Payé", tone: "ok" as const };
  if (line.dateLimite && new Date(line.dateLimite).getTime() < Date.now()) return { label: "En retard", tone: "bad" as const };
  if (line.paye > 0) return { label: "Partiel", tone: "warn" as const };
  return { label: "À venir", tone: "muted" as const };
}

const MODES: Record<string, string> = { ESPECES: "Espèces", MOBILE_MONEY: "Mobile money", VIREMENT: "Virement", CHEQUE: "Chèque" };

export function FeesScreen() {
  const fees = useStudentResource<Fees>("/etudiant/moi/scolarite");
  const [tab, setTab] = useState<"echeancier" | "historique">("echeancier");
  const [receipt, setReceipt] = useState<FeePayment | null>(null);
  const profile = useStudentResource<StudentProfile>("/etudiant/moi");

  // Arrivée depuis la notification « Paiement reçu » : le reçu s'ouvre directement.
  const payments = fees.data?.paiements;
  const settled = !fees.loading;
  useEffect(() => {
    // Attend la réponse du serveur : la copie gardée sur l'appareil n'a pas encore ce paiement.
    if (!payments || !settled) return;
    const wanted = new URLSearchParams(window.location.search).get("recu");
    if (!wanted) return;
    const found = payments.find((payment) => payment.id === wanted);
    window.history.replaceState(null, "", "/etudiant/paiements");
    if (!found) return;
    queueMicrotask(() => {
      setTab("historique");
      setReceipt(found);
    });
  }, [payments, settled]);

  return (
    <div className="stu-screen">
      <ScreenHeader title="Paiements" subtitle={fees.data ? `Année ${fees.data.anneeScolaire}` : undefined} />
      <Loaded resource={fees} lines={5}>
        {(data) => {
          const situation = data.situation;
          const lines = situation ? [...(situation.fraisBourse ?? []), ...situation.fraisInscription, ...situation.mensualites, ...situation.annexes] : [];
          const monthIds = new Set(situation?.mensualites.map((line) => line.id) ?? []);
          // Prix normal d'un mois, barré à côté du prix réduit par la bourse.
          const normal = data.tarifNormal ?? null;
          const total = lines.reduce((sum, line) => sum + line.montant, 0);
          const paid = lines.reduce((sum, line) => sum + line.paye, 0);
          const ratio = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
          const late = lines.filter((line) => lineStatus(line).tone === "bad");
          return (
            <>
              <section className="stu-total">
                <div className="stu-total-head">
                  <div>
                    <span>Reste à payer</span>
                    <strong>{situation ? money(situation.resteTotal) : "—"}</strong>
                  </div>
                </div>
                <div className="stu-progress" role="progressbar" aria-valuenow={ratio} aria-valuemin={0} aria-valuemax={100} aria-label="Part déjà payée">
                  <span style={{ width: `${ratio}%` }} />
                </div>
                <dl className="stu-figures">
                  <div><dt>Déjà payé · {ratio} %</dt><dd>{money(paid)}</dd></div>
                  <div><dt>Total de l&apos;année</dt><dd>{money(total)}</dd></div>
                </dl>
              </section>

              <ScholarshipCard fees={data} />

              {late.length > 0 && (
                <div className="stu-info stu-info-bad">
                  <p>{late.length === 1 ? `Échéance en retard : ${late[0].libelle}.` : `${late.length} échéances en retard.`}</p>
                </div>
              )}

              <div className="stu-segmented">
                <button type="button" className={tab === "echeancier" ? "on" : ""} onClick={() => setTab("echeancier")}>Échéancier</button>
                <button type="button" className={tab === "historique" ? "on" : ""} onClick={() => setTab("historique")}>Mes reçus ({data.paiements.length})</button>
              </div>

              {tab === "echeancier" ? (
                lines.length ? (
                  <div className="stu-card stu-rows">
                    {lines.map((line) => {
                      const status = lineStatus(line);
                      return (
                        <div key={line.id} className="stu-row">
                          <div>
                            <strong>{line.libelle}</strong>
                            <span>
                              {monthIds.has(line.id) && normal !== null && line.montant < normal && <s className="stu-price-normal">{money(normal)}</s>}
                              {money(line.montant)}{line.dateLimite ? ` · avant le ${shortDate(line.dateLimite, { day: "numeric", month: "long" })}` : ""}
                            </span>
                            {line.reste > 0 && line.paye > 0 && <span>Reste {money(line.reste)}</span>}
                          </div>
                          <Pill tone={status.tone}>{status.label}</Pill>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={null} title="Échéancier pas encore établi." />
                )
              ) : data.paiements.length ? (
                <div className="stu-card stu-rows">
                  {data.paiements.map((payment) => (
                    <button type="button" key={payment.id} className="stu-row stu-row-button" onClick={() => setReceipt(payment)} aria-label={`Voir le reçu ${payment.numeroRecu ?? ""} de ${money(payment.montant)}`}>
                                            <div>
                        <strong>{payment.libelle}</strong>
                        <span>{shortDate(payment.date, { day: "numeric", month: "long", year: "numeric" })}{payment.mode ? ` · ${MODES[payment.mode] ?? payment.mode}` : ""}</span>
                        {payment.numeroRecu && <small>Reçu {payment.numeroRecu}</small>}
                      </div>
                      <b className={payment.montant < 0 ? "stu-text-bad" : "stu-amount"}>{money(payment.montant)}</b>
                      <ChevronRight size={18} className="stu-row-chevron" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState icon={null} title="Aucun paiement." />
              )}
              <p className="stu-footnote">{tab === "historique" ? "Touche un paiement pour voir son reçu. " : ""}En cas d&apos;écart avec tes reçus, adresse-toi à la caisse.</p>
              {receipt && <ReceiptSheet payment={receipt} student={profile.data?.etudiant ?? null} dossier={data.dossier ?? null} onClose={() => setReceipt(null)} />}
            </>
          );
        }}
      </Loaded>
    </div>
  );
}

/** Ce que la bourse change, en clair : l'étudiant voit qu'elle est bien prise en compte. */
function ScholarshipCard({ fees }: { fees: Fees }) {
  const situation = fees.situation;
  if (!situation) return null;
  const months = situation.mensualites.length;
  const normal = fees.tarifNormal ?? null;
  const fullYear = normal !== null && fees.nombreMoisNormal ? normal * fees.nombreMoisNormal : null;
  const yearDue = situation.mensualites.reduce((sum, line) => sum + line.montant, 0);
  const saved = fullYear !== null ? Math.max(0, fullYear - yearDue) : null;

  if (!fees.bourse) {
    if (fees.reductionIndividuelle === null || fees.reductionIndividuelle === undefined) return null;
    return (
      <div className="stu-scholarship">
        <span className="stu-scholarship-tag">Réduction</span>
        <p><strong>{fees.reductionIndividuelle} % de réduction</strong> sur chaque mois{normal !== null ? ` (prix normal ${money(normal)})` : ""}.</p>
      </div>
    );
  }
  const name = fees.bourse.nom.replace(/^bourse\s+/i, "");
  const detail =
    fees.bourse.mode === "MOIS_FIXES"
      ? `Tu ne paies que ${months} mois${fees.nombreMoisNormal ? ` sur ${fees.nombreMoisNormal}` : ""}${normal !== null ? `, à ${money(situation.mensualites[0]?.montant ?? normal)}` : ""}.`
      : `${fees.bourse.taux ?? 0} % de réduction sur chaque mois${normal !== null ? ` : ${money(situation.mensualites[0]?.montant ?? 0)} au lieu de ${money(normal)}` : ""}.`;
  return (
    <div className="stu-scholarship">
      <span className="stu-scholarship-tag">Boursier</span>
      <div>
        <strong>Bourse {name}</strong>
        <p>{detail}</p>
        {saved !== null && saved > 0 && <p className="stu-scholarship-saved">Économie sur l&apos;année : {money(saved)}</p>}
      </div>
    </div>
  );
}
