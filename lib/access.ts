import { User, ViewName } from "@/lib/types";

export const ACCESS_FEATURES = [
  { key: "dashboard", label: "Vue d'ensemble" },
  { key: "scholarships", label: "Demandes de bourse" },
  { key: "enrollments", label: "Inscriptions" },
  { key: "certificates", label: "Certificats" },
  { key: "payments", label: "Paiements" },
  { key: "payment-cancellation", label: "Paiements · annulation d'un encaissement" },
  { key: "prospects", label: "Prospects" },
  { key: "people", label: "Personnes" },
  { key: "recruiting", label: "Recrutement" },
  { key: "references", label: "Référentiels" },
  { key: "sync", label: "Synchronisation" },
  { key: "reports", label: "Rapports" },
  { key: "expenses", label: "Dépenses · demandes" },
  { key: "expense-approval", label: "Dépenses · validation" },
  { key: "expense-final-approval", label: "Dépenses · validation finale" },
  { key: "expense-payment", label: "Dépenses · exécution et paiement" },
  { key: "finance-settings", label: "Budget et paramètres financiers" },
  { key: "accounting", label: "Comptabilité" },
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
  "Vue d'ensemble": "dashboard",
  "Demandes de bourse": "scholarships",
  Inscriptions: "enrollments",
  Certificats: "certificates",
  Paiements: "payments",
  Prospects: "prospects",
  Personnes: "people",
  Recrutement: "recruiting",
  Référentiels: "references",
  Synchronisation: "sync",
  Rapports: "reports",
  Dépenses: "expenses",
  "Validation des dépenses": ["expense-approval", "expense-final-approval"],
  "Exécution des dépenses": "expense-payment",
  Budget: ["finance-settings", "expense-approval", "expense-final-approval", "expense-payment"],
  "Paramètres finances": "finance-settings",
  Comptabilité: "accounting",
  "Structure académique": "academics",
  "Classes et étudiants": ["academics", "deliberations"],
  Enseignement: ["teaching", "academics"],
  Notes: ["grades", "deliberations"],
  Délibérations: "deliberations",
  "Statistiques académiques": ["academic-stats", "deliberations", "academics"],
  Personnel: "hr",
  Paie: ["payroll", "payroll-approval"],
};

export function hasAccess(user: User | null, area: AccessArea, mode: "view" | "edit" = "view") {
  return user?.role === "admin" || Boolean(user?.permissions?.includes(`${mode}:${area}`));
}
export function canAccessView(user: User | null, view: ViewName) {
  const areas = VIEW_ACCESS[view];
  if (!areas) return true;
  return (Array.isArray(areas) ? areas : [areas]).some((area) => hasAccess(user, area));
}
