import { User, ViewName } from "@/lib/types";

export const ACCESS_FEATURES = [
  { key: "dashboard", label: "Vue d'ensemble" },
  { key: "scholarships", label: "Demandes de bourse" },
  { key: "enrollments", label: "Inscriptions" },
  { key: "certificates", label: "Certificats" },
  { key: "payments", label: "Paiements" },
  { key: "prospects", label: "Prospects" },
  { key: "people", label: "Personnes" },
  { key: "recruiting", label: "Recrutement" },
  { key: "references", label: "Référentiels" },
  { key: "sync", label: "Synchronisation" },
  { key: "reports", label: "Rapports" },
] as const;

export type AccessArea = (typeof ACCESS_FEATURES)[number]["key"];
export type AccessPermission = `view:${AccessArea}` | `edit:${AccessArea}`;

export const VIEW_ACCESS: Partial<Record<ViewName, AccessArea>> = {
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
};

export function hasAccess(user: User | null, area: AccessArea, mode: "view" | "edit" = "view") {
  return user?.role === "admin" || Boolean(user?.permissions?.includes(`${mode}:${area}`));
}