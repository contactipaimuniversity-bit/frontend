import { ViewName } from "@/lib/types";

export type DossierRoute = { type: "demande-bourse" | "inscription"; id: string };
export type SettingsSection = "apparence" | "postes" | "utilisateurs";
export type HelpedView = Exclude<ViewName, "Aide de la page">;
export type ClassSection = "etudiants" | "cours" | "assiduite";
export type AppRoute = { view: ViewName; dossier: DossierRoute | null; auditUserId: string | null; settingsSection?: SettingsSection | null; helpFor?: HelpedView | null; classId?: string | null; classSection?: ClassSection | null; studentId?: string | null; gradeCourseId?: string | null; gradeEvaluationId?: string | null };

// Chaque écran a son adresse : actualiser, revenir en arrière et partager un
// lien vers un dossier fonctionnent comme dans n'importe quel site.
const VIEW_PATHS: Record<Exclude<ViewName, "Fiche dossier" | "Aide de la page">, string> = {
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
  "Futurs étudiants": "/futurs-etudiants",
  Personnes: "/personnes",
  Recrutement: "/recrutement",
  Référentiels: "/referentiels",
  Synchronisation: "/synchronisation",
  Rapports: "/rapports",
  Corbeille: "/corbeille",
  Impressions: "/impressions",
  "Tableau de bord académique": "/academique/tableau-de-bord",
  "Structure académique": "/academique/structure",
  "Classes et étudiants": "/academique/classes",
  Enseignement: "/academique/enseignement",
  "Évaluations et notes": "/academique/notes",
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
  return view === "Fiche dossier" ? "/demandes" : view === "Aide de la page" ? "/" : VIEW_PATHS[view];
}

// L'aide d'un écran vit sous /aide/pages, suivie de l'adresse de cet écran.
const HELP_PREFIX = "/aide/pages";
const HELP_SLUGS: Partial<Record<HelpedView, string>> = { "Vue d'ensemble": "/accueil", "Fiche dossier": "/fiche-dossier" };

export function pathForHelp(view: HelpedView, returnPath?: string | null): string {
  const slug = HELP_SLUGS[view] ?? VIEW_PATHS[view as keyof typeof VIEW_PATHS];
  return `${HELP_PREFIX}${slug}${returnPath ? `?retour=${encodeURIComponent(returnPath)}` : ""}`;
}

// Adresse de l'écran d'où l'aide a été ouverte (une fiche de dossier, par exemple).
export function helpReturnPath(view: HelpedView): string {
  const origin = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("retour");
  return origin && /^\/(?!\/)/.test(origin) ? origin : pathForView(view);
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
  const help = path.match(/^\/aide\/pages(\/.+)$/);
  if (help) {
    const helpFor = (Object.entries(HELP_SLUGS).find(([, slug]) => slug === help[1])?.[0] ?? PATH_VIEWS.get(help[1])) as HelpedView | undefined;
    if (helpFor) return { view: "Aide de la page", dossier: null, auditUserId: null, helpFor };
  }
  // Chaque rubrique des paramètres a sa propre page.
  const settings = path.match(/^\/parametres\/(apparence|postes|utilisateurs)$/);
  if (settings) return { view: "Paramètres", dossier: null, auditUserId: null, settingsSection: settings[1] as SettingsSection };
  // Page dédiée au profil d'activité d'un utilisateur dans l'audit.
  const auditUser = path.match(/^\/audit\/utilisateurs\/([^/]+)$/);
  if (auditUser) return { view: "Audit", dossier: null, auditUserId: decodeURIComponent(auditUser[1]) };
  // Une classe a sa page, et chacune de ses rubriques la sienne.
  const classe = path.match(/^\/academique\/classes\/([^/]+)(?:\/(etudiants|cours|assiduite))?$/);
  if (classe) return { view: "Classes et étudiants", dossier: null, auditUserId: null, classId: decodeURIComponent(classe[1]), classSection: (classe[2] as ClassSection | undefined) ?? null };
  // Parcours complet d'un étudiant, toutes années confondues.
  const student = path.match(/^\/academique\/etudiants\/([^/]+)$/);
  if (student) return { view: "Classes et étudiants", dossier: null, auditUserId: null, studentId: decodeURIComponent(student[1]) };
  // Notes d'une matière, puis d'une de ses évaluations.
  const grades = path.match(/^\/academique\/notes\/cours\/([^/]+)(?:\/evaluations\/([^/]+))?$/);
  if (grades) return { view: "Évaluations et notes", dossier: null, auditUserId: null, gradeCourseId: decodeURIComponent(grades[1]), gradeEvaluationId: grades[2] ? decodeURIComponent(grades[2]) : null };
  return { view: PATH_VIEWS.get(path) ?? "Vue d'ensemble", dossier: null, auditUserId: null };
}

export function pathForGrades(courseId: string, evaluationId?: string | null): string {
  return `/academique/notes/cours/${encodeURIComponent(courseId)}${evaluationId ? `/evaluations/${encodeURIComponent(evaluationId)}` : ""}`;
}

export function pathForClass(classId: string, section?: ClassSection | null): string {
  return `/academique/classes/${encodeURIComponent(classId)}${section ? `/${section}` : ""}`;
}

export function pathForStudent(personId: string): string {
  return `/academique/etudiants/${encodeURIComponent(personId)}`;
}

export function navigateTo(path: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== path) window.history.pushState(null, "", path);
  window.scrollTo({ top: 0 });
}

export function pathForAuditUser(userId: string): string {
  return `/audit/utilisateurs/${encodeURIComponent(userId)}`;
}
