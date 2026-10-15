"use client";

import { useEffect, useState } from "react";
import { hasAccess, type AccessArea } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { pathForView } from "@/lib/routes";
import { User, ViewName } from "@/lib/types";

/** Une tâche en attente pour l'utilisateur connecté, avec l'écran où la traiter. */
export type WorkItem = {
  key: string;
  label: string;
  detail: string;
  count: number;
  view: ViewName;
  path: string;
  /** alert : en retard ou bloquant ; warn : à traiter ; info : à surveiller. */
  tone: "alert" | "warn" | "info";
};

type Source = { areas: AccessArea[]; load: () => Promise<WorkItem[]> };
/** Le travail trouvé, et le nombre de rubriques qui n'ont pas pu être vérifiées. */
export type Work = { items: WorkItem[]; unchecked: number };

const at = (view: ViewName, section?: string) => `${pathForView(view)}${section ? `?vue=${section}` : ""}`;
const item = (key: string, label: string, detail: string, count: number, view: ViewName, tone: WorkItem["tone"], section?: string): WorkItem => ({ key, label, detail, count, view, path: at(view, section), tone });

type ExpenseCounters = { brouillons: number; rejetees: number; aValider: number; aExecuter: number };
type AFaire = { relances: { total: number }; entretiens: { total: number }; incomplets: { total: number } };
type AcademicToday = {
  cours: { aPointer: number } | null;
  evaluations: { aValider: unknown[]; enRetard: unknown[]; fichesAGenerer: unknown[] } | null;
  assiduite?: { total: number };
  aCompleter?: { inscriptionsSansClasse: number; coursSansEnseignant: number };
};
type HrDashboard = { congesEnAttente: number; contratsExpirant: unknown[]; sansContrat: number };
type PayPeriod = { statut: string };

// Chaque source n'est interrogée que si l'utilisateur a l'un des droits indiqués ;
// le serveur restreint ensuite les compteurs à ce qui le concerne.
const SOURCES: Source[] = [
  {
    areas: ["expenses", "expense-approval", "expense-final-approval", "expense-payment"],
    load: async () => {
      const counters = await apiFetch<ExpenseCounters>("/depenses/compteurs", { skipCache: true });
      return [
        item("depenses-rejetees", "États de besoin rejetés", "à corriger puis soumettre de nouveau", counters.rejetees, "États de besoin", "alert"),
        item("depenses-brouillons", "États de besoin en brouillon", "pas encore soumis pour validation", counters.brouillons, "États de besoin", "warn"),
        item("depenses-a-valider", "Dépenses à valider", "en attente de votre décision", counters.aValider, "Validation des dépenses", "warn"),
        item("depenses-a-executer", "Dépenses à exécuter", "à réceptionner, facturer ou payer", counters.aExecuter, "Exécution des dépenses", "warn"),
      ];
    },
  },
  {
    areas: ["payments"],
    load: async () => {
      const [unassigned, late] = await Promise.all([
        apiFetch<unknown[]>("/paiements/non-affectes", { skipCache: true }),
        apiFetch<unknown[]>("/rapports/paiements-en-retard", { skipCache: true }),
      ]);
      return [
        item("paiements-a-affecter", "Paiements à affecter", "versements sans obligation", unassigned.length, "Paiements", "alert", "affectation"),
        item("echeances-en-retard", "Échéances en retard", "familles à relancer", late.length, "Paiements", "warn", "retards"),
      ];
    },
  },
  {
    areas: ["dashboard"],
    load: async () => {
      const todo = await apiFetch<AFaire>("/rapports/a-faire", { skipCache: true });
      return [
        item("prospects-a-relancer", "Prospects à relancer", "rappel prévu aujourd'hui ou dépassé", todo.relances.total, "Prospects", "warn"),
        item("entretiens", "Entretiens sous 7 jours", "candidats à recevoir", todo.entretiens.total, "Demandes de bourse", "info"),
        item("dossiers-incomplets", "Dossiers incomplets", "pièces encore manquantes", todo.incomplets.total, "Rapports", "info", "pieces"),
      ];
    },
  },
  {
    areas: ["prospects"],
    load: async () => {
      const summary = await apiFetch<{ aContacter: number }>("/futurs-etudiants/synthese", { skipCache: true });
      return [item("futurs-a-contacter", "Lycéens à contacter", "inscrits par le formulaire public", summary.aContacter, "Futurs étudiants", "warn")];
    },
  },
  {
    areas: ["academics", "teaching", "grades", "deliberations"],
    load: async () => {
      const today = await apiFetch<AcademicToday>("/academique/tableau-de-bord", { skipCache: true });
      return [
        item("cours-a-emarger", "Cours à émarger", "enseignants à pointer aujourd'hui", today.cours?.aPointer ?? 0, "Enseignement", "warn", "emargement"),
        item("notes-a-valider", "Évaluations à valider", "toutes les notes sont saisies", today.evaluations?.aValider.length ?? 0, "Tableau de bord académique", "warn"),
        item("notes-manquantes", "Notes manquantes", "épreuve passée, saisie incomplète", today.evaluations?.enRetard.length ?? 0, "Tableau de bord académique", "alert"),
        item("fiches-anonymat", "Fiches d'anonymat à générer", "épreuves des 7 prochains jours", today.evaluations?.fichesAGenerer.length ?? 0, "Tableau de bord académique", "warn"),
        item("alertes-absences", "Étudiants en alerte d'absences", "au-delà du seuil fixé", today.assiduite?.total ?? 0, "Tableau de bord académique", "info"),
        item("inscrits-sans-classe", "Inscrits sans classe", "à affecter dans une classe", today.aCompleter?.inscriptionsSansClasse ?? 0, "Classes et étudiants", "warn"),
      ];
    },
  },
  {
    areas: ["hr"],
    load: async () => {
      const hr = await apiFetch<HrDashboard>("/rh/tableau-de-bord", { skipCache: true });
      return [
        item("conges", "Demandes de congé", "à approuver ou refuser", hr.congesEnAttente, "Personnel", "warn", "dossiers"),
        item("contrats-expirant", "Contrats à renouveler", "fin dans les 30 jours", hr.contratsExpirant.length, "Personnel", "warn", "dossiers"),
        item("sans-contrat", "Employés sans contrat", "absents de la paie tant qu'ils n'en ont pas", hr.sansContrat, "Personnel", "alert", "dossiers"),
      ];
    },
  },
  {
    areas: ["payroll", "payroll-approval"],
    load: async () => {
      const periods = await apiFetch<PayPeriod[]>("/paie/periodes", { skipCache: true });
      return [
        item("paie-ouverte", "Paie en préparation", "à vérifier puis faire valider", periods.filter((period) => period.statut === "OUVERTE").length, "Paie", "warn", "periodes"),
        item("paie-a-verser", "Paie validée à verser", "enregistrer le versement", periods.filter((period) => period.statut === "VALIDEE").length, "Paie", "alert", "periodes"),
      ];
    },
  },
  {
    areas: ["accounting"],
    load: async () => {
      const journal = await apiFetch<{ meta: { total: number } }>("/comptabilite/journal?page=1&limit=1&statut=BROUILLON", { skipCache: true });
      return [item("ecritures-brouillon", "Écritures en brouillon", "à relire puis valider", journal.meta.total, "Comptabilité", "warn", "journal")];
    },
  },
];

