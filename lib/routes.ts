import { ViewName } from "@/lib/types";

export type DossierRoute = { type: "demande-bourse" | "inscription"; id: string };
export type AppRoute = { view: ViewName; dossier: DossierRoute | null; auditUserId: string | null };

// Chaque écran a son adresse : actualiser, revenir en arrière et partager un
// lien vers un dossier fonctionnent comme dans n'importe quel site.
const VIEW_PATHS: Record<Exclude<ViewName, "Fiche dossier">, string> = {
  "Vue d'ensemble": "/",
  "Demandes de bourse": "/demandes",
  Inscriptions: "/inscriptions",
  Certificats: "/certificats",
  Paiements: "/paiements",
  Dépenses: "/depenses",
  "Validation des dépenses": "/depenses/validation",
  "Exécution des dépenses": "/depenses/execution",
  Budget: "/budget",
  "Paramètres finances": "/finances/parametres",
  Prospects: "/prospects",
  Personnes: "/personnes",
  Recrutement: "/recrutement",
  Référentiels: "/referentiels",
  Synchronisation: "/synchronisation",
  Rapports: "/rapports",
  Corbeille: "/corbeille",
  Impressions: "/impressions",
  "Structure académique": "/academique/structure",
  "Classes et étudiants": "/academique/classes",
  Enseignement: "/academique/enseignement",
  Notes: "/academique/notes",
  Délibérations: "/academique/deliberations",
  "Statistiques académiques": "/academique/statistiques",
  Personnel: "/personnel",
  Paie: "/paie",
  Comptabilité: "/comptabilite",
  Sauvegardes: "/sauvegardes",
  Audit: "/audit",
  Profil: "/profil",
  Paramètres: "/parametres",
  "À propos du SGI": "/a-propos",
  "Résumé de la journée": "/journee",
  "Suppression des dossiers": "/aide/suppression",
};

const PATH_VIEWS = new Map(
  Object.entries(VIEW_PATHS).map(([view, path]) => [path, view as ViewName]),
);

export function pathForView(view: ViewName): string {
  return view === "Fiche dossier" ? "/demandes" : VIEW_PATHS[view];
}

export function pathForDossier(dossier: DossierRoute): string {
  return `/${dossier.type === "demande-bourse" ? "demandes" : "inscriptions"}/${encodeURIComponent(dossier.id)}`;
}

export function parsePath(pathname: string | null): AppRoute {
  const path = (pathname ?? "/").replace(/\/+$/, "") || "/";
  const dossier = path.match(/^\/(demandes|inscriptions)\/([^/]+)$/);
  if (dossier) {
    return {
      view: "Fiche dossier",
      dossier: {
        type: dossier[1] === "demandes" ? "demande-bourse" : "inscription",
        id: decodeURIComponent(dossier[2]),
      },
      auditUserId: null,
    };
  }
  // Page dédiée au profil d'activité d'un utilisateur dans l'audit.
  const auditUser = path.match(/^\/audit\/utilisateurs\/([^/]+)$/);
  if (auditUser) return { view: "Audit", dossier: null, auditUserId: decodeURIComponent(auditUser[1]) };
  return { view: PATH_VIEWS.get(path) ?? "Vue d'ensemble", dossier: null, auditUserId: null };
}

export function navigateTo(path: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== path) window.history.pushState(null, "", path);
  window.scrollTo({ top: 0 });
}

export function pathForAuditUser(userId: string): string {
  return `/audit/utilisateurs/${encodeURIComponent(userId)}`;
}
