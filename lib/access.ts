import { User, ViewName } from "@/lib/types";

// Le détail de la Vue d'ensemble : chaque carte et chaque bloc s'attribue séparément.
// Ces rubriques ne font qu'afficher : elles n'ont pas de droit « Modifier ».
export const ACCESS_FEATURES = [
  { key: "daily-summary", label: "Résumé de la journée", viewOnly: true },
  { key: "dashboard-my-work", label: "Vue d'ensemble · Mon travail du jour", viewOnly: true },
  { key: "dashboard-followups", label: "Vue d'ensemble · Prospects à relancer", viewOnly: true },
  { key: "dashboard-interviews", label: "Vue d'ensemble · Entretiens sous 7 jours", viewOnly: true },
  { key: "dashboard-incomplete", label: "Vue d'ensemble · Dossiers incomplets (liste)", viewOnly: true },
  { key: "dashboard-unpaid", label: "Vue d'ensemble · Restes à payer", viewOnly: true },
  { key: "dashboard-trend", label: "Vue d'ensemble · Évolution sur 6 mois", viewOnly: true },
  { key: "dashboard-prospects", label: "Vue d'ensemble · Carte Prospects actifs", viewOnly: true },
  { key: "dashboard-applications", label: "Vue d'ensemble · Carte Demandes de bourse", viewOnly: true },
  { key: "dashboard-applications-open", label: "Vue d'ensemble · Carte Demandes en cours", viewOnly: true },
  { key: "dashboard-people", label: "Vue d'ensemble · Carte Effectif total", viewOnly: true },
  { key: "dashboard-enrollments", label: "Vue d'ensemble · Carte Inscriptions", viewOnly: true },
  { key: "dashboard-collected", label: "Vue d'ensemble · Carte Total encaissé", viewOnly: true },
  { key: "dashboard-receivables", label: "Vue d'ensemble · Carte Reste à recouvrer", viewOnly: true },
  { key: "dashboard-scholarship-types", label: "Vue d'ensemble · Effectifs par type de bourse", viewOnly: true },
  { key: "dashboard-recent-applications", label: "Vue d'ensemble · Derniers dossiers de bourse", viewOnly: true },
  { key: "dashboard-recent-enrollments", label: "Vue d'ensemble · Inscriptions récentes", viewOnly: true },
  { key: "dashboard-incomplete-note", label: "Vue d'ensemble · Rappel des dossiers incomplets", viewOnly: true },
  { key: "scholarships", label: "Demandes de bourse" },
  { key: "enrollments", label: "Inscriptions" },
  { key: "certificates", label: "Certificats" },
  { key: "payments", label: "Paiements" },
  { key: "payment-cancellation", label: "Paiements · annulation d'un encaissement" },
  { key: "payment-validation", label: "Paiements · validation des encaissements (remise de caisse)" },
  { key: "prospects", label: "Prospects" },
  { key: "people", label: "Personnes" },
  { key: "recruiting", label: "Recrutement" },
  { key: "references", label: "Référentiels" },
  { key: "sync", label: "Synchronisation" },
  { key: "reports", label: "Rapports" },
  { key: "expenses", label: "Dépenses · états de besoin" },
  { key: "expense-approval", label: "Dépenses · validation" },
  { key: "expense-final-approval", label: "Dépenses · validation finale" },
  { key: "expense-payment", label: "Dépenses · exécution et paiement" },
  { key: "finance-settings", label: "Budget et paramètres financiers" },
  { key: "accounting", label: "Comptabilité" },
  { key: "card-scan", label: "Cartes d'étudiant · contrôle à l'entrée" },
  { key: "academics", label: "Académique · structure et classes" },
  { key: "teaching", label: "Académique · emplois du temps et présences" },
  { key: "grades", label: "Académique · saisie des notes" },
  { key: "deliberations", label: "Académique · validation et délibérations" },
  { key: "academic-stats", label: "Académique · statistiques" },
  { key: "hr", label: "Personnel (RH)" },
  { key: "payroll", label: "Paie · préparation et versement" },
  { key: "payroll-approval", label: "Paie · validation" },
] as const;

export type AccessArea = (typeof ACCESS_FEATURES)[number]["key"];
export type AccessPermission = `view:${AccessArea}` | `edit:${AccessArea}`;

// Une page ouverte à plusieurs rôles liste toutes les fonctionnalités qui y donnent accès.
export const VIEW_ACCESS: Partial<Record<ViewName, AccessArea | AccessArea[]>> = {
  // La vue d'ensemble est la page d'accueil de tous ; chacun n'y voit que les
  // cartes et les blocs attribués à son poste.
  "Résumé de la journée": "daily-summary",
  "Demandes de bourse": "scholarships",
  Inscriptions: "enrollments",
  Certificats: "certificates",
  Paiements: "payments",
  "Validation des encaissements": "payment-validation",
  Prospects: "prospects",
  "Futurs étudiants": "prospects",
  Personnes: "people",
  Recrutement: "recruiting",
  Référentiels: "references",
  Synchronisation: "sync",
  Rapports: "reports",
  "États de besoin": "expenses",
  "Validation des dépenses": ["expense-approval", "expense-final-approval"],
  "Exécution des dépenses": "expense-payment",
  Budget: ["finance-settings", "expense-approval", "expense-final-approval", "expense-payment"],
  "Paramètres finances": "finance-settings",
  Comptabilité: "accounting",
  "Tableau de bord académique": ["academics", "teaching", "grades", "deliberations", "academic-stats"],
  "Structure académique": "academics",
  "Classes et étudiants": ["academics", "deliberations"],
  Enseignement: ["teaching", "academics"],
  "Évaluations et notes": ["grades", "deliberations"],
  Délibérations: "deliberations",
  "Statistiques académiques": ["academic-stats", "deliberations", "academics"],
  // La scolarité et les agents d'accueil scannent les cartes d'étudiant.
  "Contrôle des cartes": ["card-scan", "enrollments", "academics"],
  Personnel: "hr",
  Paie: ["payroll", "payroll-approval"],
};

// Les rubriques servies par /rapports/synthese et /rapports/a-faire.
export const DASHBOARD_FIGURE_AREAS: AccessArea[] = ["dashboard-trend", "dashboard-prospects", "dashboard-applications", "dashboard-applications-open", "dashboard-people", "dashboard-enrollments", "dashboard-collected", "dashboard-receivables", "dashboard-scholarship-types", "dashboard-recent-applications", "dashboard-recent-enrollments"];
export const DASHBOARD_WORKLIST_AREAS: AccessArea[] = ["dashboard-followups", "dashboard-interviews", "dashboard-incomplete", "dashboard-unpaid"];

export function hasAccess(user: User | null, area: AccessArea, mode: "view" | "edit" = "view") {
  return user?.role === "admin" || Boolean(user?.permissions?.includes(`${mode}:${area}`));
}
// La fiche unique d'une personne sert au guichet comme au répertoire.
export function canOpenPersonFile(user: User | null) {
  return (["people", "scholarships", "enrollments", "payments"] as const).some((area) => hasAccess(user, area));
}

export function canAccessView(user: User | null, view: ViewName) {
  const areas = VIEW_ACCESS[view];
  if (!areas) return true;
  return (Array.isArray(areas) ? areas : [areas]).some((area) => hasAccess(user, area));
}