// Les tâches de chaque écran ne concernent que ceux qui peuvent y agir.
const EDIT_AREA: Partial<Record<string, AccessArea[]>> = {
  "depenses-a-valider": ["expense-approval", "expense-final-approval"],
  "depenses-a-executer": ["expense-payment"],
  "paiements-a-affecter": ["payments"],
  "cours-a-emarger": ["teaching", "hr"],
  "notes-a-valider": ["deliberations"],
  "fiches-anonymat": ["deliberations"],
  "notes-manquantes": ["grades", "deliberations"],
  "inscrits-sans-classe": ["academics"],
  "paie-ouverte": ["payroll", "payroll-approval"],
  "paie-a-verser": ["payroll"],
  "ecritures-brouillon": ["accounting"],
  conges: ["hr"],
};

/** Le travail en attente de l'utilisateur, toutes rubriques confondues. */
export function useWork(user: User | null, signal: string | number) {
  const [work, setWork] = useState<Work | null>(null);
  const userKey = user ? `${user.id}:${user.role}:${(user.permissions ?? []).join(",")}` : "";
  useEffect(() => {
    if (!user) return;
    let active = true;
    const sources = SOURCES.filter((source) => source.areas.some((area) => hasAccess(user, area)));
    // Une rubrique injoignable (hors ligne, session expirée) est comptée à part :
    // on n'affirme jamais « tout est à jour » sans l'avoir vérifié.
    void Promise.all(sources.map((source) => source.load().catch(() => null))).then((groups) => {
      if (!active) return;
      const items = groups.flatMap((group) => group ?? []).filter((entry) => {
        const needed = EDIT_AREA[entry.key];
        return !needed || needed.some((area) => hasAccess(user, area, "edit"));
      });
      setWork({ items, unchecked: groups.filter((group) => group === null).length });
    });
    return () => {
      active = false;
    };
    // L'identité et les droits suffisent : l'objet utilisateur est recréé à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey, signal]);
  return work;
}

/** Nombre de tâches en attente par écran, pour les pastilles du menu. */
export function workBadges(work: Work | null): Partial<Record<ViewName, number>> {
  const badges: Partial<Record<ViewName, number>> = {};
  for (const entry of work?.items ?? []) if (entry.count > 0 && entry.tone !== "info") badges[entry.view] = (badges[entry.view] ?? 0) + entry.count;
  return badges;
}
