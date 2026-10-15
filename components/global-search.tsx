"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { canAccessView, canOpenPersonFile, hasAccess } from "@/lib/access";
import { LOCATION_EVENT, navigateTo, pathForDossier, pathForPerson, pathForStudent, pathForView } from "@/lib/routes";
import { ApplicationPage, EnrollmentPage, ExpenseSummary, Person, ProspectPage, Supplier, User, formatDate, formatMoney, fullName, statusLabels } from "@/lib/types";

type Result = { key: string; group: string; title: string; detail: string; badge: string; path: string };
type StudentHit = { id: string; nom: string; prenom: string; matricule: string | null; classe: { nom: string; annee: string } | null };
type ReceiptHit = { id: string; numeroRecu: string | null; montant: string | number; datePaiement: string; typePaiement: string; personne?: Person };
type EmployeeHit = { id: string; matricule: string; nom: string; prenom: string; fonction: string; statut: string };
type FutureStudentHit = { id: string; nom: string; prenom: string; ecole: string; classe: string; serie: string; tuteurTelephone: string; contacte: boolean };

const EXPENSE_STATUS: Record<string, string> = {
  BROUILLON: "Brouillon",
  SOUMISE: "À valider",
  VALIDATION_FINALE: "Validation finale",
  VALIDEE: "Validée",
  RECEPTIONNEE: "Livrée",
  FACTUREE: "À payer",
  PAYEE_PARTIELLEMENT: "Payée en partie",
  PAYEE: "Payée",
  REJETEE: "Rejetée",
  ANNULEE: "Annulée",
};

