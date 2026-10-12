"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { hasAccess } from "@/lib/access";
import { navigateTo, pathForDossier, pathForStudent, pathForView } from "@/lib/routes";
import { ApplicationPage, EnrollmentPage, ProspectPage, User, fullName, statusLabels } from "@/lib/types";

type Result = { key: string; group: string; title: string; detail: string; badge: string; path: string };
type StudentHit = { id: string; nom: string; prenom: string; matricule: string | null; classe: { nom: string; annee: string } | null };

async function search(query: string, user: User | null): Promise<Result[]> {
  const q = encodeURIComponent(query);
  const options = { skipCache: true } as const;
  const [students, applications, enrollments, prospects] = await Promise.all([
    hasAccess(user, "academics") || hasAccess(user, "deliberations")
      ? apiFetch<StudentHit[]>(`/deliberations/etudiants?q=${q}`, options).catch(() => null)
      : null,
    hasAccess(user, "scholarships")
      ? apiFetch<ApplicationPage>(`/demandes-bourse?page=1&limit=5&q=${q}`, options).catch(() => null)
      : null,
    hasAccess(user, "enrollments")
      ? apiFetch<EnrollmentPage>(`/inscriptions?page=1&limit=5&q=${q}`, options).catch(() => null)
      : null,
    hasAccess(user, "prospects")
      ? apiFetch<ProspectPage>(`/prospects?page=1&limit=5&q=${q}`, options).catch(() => null)
      : null,
  ]);
  return [
    // Un étudiant mène à son parcours complet, toutes années confondues.
    ...(students ?? []).map((item) => ({
      key: `etudiant:${item.id}`,
      group: "Étudiants",
      title: `${item.nom} ${item.prenom}`,
      detail: [item.matricule, item.classe && `${item.classe.nom} · ${item.classe.annee}`].filter(Boolean).join(" · "),
      badge: "Parcours",
      path: pathForStudent(item.id),
    })),
    ...(applications?.data ?? []).map((item) => ({
      key: `demande:${item.id}`,
      group: "Demandes de bourse",
      title: fullName(item.personne),
      detail: [item.filiereSouhaitee, item.personne?.telephone].filter(Boolean).join(" · "),
      badge: statusLabels[item.statut] ?? item.statut,
      path: pathForDossier({ type: "demande-bourse", id: item.id }),
    })),
    ...(enrollments?.data ?? []).map((item) => ({
      key: `inscription:${item.id}`,
      group: "Inscriptions",
      title: fullName(item.personne),
      detail: [item.filiere, item.niveau, item.anneeScolaire].filter(Boolean).join(" · "),
      badge: statusLabels[item.statut] ?? item.statut,
      path: pathForDossier({ type: "inscription", id: item.id }),
    })),
    ...(prospects?.data ?? []).map((item) => ({
      key: `prospect:${item.id}`,
      group: "Prospects",
      title: fullName(item.personne),
      detail: [item.filiereSouhaitee, item.personne?.telephone].filter(Boolean).join(" · "),
      badge: statusLabels[item.statutRelance] ?? item.statutRelance,
      path: pathForView("Prospects"),
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
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
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
          aria-label="Rechercher une personne ou un dossier"
          placeholder="Rechercher un nom, un matricule, un téléphone…"
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
          {!loading && !visible.length && <p className="global-search-empty">Aucun dossier ne correspond à « {term} ».</p>}
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
