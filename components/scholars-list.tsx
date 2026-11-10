"use client";

import { useState } from "react";
import { toast } from "@/components/feedback";
import { Empty, Modal, messageOf, useLoad } from "@/components/ui-kit";
import {
  PendingScholarshipApplication,
  Scholar,
  pendingScholarshipApplicationsPdf,
  scholarSituation,
  scholarsPdf,
} from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { formatDate, ScholarshipType } from "@/lib/types";

const SITUATIONS = [
  { value: "", label: "Tous les boursiers", title: "Liste des boursiers" },
  { value: "INSCRITS", label: "Déjà inscrits", title: "Boursiers inscrits" },
  { value: "NON_INSCRITS", label: "Pas encore inscrits", title: "Boursiers pas encore inscrits" },
  { value: "EN_ATTENTE", label: "Demandes en attente", title: "Demandes de bourse en attente" },
];

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadPendingCsv(rows: PendingScholarshipApplication[]) {
  const headers = [
    "Nom", "Prénom", "Téléphone", "Quartier", "Date de naissance", "Lieu de naissance",
    "Sexe", "Matricule", "Nom du tuteur", "Prénom du tuteur", "Téléphone du tuteur",
    "Statut", "Type de bourse", "Niveau demandé", "Filière souhaitée",
    "Filière secondaire souhaitée", "École d'origine", "Date de dépôt",
    "Date d'entretien", "Équipe d'entretien", "Date de décision",
    "Pièces du dossier", "Paiements des pièces", "Autres paiements du dossier",
  ];
  const data = rows.map((item) => [
    item.personne.nom,
    item.personne.prenom,
    item.personne.telephone,
    item.personne.quartier,
    item.personne.dateNaissance ? formatDate(item.personne.dateNaissance) : "",
    item.personne.lieuNaissance,
    item.personne.sexe,
    item.personne.matricule,
    item.personne.tuteurNom,
    item.personne.tuteurPrenom,
    item.personne.tuteurTelephone,
    item.statut,
    item.typeBourse?.nom,
    item.niveauDemande,
    item.filiereSouhaitee,
    item.filiereSecondaireSouhaitee,
    item.ecoleOrigine,
    formatDate(item.dateDepot),
    item.dateEntretien ? formatDate(item.dateEntretien) : "",
    item.equipeEntretien,
    item.dateDecision ? formatDate(item.dateDecision) : "",
    item.elementsDossier.map((element) =>
      `${element.elementRequis.nom}: ${element.statut}${element.elementSubstitutUtilise ? ` (remplacé par ${element.elementSubstitutUtilise.nom})` : ""}${element.dateFourniture ? `, fourni le ${formatDate(element.dateFourniture)}` : ""}${element.montantAttendu !== null ? `, montant attendu ${element.montantAttendu}` : ""}`,
    ).join(" | "),
    item.elementsDossier.flatMap((element) => element.paiements.map((payment) =>
      `${element.elementRequis.nom}: ${payment.montant} · ${formatDate(payment.datePaiement)} · ${payment.typePaiement} · ${payment.modePaiement ?? "Mode non renseigné"} · reçu ${payment.numeroRecu ?? "non renseigné"}`,
    )).join(" | "),
    item.paiements.map((payment) =>
      `${payment.montant} · ${formatDate(payment.datePaiement)} · ${payment.typePaiement} · ${payment.modePaiement ?? "Mode non renseigné"} · reçu ${payment.numeroRecu ?? "non renseigné"}`,
    ).join(" | "),
  ]);
  const csv = [headers, ...data].map((line) => line.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "demandes-bourse-en-attente.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

// Liste à imprimer : les boursiers d'un type de bourse, inscrits ou non.
export function ScholarsListModal({ scholarshipTypes, onClose }: { scholarshipTypes: ScholarshipType[]; onClose: () => void }) {
  const [typeBourseId, setTypeBourseId] = useState("");
  const [situation, setSituation] = useState("");
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams({ ...(typeBourseId ? { typeBourseId } : {}), ...(situation ? { inscription: situation } : {}) }).toString();
  const list = useLoad<Scholar[]>(situation === "EN_ATTENTE" ? null : `/demandes-bourse/boursiers${query ? `?${query}` : ""}`);
  const pendingQuery = new URLSearchParams(typeBourseId ? { typeBourseId } : {}).toString();
  const pendingList = useLoad<PendingScholarshipApplication[]>(situation === "EN_ATTENTE" ? `/demandes-bourse/en-attente/export${pendingQuery ? `?${pendingQuery}` : ""}` : null);
  const rows = list.data ?? [];
  const pendingRows = pendingList.data ?? [];
  const error = situation === "EN_ATTENTE" ? pendingList.error : list.error;
  const isPending = situation === "EN_ATTENTE";
  const withoutPhone = rows.filter((item) => !item.personne.telephone).length;
  const title = SITUATIONS.find((item) => item.value === situation)?.title ?? SITUATIONS[0].title;
  const typeName = scholarshipTypes.find((type) => type.id === typeBourseId)?.nom ?? "Toutes les bourses";
  const download = async () => {
    setBusy(true);
    try {
      if (isPending) {
        await pendingScholarshipApplicationsPdf(pendingRows, typeName);
        logPrint({ typeDocument: "LISTE_DEMANDES_BOURSE", mode: "PDF", libelle: `${title} · ${typeName} · ${pendingRows.length} demande(s)` });
      } else {
        await scholarsPdf(rows, title, typeName);
        logPrint({ typeDocument: "LISTE_BOURSIERS", mode: "PDF", libelle: `${title} · ${typeName} · ${rows.length} étudiant(s)` });
      }
    } catch (failure) {
      toast(messageOf(failure, "Le PDF n'a pas pu être généré."), "error");
    } finally {
      setBusy(false);
    }
  };
  const exportPendingExcel = () => {
    try {
      downloadPendingCsv(pendingRows);
      logPrint({ typeDocument: "LISTE_DEMANDES_BOURSE", mode: "EXCEL", libelle: `${title} · ${typeName} · ${pendingRows.length} demande(s)` });
    } catch (failure) {
      toast(messageOf(failure, "Le fichier Excel n'a pas pu être généré."), "error");
    }
  };
  const loaded = isPending ? pendingList.data : list.data;
  return (
    <Modal wide title={isPending ? "Demandes de bourse en attente" : "Liste des boursiers"} onClose={onClose}>
      <div className="entity-form">
        <div className="form-grid">
          <label>Type de bourse<select value={typeBourseId} onChange={(event) => setTypeBourseId(event.target.value)}><option value="">Toutes les bourses</option>{scholarshipTypes.map((type) => <option key={type.id} value={type.id}>{type.nom}</option>)}</select></label>
          <label>Situation<select value={situation} onChange={(event) => setSituation(event.target.value)}>{SITUATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        {loaded && <p className="panel-subtitle">{isPending ? `${pendingRows.length} demande(s)` : `${rows.length} étudiant(s)${withoutPhone ? ` · ${withoutPhone} sans numéro de téléphone` : ""}`}</p>}
        <div className="table-wrap"><table>
          <thead><tr>{isPending
            ? <><th>Candidat</th><th>Téléphone</th><th>Niveau</th><th>Filière souhaitée</th><th>École d&apos;origine</th><th>Pièces du dossier</th></>
            : <><th>Étudiant</th><th>Téléphone</th><th>Bourse</th><th>Filière</th><th>Situation</th></>}</tr></thead>
          <tbody>
            {isPending ? pendingRows.map((item) => (
              <tr key={item.id}>
                <td className="strong-cell">{item.personne.nom} {item.personne.prenom}</td>
                <td>{item.personne.telephone ?? <span className="muted-action">Non renseigné</span>}</td>
                <td>{item.niveauDemande}</td>
                <td>{item.filiereSouhaitee}</td>
                <td>{item.ecoleOrigine ?? <span className="muted-action">Non renseignée</span>}</td>
                <td>{item.elementsDossier.length} pièce(s)</td>
              </tr>
            )) : rows.map((item) => (
              <tr key={item.id}>
                <td className="strong-cell">{item.personne.nom} {item.personne.prenom}</td>
                <td>{item.personne.telephone ?? <span className="muted-action">Non renseigné</span>}</td>
                <td>{item.typeBourse}</td>
                <td>{item.inscription?.filiere ?? item.filiereSouhaitee}</td>
                <td>{scholarSituation(item)}</td>
              </tr>
            ))}
            {!loaded && !error && <Empty columns={isPending ? 6 : 5} loading />}
            {loaded && !(isPending ? pendingRows.length : rows.length) && <Empty columns={isPending ? 6 : 5}>{isPending ? "Aucune demande en attente avec ces filtres." : "Aucun boursier avec ces filtres."}</Empty>}
          </tbody>
        </table></div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Fermer</button>
          {isPending && <button type="button" className="secondary-button" disabled={!pendingRows.length} onClick={exportPendingExcel}>Télécharger pour Excel</button>}
          <button type="button" className="primary-button compact" disabled={busy || !(isPending ? pendingRows.length : rows.length)} onClick={() => void download()}>{busy ? "Génération..." : "Télécharger le PDF"}</button>
        </div>
      </div>
    </Modal>
  );
}