const PER_GROUP = 4;
const take = <T,>(items: T[] | null | undefined) => (items ?? []).slice(0, PER_GROUP);
const matches = (value: string | null | undefined, query: string) => Boolean(value && value.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
const EXPENSE_AREAS = ["expenses", "expense-approval", "expense-final-approval", "expense-payment"] as const;

// Une seule case pour tout retrouver : personnes, reçus, états de besoin, employés...
// Chaque rubrique n'est interrogée que si l'utilisateur y a accès.
async function search(query: string, user: User | null): Promise<Result[]> {
  const q = encodeURIComponent(query);
  const options = { skipCache: true } as const;
  const can = (area: Parameters<typeof hasAccess>[1]) => hasAccess(user, area);
  const seesPeople = canOpenPersonFile(user);
  const seesExpenses = EXPENSE_AREAS.some(can);
  const expenseView = (["États de besoin", "Validation des dépenses", "Exécution des dépenses"] as const).find((view) => canAccessView(user, view));
  const [people, students, applications, enrollments, prospects, future, receipts, expenses, employees, suppliers] = await Promise.all([
    seesPeople ? apiFetch<{ data: Person[] }>(`/personnes?page=1&limit=${PER_GROUP}&q=${q}`, options).catch(() => null) : null,
    !seesPeople && (can("academics") || can("deliberations")) ? apiFetch<StudentHit[]>(`/deliberations/etudiants?q=${q}`, options).catch(() => null) : null,
    // Sans la fiche personne, on retombe sur les dossiers eux-mêmes.
    !seesPeople && can("scholarships") ? apiFetch<ApplicationPage>(`/demandes-bourse?page=1&limit=${PER_GROUP}&q=${q}`, options).catch(() => null) : null,
    !seesPeople && can("enrollments") ? apiFetch<EnrollmentPage>(`/inscriptions?page=1&limit=${PER_GROUP}&q=${q}`, options).catch(() => null) : null,
    can("prospects") ? apiFetch<ProspectPage>(`/prospects?page=1&limit=${PER_GROUP}&q=${q}`, options).catch(() => null) : null,
    can("prospects") ? apiFetch<{ data: FutureStudentHit[] }>(`/futurs-etudiants?page=1&limit=${PER_GROUP}&q=${q}`, options).catch(() => null) : null,
    can("payments") ? apiFetch<ReceiptHit[]>(`/paiements?q=${q}&limit=${PER_GROUP}`, options).catch(() => null) : null,
    seesExpenses ? apiFetch<{ data: ExpenseSummary[] }>(`/depenses?page=1&limit=${PER_GROUP}&q=${q}`, options).catch(() => null) : null,
    can("hr") || can("payroll") ? apiFetch<{ data: EmployeeHit[] }>(`/rh/employes?limit=${PER_GROUP}&q=${q}`, options).catch(() => null) : null,
    can("finance-settings") ? apiFetch<Supplier[]>("/finances/fournisseurs", options).catch(() => null) : null,
  ]);
  return [
    // Une personne mène à sa fiche unique : dossiers, paiements, scolarité.
    ...take(people?.data).map((item) => ({
      key: `personne:${item.id}`,
      group: "Personnes",
      title: fullName(item),
      detail: [item.matricule, item.telephone, item.quartier].filter(Boolean).join(" · "),
      badge: "Fiche",
      path: pathForPerson(item.id),
    })),
    ...take(students).map((item) => ({
      key: `etudiant:${item.id}`,
      group: "Étudiants",
      title: `${item.nom} ${item.prenom}`,
      detail: [item.matricule, item.classe && `${item.classe.nom} · ${item.classe.annee}`].filter(Boolean).join(" · "),
      badge: "Parcours",
      path: pathForStudent(item.id),
    })),
    ...take(applications?.data).map((item) => ({
      key: `demande:${item.id}`,
      group: "Demandes de bourse",
      title: fullName(item.personne),
      detail: [item.filiereSouhaitee, item.personne?.telephone].filter(Boolean).join(" · "),
      badge: statusLabels[item.statut] ?? item.statut,
      path: pathForDossier({ type: "demande-bourse", id: item.id }),
    })),
    ...take(enrollments?.data).map((item) => ({
      key: `inscription:${item.id}`,
      group: "Inscriptions",
      title: fullName(item.personne),
      detail: [item.filiere, item.niveau, item.anneeScolaire].filter(Boolean).join(" · "),
      badge: statusLabels[item.statut] ?? item.statut,
      path: pathForDossier({ type: "inscription", id: item.id }),
    })),
    ...take(receipts?.filter((item) => matches(item.numeroRecu, query) || matches(fullName(item.personne), query))).map((item) => ({
      key: `recu:${item.id}`,
      group: "Reçus et paiements",
      title: item.numeroRecu ?? "Opération sans reçu",
      detail: [fullName(item.personne), formatMoney(item.montant), formatDate(item.datePaiement)].join(" · "),
      badge: statusLabels[item.typePaiement] ?? item.typePaiement,
      path: `${pathForView("Paiements")}?vue=journal&q=${encodeURIComponent(item.numeroRecu ?? fullName(item.personne))}`,
    })),
    ...take(expenses?.data).map((item) => ({
      key: `depense:${item.id}`,
      group: "États de besoin",
      title: `${item.numero} · ${item.objet}`,
      detail: [item.fournisseur?.nom, formatMoney(item.montant), item.initiateurNom].filter(Boolean).join(" · "),
      badge: EXPENSE_STATUS[item.statut] ?? item.statut,
      path: `${pathForView(expenseView ?? "États de besoin")}?depense=${encodeURIComponent(item.id)}`,
    })),
    ...take(suppliers?.filter((item) => matches(item.nom, query) || matches(item.telephone, query))).map((item) => ({
      key: `fournisseur:${item.id}`,
      group: "Fournisseurs",
      title: item.nom,
      detail: [item.telephone, item.email].filter(Boolean).join(" · "),
      badge: item.actif ? "Actif" : "Inactif",
      path: `${pathForView("Paramètres finances")}?vue=fournisseurs`,
    })),
    ...take(employees?.data).map((item) => ({
      key: `employe:${item.id}`,
      group: "Personnel",
      title: `${item.nom} ${item.prenom}`,
      detail: [item.matricule, item.fonction].filter(Boolean).join(" · "),
      badge: item.statut === "ACTIF" ? "En activité" : item.statut === "SORTI" ? "Sorti" : "Suspendu",
      path: `${pathForView("Personnel")}?vue=dossiers&employe=${encodeURIComponent(item.id)}`,
    })),
    ...take(prospects?.data).map((item) => ({
      key: `prospect:${item.id}`,
      group: "Prospects",
      title: fullName(item.personne),
      detail: [item.filiereSouhaitee, item.personne?.telephone].filter(Boolean).join(" · "),
      badge: statusLabels[item.statutRelance] ?? item.statutRelance,
      path: seesPeople && item.personne?.id ? pathForPerson(item.personne.id) : pathForView("Prospects"),
    })),
    ...take(future?.data).map((item) => ({
      key: `futur:${item.id}`,
      group: "Futurs étudiants",
      title: `${item.nom} ${item.prenom}`,
      detail: [item.ecole, `${item.classe} · série ${item.serie}`, item.tuteurTelephone].filter(Boolean).join(" · "),
      badge: item.contacte ? "Contacté" : "À contacter",
      path: `${pathForView("Futurs étudiants")}?q=${encodeURIComponent(item.nom)}`,
    })),
  ];
}

export function GlobalSearch({ user }: { user: User | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loadedQuery, setLoadedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const loading = term.length >= 2 && loadedQuery !== term;

  useEffect(() => {
    if (term.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void search(term, user).then((found) => {
        if (!active) return;
        setResults(found);
        setLoadedQuery(term);
        setActiveIndex(0);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [term, user]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    // Un changement d'écran (lien, retour arrière) referme la liste.
    const onLocation = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("popstate", onLocation);
    window.addEventListener(LOCATION_EVENT, onLocation);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("popstate", onLocation);
      window.removeEventListener(LOCATION_EVENT, onLocation);
    };
  }, []);

  const visible = term.length >= 2 ? results ?? [] : [];
  const choose = (result: Result) => {
    setOpen(false);
    setQuery("");
    input.current?.blur();
    navigateTo(result.path);
  };

  return (
    <div className="global-search" ref={container}>
      <div className="global-search-field">
        <Search aria-hidden="true" focusable="false" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open && term.length >= 2}
          aria-controls="global-search-results"
          aria-label="Rechercher une personne, un dossier, un reçu ou une dépense"
          placeholder="Nom, matricule, téléphone, n° de reçu ou d'état de besoin…"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setOpen(false); event.currentTarget.blur(); }
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, visible.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === "Enter" && visible[activeIndex]) { event.preventDefault(); choose(visible[activeIndex]); }
          }}
        />
        <kbd>Ctrl K</kbd>
      </div>
      {open && term.length >= 2 && (
        <div className="global-search-panel" id="global-search-results" role="listbox">
          {loading && !visible.length && <p className="global-search-empty">Recherche…</p>}
          {!loading && !visible.length && <p className="global-search-empty">Rien ne correspond à « {term} ».</p>}
          {visible.map((result, index) => (
            <div key={result.key}>
              {(index === 0 || visible[index - 1].group !== result.group) && <p className="global-search-group">{result.group}</p>}
              <button type="button" role="option" aria-selected={index === activeIndex} className={`global-search-result ${index === activeIndex ? "active" : ""}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(result)}>
                <span><strong>{result.title}</strong>{result.detail && <small>{result.detail}</small>}</span>
                <span>{result.badge}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
