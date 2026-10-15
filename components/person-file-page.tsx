"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, Phone, UserRound } from "lucide-react";
import { PhotoFrame } from "@/components/student-photo";
import { toast } from "@/components/feedback";
import { printStudentCards } from "@/lib/cards";
import { Badge, Empty, PageIntro, Panel, messageOf } from "@/components/ui-kit";
import { canAccessView, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { navigateTo, pathForDossier, pathForStudent, pathForView } from "@/lib/routes";
import { ApplicationFinance, Person, User, formatDate, formatMoney, fullName, statusLabels } from "@/lib/types";

type PersonFile = Person & {
  prospect?: { statutRelance: string; filiereSouhaitee?: string | null } | null;
  demandesBourse: Array<{ id: string; statut: string; filiereSouhaitee: string; niveau?: string | null; dateDepot: string; typeBourse?: { nom: string } | null }>;
  inscriptions: Array<{ id: string; statut: string; filiere: string; niveau?: string | null; anneeScolaire: string; dateInscription: string; classeId?: string | null }>;
};
type Dossier = { type: "demande-bourse" | "inscription"; id: string; label: string; detail: string; statut: string; date: string; inClass?: boolean };
type Money = { attendu: number; paye: number; reste: number };
type DossierPayment = { id: string; montant: string; datePaiement: string; typePaiement: string; numeroRecu?: string | null; modePaiement?: string | null; saisiParNom?: string | null; annulePaiementId?: string | null; echeance?: { libelle: string } | null; dossier: string };

const MODES: Record<string, string> = { ESPECES: "Espèces", MOBILE_MONEY: "Mobile money", VIREMENT: "Virement", CHEQUE: "Chèque" };

// Fiche unique d'une personne : son identité, tous ses dossiers, ce qu'elle a
// payé et ce qu'elle doit encore, et l'accès à sa scolarité. Une seule page au guichet.
export function PersonFilePage({ personId, user, refreshSignal }: { personId: string; user: User | null; refreshSignal: number }) {
  const [person, setPerson] = useState<PersonFile | null>(null);
  const [money, setMoney] = useState<Record<string, Money>>({});
  const [payments, setPayments] = useState<DossierPayment[] | null>(null);
  const [error, setError] = useState("");
  const seesPayments = hasAccess(user, "payments");
  const canPrintCard = hasAccess(user, "enrollments", "edit") || hasAccess(user, "academics", "edit");
  const [printing, setPrinting] = useState(false);
  // Réimprime la carte en cours de validité (ou en édite une si l'étudiant n'en a pas).
  const printCard = async (inscriptionId: string) => {
    setPrinting(true);
    try {
      await printStudentCards([inscriptionId], { fileName: `carte-${person?.matricule ?? person?.nom ?? "etudiant"}.pdf`, libelle: (card) => `${card.personne.nom} ${card.personne.prenom}` });
      toast("Carte prête : imprimez le recto, puis le verso au dos (bord long).");
    } catch (failure) {
      toast(messageOf(failure, "Carte impossible à éditer."), "error");
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await apiFetch<PersonFile>(`/personnes/${encodeURIComponent(personId)}`, { skipCache: true });
        if (!active) return;
        setPerson(loaded);
        setError("");
        const dossiers = [
          ...loaded.demandesBourse.map((item) => ({ base: "demandes-bourse", id: item.id, label: `Demande · ${item.filiereSouhaitee}` })),
          ...loaded.inscriptions.map((item) => ({ base: "inscriptions", id: item.id, label: `Inscription ${item.anneeScolaire}` })),
        ];
        // Situation financière de chaque dossier ; un dossier illisible n'empêche pas les autres.
        const finances = await Promise.all(dossiers.map((dossier) => apiFetch<ApplicationFinance>(`/${dossier.base}/${dossier.id}/finance`, { skipCache: true }).catch(() => null)));
        if (!active) return;
        setMoney(Object.fromEntries(dossiers.flatMap((dossier, index) => {
          const finance = finances[index];
          if (!finance) return [];
          const attendu = Number(finance.totalAttendu);
          const paye = Number(finance.totalPaye);
          const reste = finance.obligations.reduce((total, item) => total + Math.max(0, Number(item.resteAPayer)), 0);
          return [[dossier.id, { attendu, paye, reste }]];
        })));
        if (seesPayments) {
          const lists = await Promise.all(dossiers.map((dossier) =>
            apiFetch<Omit<DossierPayment, "dossier">[]>(`/${dossier.base}/${dossier.id}/paiements`, { skipCache: true })
              .then((list) => list.map((payment) => ({ ...payment, dossier: dossier.label })))
              .catch(() => [] as DossierPayment[]),
          ));
          if (active) setPayments(lists.flat().sort((first, second) => new Date(second.datePaiement).getTime() - new Date(first.datePaiement).getTime()));
        }
      } catch (failure) {
        if (active) setError(messageOf(failure, "Fiche indisponible."));
      }
    })();
    return () => {
      active = false;
    };
  }, [personId, refreshSignal, seesPayments]);

  const back = () => (window.history.length > 1 ? window.history.back() : navigateTo(pathForView("Personnes")));
  if (error) return <div className="content-scroll"><p className="form-error">{error}</p><button className="secondary-button" onClick={back}>Retour</button></div>;
  if (!person) return <div className="content-scroll"><p className="empty-state">Chargement de la fiche…</p></div>;

  const dossiers: Dossier[] = [
    ...person.demandesBourse.map((item) => ({ type: "demande-bourse" as const, id: item.id, label: "Demande de bourse", detail: [item.filiereSouhaitee, item.niveau, item.typeBourse?.nom].filter(Boolean).join(" · "), statut: item.statut, date: item.dateDepot })),
    ...person.inscriptions.map((item) => ({ type: "inscription" as const, id: item.id, label: `Inscription ${item.anneeScolaire}`, detail: [item.filiere, item.niveau].filter(Boolean).join(" · "), statut: item.statut, date: item.dateInscription, inClass: Boolean(item.classeId) })),
  ].sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());
  const totals = Object.values(money).reduce((sum, item) => ({ attendu: sum.attendu + item.attendu, paye: sum.paye + item.paye, reste: sum.reste + item.reste }), { attendu: 0, paye: 0, reste: 0 });
  const canOpen = (dossier: Dossier) => canAccessView(user, dossier.type === "demande-bourse" ? "Demandes de bourse" : "Inscriptions");
  const cancelled = new Set((payments ?? []).map((payment) => payment.annulePaiementId).filter(Boolean));
  const seesSchooling = Boolean(person.matricule) && (hasAccess(user, "academics") || hasAccess(user, "deliberations"));

  return (
    <div className="content-scroll person-file">
      <button type="button" className="settings-back" onClick={back}><ArrowLeft size={16} aria-hidden="true" /> Retour</button>
      <PageIntro eyebrow="Fiche personne" title={fullName(person)} text="Tout ce qui concerne cette personne sur une seule page : identité, dossiers, paiements et scolarité.">
        {seesSchooling && <button className="outline-button small" onClick={() => navigateTo(pathForStudent(person.id))}><GraduationCap size={15} aria-hidden="true" /> Parcours académique</button>}
      </PageIntro>

      <section className="panel full-panel person-file-identity">
        <PhotoFrame owner={person} alt={`Photo de ${fullName(person)}`} />
        <dl className="person-file-facts">
          <div><dt>Matricule</dt><dd>{person.matricule ?? "Pas encore attribué"}</dd></div>
          <div><dt>Téléphone</dt><dd>{person.telephone ? <a href={`tel:${person.telephone}`}><Phone size={13} aria-hidden="true" /> {person.telephone}</a> : "—"}</dd></div>
          <div><dt>Né(e) le</dt><dd>{person.dateNaissance ? `${formatDate(person.dateNaissance)}${person.lieuNaissance ? ` à ${person.lieuNaissance}` : ""}` : "—"}</dd></div>
          <div><dt>Quartier</dt><dd>{person.quartier || "—"}</dd></div>
          <div><dt>Parent / tuteur</dt><dd>{[person.tuteurPrenom, person.tuteurNom].filter(Boolean).join(" ") || "—"}{person.tuteurTelephone ? <> · <a href={`tel:${person.tuteurTelephone}`}>{person.tuteurTelephone}</a></> : null}</dd></div>
          <div><dt>Connu(e) depuis</dt><dd>{formatDate(person.dateEnregistrement)}{person.prospect ? ` · prospect ${(statusLabels[person.prospect.statutRelance] ?? person.prospect.statutRelance).toLowerCase()}` : ""}</dd></div>
        </dl>
      </section>

      <div className="stats-grid">
        <article className="stat-card blue"><span>Total attendu</span><strong>{formatMoney(totals.attendu)}</strong><p>sur {dossiers.length} dossier(s)</p></article>
        <article className="stat-card mint"><span>Déjà payé</span><strong>{formatMoney(totals.paye)}</strong><p>encaissements reçus</p></article>
        <article className={`stat-card ${totals.reste > 0 ? "orange" : "mint"}`}><span>Reste dû</span><strong>{formatMoney(totals.reste)}</strong><p>{totals.reste > 0 ? "à encaisser depuis le dossier concerné" : "rien à payer"}</p></article>
      </div>

      <Panel eyebrow="Dossiers" title={`${dossiers.length} dossier(s)`} subtitle="Ouvrez un dossier pour encaisser, mettre à jour les pièces ou prendre une décision.">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Dossier</th><th>Statut</th><th>Attendu</th><th>Payé</th><th>Reste</th><th /></tr></thead>
            <tbody>
              {dossiers.map((dossier) => {
                const amounts = money[dossier.id];
                return (
                  <tr key={dossier.id}>
                    <td className="strong-cell">{dossier.label}<small className="cell-detail">{dossier.detail} · {formatDate(dossier.date)}</small></td>
                    <td><span className={`status status-${dossier.statut.toLowerCase()}`}>{statusLabels[dossier.statut] ?? dossier.statut}</span></td>
                    <td>{amounts ? formatMoney(amounts.attendu) : "—"}</td>
                    <td>{amounts ? formatMoney(amounts.paye) : "—"}</td>
                    <td>{amounts ? (amounts.reste > 0 ? <Badge tone="bad">{formatMoney(amounts.reste)}</Badge> : <Badge tone="ok">Soldé</Badge>) : "—"}</td>
                    <td className="action-group">
                      {canOpen(dossier) && <button className="row-action" onClick={() => navigateTo(pathForDossier({ type: dossier.type, id: dossier.id }))}>Ouvrir le dossier</button>}
                      {canPrintCard && dossier.inClass && dossier.statut !== "ABANDONNEE" && <button className="row-action" disabled={printing} onClick={() => void printCard(dossier.id)}>Carte d&apos;étudiant</button>}
                    </td>
                  </tr>
                );
              })}
              {!dossiers.length && <Empty columns={6}>Aucun dossier : cette personne n&apos;a ni demande de bourse ni inscription.</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>

      {seesPayments && (
        <Panel eyebrow="Paiements" title={payments ? `${payments.length} opération(s)` : "Chargement…"} subtitle="Encaissements, remboursements, reports et annulations, du plus récent au plus ancien.">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Reçu</th><th>Objet</th><th>Mode</th><th>Montant</th></tr></thead>
              <tbody>
                {(payments ?? []).map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.datePaiement)}<small className="cell-detail">{payment.saisiParNom ?? ""}</small></td>
                    <td>{payment.numeroRecu ?? "—"}</td>
                    <td>{payment.echeance?.libelle ?? statusLabels[payment.typePaiement] ?? payment.typePaiement}<small className="cell-detail">{payment.dossier}{cancelled.has(payment.id) ? " · annulé" : ""}</small></td>
                    <td>{MODES[payment.modePaiement ?? "ESPECES"] ?? payment.modePaiement}</td>
                    <td className="strong-cell">{formatMoney(payment.montant)}</td>
                  </tr>
                ))}
                {payments && !payments.length && <Empty columns={5}>Aucun paiement enregistré.</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {!dossiers.length && !person.prospect && <p className="panel-subtitle"><UserRound size={14} aria-hidden="true" /> Cette fiche n&apos;est rattachée à aucun dossier.</p>}
    </div>
  );
}
