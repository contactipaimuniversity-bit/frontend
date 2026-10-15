"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { hasAccess, type AccessArea } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { navigateTo, pathForView } from "@/lib/routes";
import { User, ViewName } from "@/lib/types";

type Check = { key: string; module: string; label: string; todo: string; done: boolean; path: string };
type Probe = { module: string; areas: AccessArea[] | "admin"; load: () => Promise<Check[]> };

const at = (view: ViewName, section?: string) => `${pathForView(view)}${section ? `?vue=${section}` : ""}`;
const covers = (period: { dateDebut: string; dateFin: string }) => {
  const now = Date.now();
  return new Date(period.dateDebut).getTime() <= now && new Date(period.dateFin).getTime() >= now;
};

// Tout ce qui doit être réglé avant de travailler, rubrique par rubrique, vérifié
// en direct : un réglage manquant apparaît en orange avec le lien pour le faire.
const PROBES: Probe[] = [
  {
    module: "Accès",
    areas: "admin",
    load: async () => {
      const [positions, users] = await Promise.all([apiFetch<unknown[]>("/utilisateurs/postes"), apiFetch<unknown[]>("/utilisateurs")]);
      return [
        { key: "postes", module: "Accès", label: "Postes métier et leurs droits", todo: "Créez un poste par métier (caisse, comptabilité, scolarité...) et cochez ses accès.", done: positions.length > 0, path: "/parametres/postes" },
        { key: "comptes", module: "Accès", label: "Comptes de l'équipe", todo: "Créez un compte pour chaque personne qui utilise l'application.", done: users.length > 1, path: "/parametres/utilisateurs" },
      ];
    },
  },
  {
    module: "Admissions",
    areas: ["references"],
    load: async () => {
      const [types, elements] = await Promise.all([apiFetch<unknown[]>("/types-bourse"), apiFetch<unknown[]>("/elements-requis")]);
      return [
        { key: "types-bourse", module: "Admissions", label: "Types de bourse et échéances", todo: "Créez les types de bourse avec leurs frais et leurs échéances.", done: types.length > 0, path: at("Référentiels", "bourses") },
        { key: "pieces", module: "Admissions", label: "Pièces et frais demandés", todo: "Indiquez les documents et frais exigés par niveau.", done: elements.length > 0, path: at("Référentiels", "dossiers") },
      ];
    },
  },
  {
    module: "Finances",
    areas: ["finance-settings"],
    load: async () => {
      const [categories, suppliers, years, budget] = await Promise.all([
        apiFetch<Array<{ actif: boolean }>>("/finances/categories"),
        apiFetch<Array<{ actif: boolean }>>("/finances/fournisseurs"),
        apiFetch<Array<{ dateDebut: string; dateFin: string; cloture: boolean }>>("/finances/exercices"),
        apiFetch<{ lignes?: Array<{ budget: string | number }> }>("/finances/budget").catch(() => null),
      ]);
      const open = years.some((year) => !year.cloture && covers(year));
      return [
        { key: "categories", module: "Finances", label: "Catégories de dépense", todo: "Créez les lignes budgétaires (fournitures, entretien, électricité...).", done: categories.some((item) => item.actif), path: at("Paramètres finances", "categories") },
        { key: "fournisseurs", module: "Finances", label: "Fournisseurs", todo: "Enregistrez les fournisseurs habituels.", done: suppliers.some((item) => item.actif), path: at("Paramètres finances", "fournisseurs") },
        { key: "exercice", module: "Finances", label: "Exercice budgétaire ouvert aujourd'hui", todo: "Sans exercice ouvert, aucun état de besoin ne peut être soumis.", done: open, path: at("Paramètres finances", "exercices") },
        { key: "budget", module: "Finances", label: "Budget saisi par catégorie", todo: "Saisissez le montant voté pour chaque catégorie de l'exercice.", done: Boolean(budget?.lignes?.some((line) => Number(line.budget) > 0)), path: pathForView("Budget") },
      ];
    },
  },
  {
    module: "Académique",
    areas: ["academics"],
    load: async () => {
      const [years, programs] = await Promise.all([
        apiFetch<Array<{ dateDebut: string; dateFin: string; _count?: { classes: number } }>>("/academique/annees"),
        apiFetch<Array<{ actif: boolean }>>("/academique/filieres"),
      ]);
      const current = years.find(covers);
      return [
        { key: "annee", module: "Académique", label: "Année académique en cours", todo: "Ouvrez l'année, avec le même libellé que l'année scolaire des inscriptions.", done: Boolean(current), path: at("Structure académique", "annees") },
        { key: "filieres", module: "Académique", label: "Filières", todo: "Créez ou chargez les filières de l'établissement.", done: programs.some((item) => item.actif), path: at("Structure académique", "filieres") },
        { key: "classes", module: "Académique", label: "Classes de l'année", todo: "Créez les classes de l'année en cours.", done: Boolean(current?._count?.classes), path: pathForView("Classes et étudiants") },
      ];
    },
  },
  {
    module: "Ressources humaines",
    areas: ["payroll"],
    load: async () => {
      const rubrics = await apiFetch<unknown[]>("/paie/rubriques");
      return [{ key: "rubriques", module: "Ressources humaines", label: "Rubriques de paie", todo: "Réglez les primes, retenues et charges (CNSS, impôts).", done: rubrics.length > 0, path: at("Paie", "rubriques") }];
    },
  },
  {
    module: "Sécurité",
    areas: "admin",
    load: async () => {
      const backups = await apiFetch<{ derniereReussie: string | null; enRetard: boolean }>("/sauvegardes");
      return [{ key: "sauvegarde", module: "Sécurité", label: "Sauvegarde récente de la base", todo: "Aucune sauvegarde réussie récemment : lancez-en une et vérifiez la sauvegarde automatique.", done: Boolean(backups.derniereReussie) && !backups.enRetard, path: pathForView("Sauvegardes") }];
    },
  },
];

export function SetupChecklist({ user }: { user: User | null }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  useEffect(() => {
    let active = true;
    const probes = PROBES.filter((probe) => (probe.areas === "admin" ? user?.role === "admin" : probe.areas.some((area) => hasAccess(user, area))));
    void Promise.all(probes.map((probe) => probe.load().catch(() => [] as Check[]))).then((groups) => {
      if (active) setChecks(groups.flat());
    });
    return () => {
      active = false;
    };
  }, [user]);
  if (!checks) return <p className="empty-state">Vérification des réglages…</p>;
  if (!checks.length) return <p className="empty-state">Aucun réglage ne dépend de votre poste.</p>;
  const done = checks.filter((check) => check.done).length;
  const modules = [...new Set(checks.map((check) => check.module))];
  return (
    <section className="panel full-panel setup-checklist">
      <div className="manual-progress" role="progressbar" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={done} aria-label="Réglages faits">
        <span style={{ width: `${Math.round((done / checks.length) * 100)}%` }} />
      </div>
      <p className="manual-progress-label">{done === checks.length ? "Tout est en place." : `${done} réglage(s) fait(s) sur ${checks.length} : les lignes en orange restent à faire.`}</p>
      {modules.map((module) => (
        <div key={module} className="setup-module">
          <h3>{module}</h3>
          <ul>
            {checks.filter((check) => check.module === module).map((check) => (
              <li key={check.key} className={check.done ? "done" : "todo"}>
                {check.done ? <CheckCircle2 size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
                <span><strong>{check.label}</strong>{!check.done && <small>{check.todo}</small>}</span>
                <button type="button" className="outline-button small" onClick={() => navigateTo(check.path)}>{check.done ? "Voir" : "Régler"} <ArrowRight size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
