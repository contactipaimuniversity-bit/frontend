import { statusLabels } from "@/lib/types";

// Affichage lisible des valeurs journalisées (modifications, saisies, suppressions),
// partagé par la page d'audit et le récapitulatif de la journée.
export type AuditChange = { champ: string; avant: unknown; apres: unknown };

const FIELD_LABELS: Record<string, string> = {
  nom: "Nom", prenom: "Prénom", telephone: "Téléphone", quartier: "Quartier", email: "Email", role: "Rôle",
  dateNaissance: "Date de naissance", lieuNaissance: "Lieu de naissance", tuteurNom: "Nom du tuteur", tuteurPrenom: "Prénom du tuteur", tuteurTelephone: "Téléphone du tuteur",
  statut: "Statut", statutRelance: "Statut de relance", filiere: "Filière", filiereSouhaitee: "Filière souhaitée", filiereSecondaireSouhaitee: "Filière secondaire",
  niveau: "Niveau", niveauDemande: "Niveau demandé", anneeScolaire: "Année scolaire", ecoleOrigine: "École d'origine", viaBourse: "Via une bourse",
  dateEntretien: "Date d'entretien", equipeEntretien: "Équipe d'entretien", dateDecision: "Date de décision", typeBourseId: "Type de bourse",
  demandeBourseId: "Demande de bourse", inscriptionId: "Inscription", personneId: "Personne", elementDossierId: "Obligation", echeanceId: "Échéance",
  montant: "Montant", montantAttendu: "Montant attendu", typePaiement: "Type de paiement", fraisInscription: "Frais d'inscription", tauxReduction: "Taux de réduction",
  intention: "Intention", sourceConnaissance: "A connu l'IPAIM par", commentaire: "Commentaire", dateProchaineRelance: "Prochaine relance", motif: "Motif", permissions: "Permissions", poleId: "Pôle", posteId: "Poste",
  motDePasse: "Mot de passe", ancienMotDePasse: "Ancien mot de passe", nouveauMotDePasse: "Nouveau mot de passe", obligatoire: "Obligatoire",
  categorie: "Catégorie", contexte: "Contexte", niveauApplicable: "Niveau applicable", diplome: "Diplôme", fonction: "Fonction", remarques: "Remarques",
  libelle: "Libellé", ordre: "Ordre", dateEcheance: "Date d'échéance", preparation: "Préparation du dossier", nouvellePersonne: "Nouvelle personne",
  dateDepot: "Date de dépôt", dateInscription: "Date d'inscription", dateEnregistrement: "Date d'enregistrement", dateFourniture: "Date de fourniture",
  creeParId: "Créé par", elementRequisId: "Élément requis", statuses: "Statut des pièces", elementId: "Obligation", confirmerDemandeEnCours: "Demande non décidée confirmée",
};

const PAYMENT_LABELS: Record<string, string> = { FRAIS_DEPOT: "Frais de dépôt", FRAIS_INSCRIPTION: "Frais d'inscription", REMBOURSEMENT: "Remboursement", REPORT: "Report de trop-perçu", ANNULATION: "Annulation d'un encaissement", ECHEANCE_BOURSE: "Échéance de bourse" };

export const fieldLabel = (key: string) =>
  FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

export const auditDateTime = (value: string) =>
  new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string" && (statusLabels[value] || PAYMENT_LABELS[value])) return statusLabels[value] ?? PAYMENT_LABELS[value];
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return auditDateTime(value);
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Aplatit un objet imbriqué en lignes « Libellé › Sous-libellé : valeur ».
export function flattenValues(value: unknown, prefix = ""): Array<[string, string]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return prefix ? [[prefix, displayValue(value)]] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const label = prefix ? `${prefix} › ${fieldLabel(key)}` : fieldLabel(key);
    return item && typeof item === "object" && !Array.isArray(item) ? flattenValues(item, label) : [[label, displayValue(item)] as [string, string]];
  });
}

export const summarizeChanges = (changes: AuditChange[], max = 2) =>
  changes.slice(0, max).map((change) => `${fieldLabel(change.champ)} : ${displayValue(change.avant)} → ${displayValue(change.apres)}`).join(" · ") +
  (changes.length > max ? ` · +${changes.length - max}` : "");

export function ChangesTable({ changes }: { changes: AuditChange[] }) {
  if (!changes.length) return null;
  return (
    <section>
      <h4>Valeurs modifiées</h4>
      <table className="audit-diff">
        <thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead>
        <tbody>{changes.map((change) => <tr key={change.champ}><td>{fieldLabel(change.champ)}</td><td className="audit-before">{displayValue(change.avant)}</td><td className="audit-after">{displayValue(change.apres)}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

export function ValuesList({ title, values }: { title: string; values: unknown }) {
  const rows = flattenValues(values);
  if (!rows.length) return null;
  return (
    <section>
      <h4>{title}</h4>
      <dl className="audit-values">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}
