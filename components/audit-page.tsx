"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowLeft, ChevronDown, Clock, Download, Eye, LogIn, MousePointerClick, Pause, PencilLine, Play, Search, ShieldAlert, Users, X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { tablePdf } from "@/lib/pdf-docs";
import { navigateTo, pathForAuditUser, pathForDossier } from "@/lib/routes";
import { toast } from "@/components/feedback";
import { AuditChange, ChangesTable, ValuesList, auditDateTime, flattenValues, summarizeChanges } from "@/components/audit-values";

type Genre = "action" | "echec" | "navigation" | "clic";
type FeedItem = {
  genre: Genre;
  id: string;
  date: string;
  utilisateurId: string;
  utilisateurNom: string;
  // action / échec
  action?: string;
  ressource?: string;
  cible?: string | null;
  entiteId?: string | null;
  methode?: string | null;
  chemin?: string | null;
  statutHttp?: number | null;
  dureeMs?: number | null;
  ip?: string | null;
  navigateur?: string | null;
  erreur?: string | null;
  donnees?: { envoye?: unknown; supprime?: unknown } | null;
  modifications?: AuditChange[] | null;
  // navigation / clic
  page?: string;
  titre?: string;
  element?: string;
  type?: string;
  contexte?: string | null;
};
type UserRow = { utilisateurId: string; nom: string; role: string | null; poste: string | null; compteActif: boolean; actions: number; echecs: number; tempsMs: number; pagesVues: number; clics: number; enLigne: boolean; derniereActivite: string | null };
type Summary = {
  totaux: { actions: number; echecs: number; tempsMs: number; clics: number; enLigne: number; utilisateursActifs: number };
  parUtilisateur: UserRow[];
  parPage: Array<{ titre: string; tempsMs: number; visites: number; clics: number }>;
  parRessource: Array<{ ressource: string; actions: number }>;
  utilisateurs: Array<{ id: string; nom: string }>;
};
type Timeline = { pas: "heure" | "jour"; buckets: Array<{ debut: string; actions: number; echecs: number; clics: number; visites: number; tempsMs: number }> };
type Profile = {
  utilisateur: { id: string; nom: string; email: string; role: string; poste: string | null } | null;
  totaux: { tempsMs: number; visites: number; clics: number; actions: number; echecs: number };
  tempsParPage: Array<{ titre: string; tempsMs: number; visites: number; clics: number }>;
  parcours: Array<{ id: string; page: string; titre: string; debut: string; dureeMs: number }>;
  clicsParElement: Array<{ element: string; titre: string; clics: number }>;
  actionsParType: Array<{ action: string; total: number }>;
  appareils: Array<{ ip: string | null; navigateur: string | null; actions: number; derniereUtilisation: string | null }>;
};
type Period = "today" | "7d" | "30d" | "custom";

const REFRESH_MS = 10_000;
const GENRES: Array<{ value: Genre; label: string }> = [
  { value: "action", label: "Actions" },
  { value: "echec", label: "Refus" },
  { value: "navigation", label: "Écrans consultés" },
  { value: "clic", label: "Clics" },
];

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const clock = (value: string | number | Date) => new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function duration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, "0")} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

function ago(value: string | null, now: number) {
  if (!value) return "jamais";
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 10) return "à l’instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`;
  return `il y a ${Math.floor(seconds / 86400)} j`;
}

function device(agent?: string | null) {
  if (!agent) return "—";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Navigateur";
  const system = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return [browser, system].filter(Boolean).join(" · ");
}

const itemKey = (item: FeedItem) => `${item.genre === "echec" ? "action" : item.genre}:${item.id}`;

function dossierPath(item: FeedItem) {
  const match = item.chemin?.match(/^\/(demandes-bourse|inscriptions)\/([0-9a-f-]{36})/);
  if (!match || item.methode === "DELETE") return null;
  return pathForDossier({ type: match[1] === "demandes-bourse" ? "demande-bourse" : "inscription", id: match[2] });
}

// Phrase lisible pour chaque événement du flux.
function describe(item: FeedItem): { title: string; detail: string } {
  if (item.genre === "navigation") return { title: `A consulté « ${item.titre} »`, detail: `Pendant ${duration(item.dureeMs ?? 0)}${item.page && item.page.split("/").length > 2 ? ` · ${item.page}` : ""}` };
  if (item.genre === "clic") return { title: `A cliqué sur « ${item.element} »`, detail: [item.contexte, item.titre].filter(Boolean).join(" · ") };
  const changes = item.modifications ?? [];
  const values = [...flattenValues(item.donnees?.envoye), ...flattenValues(item.donnees?.supprime)];
  const detail = item.erreur ?? (changes.length ? summarizeChanges(changes, 3) : values.slice(0, 3).map(([label, value]) => `${label} : ${value}`).join(" · "));
  return { title: [item.action, item.cible].filter(Boolean).join(" · "), detail };
}

function GenreIcon({ item }: { item: FeedItem }) {
  const Icon = item.genre === "echec" ? ShieldAlert : item.genre === "navigation" ? Eye : item.genre === "clic" ? MousePointerClick : item.ressource === "session" ? LogIn : PencilLine;
  return <span className={`audit-feed-icon ${item.genre}`}><Icon size={15} strokeWidth={1.9} aria-hidden="true" /></span>;
}

function ItemDetail({ item }: { item: FeedItem }) {
  const path = dossierPath(item);
  return (
    <div className="audit-detail">
      {item.erreur && <p className="audit-detail-error"><strong>Motif du refus :</strong> {item.erreur}</p>}
      <ChangesTable changes={item.modifications ?? []} />
      <ValuesList title="Valeurs saisies" values={item.donnees?.envoye} />
      <ValuesList title="Enregistrement supprimé" values={item.donnees?.supprime} />
      <section>
        <h4>Informations techniques</h4>
        <dl className="audit-values">
          <div><dt>Date exacte</dt><dd>{auditDateTime(item.date)}</dd></div>
          <div><dt>Requête</dt><dd>{item.methode ?? "—"} {item.chemin ?? ""}</dd></div>
          <div><dt>Code de réponse</dt><dd>{item.statutHttp ?? "—"}</dd></div>
          <div><dt>Temps de traitement</dt><dd>{item.dureeMs != null ? `${item.dureeMs} ms` : "—"}</dd></div>
          <div><dt>Adresse IP</dt><dd>{item.ip ?? "—"}</dd></div>
          <div><dt>Appareil</dt><dd title={item.navigateur ?? undefined}>{device(item.navigateur)}</dd></div>
          <div><dt>Identifiant de l’enregistrement</dt><dd>{item.entiteId ?? "—"}</dd></div>
          <div><dt>Identifiant de l’utilisateur</dt><dd>{item.utilisateurId}</dd></div>
        </dl>
      </section>
      {path && <button type="button" className="outline-button small" onClick={() => navigateTo(path)}>Ouvrir le dossier concerné →</button>}
    </div>
  );
}

function Bars({ rows, unit }: { rows: Array<{ label: string; value: number; note: string }>; unit: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="audit-bars">
      {rows.map((row, index) => (
        <div className="audit-bar" key={`${index}-${row.label}-${row.note}`}>
          <div><strong title={row.label}>{row.label}</strong><span>{unit(row.value)}{row.note ? ` · ${row.note}` : ""}</span></div>
          <i style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function TimelineChart({ timeline }: { timeline: Timeline }) {
  const max = Math.max(1, ...timeline.buckets.map((bucket) => bucket.actions + bucket.echecs + bucket.clics));
  const label = (value: string) => timeline.pas === "heure"
    ? new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const every = Math.max(1, Math.ceil(timeline.buckets.length / 12));
  return (
    <div className="audit-timeline" role="img" aria-label="Volume d’activité dans le temps">
      <div className="audit-timeline-bars" style={{ gridTemplateColumns: `repeat(${timeline.buckets.length}, minmax(0, 1fr))` }}>
        {timeline.buckets.map((bucket) => (
          <div className="audit-timeline-column" key={bucket.debut} title={`${label(bucket.debut)} — ${bucket.actions} action(s), ${bucket.echecs} refus, ${bucket.clics} clic(s), ${duration(bucket.tempsMs)} d’activité`}>
            <i className="clics" style={{ height: `${(bucket.clics / max) * 100}%` }} />
            <i className="echecs" style={{ height: `${(bucket.echecs / max) * 100}%` }} />
            <i className="actions" style={{ height: `${(bucket.actions / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="audit-timeline-axis" style={{ gridTemplateColumns: `repeat(${timeline.buckets.length}, minmax(0, 1fr))` }}>
        {timeline.buckets.map((bucket, index) => <span key={bucket.debut}>{index % every === 0 ? label(bucket.debut) : ""}</span>)}
      </div>
    </div>
  );
}

type PickableUser = { id: string; nom: string; detail: string };

// Filtre par utilisateur : on tape quelques lettres, la liste se réduit aux
// correspondances. Pas de liste déroulante complète, qui deviendrait interminable.
function UserPicker({ users, value, onChange }: { users: PickableUser[]; value: string; onChange: (id: string) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const selected = users.find((user) => user.id === value);
  const needle = text.trim().toLocaleLowerCase();
  const matches = users.filter((user) => !needle || `${user.nom} ${user.detail}`.toLocaleLowerCase().includes(needle));
  const shown = matches.slice(0, 8);
  const choose = (id: string) => { onChange(id); setText(""); setOpen(false); };
  if (selected)
    return (
      <span className="audit-user-filter chosen">
        <Users size={14} aria-hidden="true" />
        <strong>{selected.nom}</strong>
        <button type="button" onClick={() => onChange("")} aria-label={`Retirer le filtre sur ${selected.nom}`}><X size={14} aria-hidden="true" /></button>
      </span>
    );
  return (
    <span className="audit-user-filter">
      <Search size={14} aria-hidden="true" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls="audit-user-options"
        aria-label="Filtrer par utilisateur"
        placeholder="Filtrer par utilisateur…"
        value={text}
        onChange={(event) => { setText(event.target.value); setOpen(true); setCursor(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setCursor((current) => Math.min(current + 1, shown.length - 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setCursor((current) => Math.max(current - 1, 0)); }
          else if (event.key === "Enter" && open && shown[cursor]) { event.preventDefault(); choose(shown[cursor].id); }
          else if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <span className="audit-user-options" id="audit-user-options" role="listbox">
          {shown.map((user, index) => (
            <button type="button" role="option" aria-selected={index === cursor} key={user.id} className={index === cursor ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setCursor(index)} onClick={() => choose(user.id)}>
              <strong>{user.nom}</strong><small>{user.detail}</small>
            </button>
          ))}
          {!shown.length && <em>Aucun utilisateur ne correspond.</em>}
          {matches.length > shown.length && <em>{matches.length - shown.length} autre(s) : précisez votre recherche.</em>}
        </span>
      )}
    </span>
  );
}

export function AuditPage({ refreshSignal, focusUserId }: { refreshSignal: number; focusUserId?: string | null }) {
  const today = useMemo(() => isoDay(new Date()), []);
  const [period, setPeriod] = useState<Period>("today");
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  // Le profil d'un utilisateur a sa propre adresse : /audit/utilisateurs/<id>.
  const userId = focusUserId ?? "";
  const setUserId = (id: string) => navigateTo(id ? pathForAuditUser(id) : "/audit");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [resource, setResource] = useState("");
  const [method, setMethod] = useState("");
  const [screen, setScreen] = useState("");
  // Filtre du flux sur un utilisateur, sans quitter la vue d'ensemble.
  const [feedUserId, setFeedUserId] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id?: string; nom: string; prenom?: string | null; poste?: { nom: string } | null; role: string }>>([]);
  const [live, setLive] = useState(true);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feed, setFeed] = useState<{ key: string; items: FeedItem[]; next: string | null } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const loadedKey = useRef("");
  const loaded = useRef<{ items: FeedItem[]; next: string | null }>({ items: [], next: null });

  const range = useMemo(() => {
    if (period === "custom") return { dateDebut: customStart, dateFin: customEnd };
    const start = new Date();
    start.setDate(start.getDate() - (period === "today" ? 0 : period === "7d" ? 6 : 29));
    return { dateDebut: isoDay(start), dateFin: today };
  }, [customEnd, customStart, period, today]);
  const rangeQuery = new URLSearchParams(range).toString();
  const scopeQuery = `${rangeQuery}${userId ? `&utilisateurId=${encodeURIComponent(userId)}` : ""}`;
  const feedQuery = useMemo(() => {
    const params = new URLSearchParams(scopeQuery);
    if (!userId && feedUserId) params.set("utilisateurId", feedUserId);
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (genres.length) params.set("types", genres.join(","));
    if (resource) params.set("ressource", resource);
    if (method) params.set("methode", method);
    if (screen) params.set("page_", screen);
    return params.toString();
  }, [debouncedQuery, feedUserId, genres, method, resource, scopeQuery, screen, userId]);

  // Tous les comptes, y compris ceux sans activité sur la période.
  useEffect(() => {
    void apiFetch<typeof accounts>("/utilisateurs", { skipCache: true }).then(setAccounts).catch(() => undefined);
  }, [refreshSignal]);

  // Recherche au fil de la frappe.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Actualisation silencieuse toutes les 10 secondes, suspendue si l'onglet est masqué.
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiFetch<Summary>(`/audit/synthese?${rangeQuery}`, { skipCache: true }),
      apiFetch<Timeline>(`/audit/chronologie?${scopeQuery}`, { skipCache: true }),
    ])
      .then(([nextSummary, nextTimeline]) => {
        if (!active) return;
        setSummary(nextSummary);
        setTimeline(nextTimeline);
        setUpdatedAt(Date.now());
        setNow(Date.now());
        setError("");
      })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Audit indisponible."); });
    return () => { active = false; };
  }, [rangeQuery, scopeQuery, tick, refreshSignal]);

  useEffect(() => {
    if (!userId || userId === "anonyme") return;
    let active = true;
    void apiFetch<Profile>(`/audit/utilisateurs/${encodeURIComponent(userId)}?${rangeQuery}`, { skipCache: true })
      .then((result) => { if (active) setProfile(result); })
      .catch(() => { if (active) setProfile(null); });
    return () => { active = false; };
  }, [rangeQuery, userId, tick, refreshSignal]);

  // Flux : un changement de filtre remplace la liste ; une actualisation n'ajoute que les nouveautés en tête.
  useEffect(() => {
    let active = true;
    void apiFetch<{ data: FeedItem[]; suivant: string | null }>(`/audit/flux?${feedQuery}&limit=60`, { skipCache: true })
      .then((result) => {
        if (!active) return;
        if (loadedKey.current !== feedQuery) {
          loadedKey.current = feedQuery;
          loaded.current = { items: result.data, next: result.suivant };
          setFresh(new Set());
          setExpanded(null);
        } else {
          const known = new Set(loaded.current.items.map(itemKey));
          const added = result.data.filter((item) => !known.has(itemKey(item)));
          if (added.length) loaded.current = { ...loaded.current, items: [...added, ...loaded.current.items] };
          setFresh(new Set(added.map(itemKey)));
        }
        setFeed({ key: feedQuery, ...loaded.current });
        setError("");
      })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Flux indisponible."); });
    return () => { active = false; };
  }, [feedQuery, tick, refreshSignal]);

  const items = feed?.key === feedQuery ? feed.items : null;
  const selectedUser = summary?.parUtilisateur.find((user) => user.utilisateurId === userId) ?? null;
  const currentProfile = userId && profile?.utilisateur?.id === userId ? profile : null;
  const toggleGenre = (genre: Genre) => setGenres((current) => current.includes(genre) ? current.filter((value) => value !== genre) : [...current, genre]);
  const hasFilters = Boolean(query || genres.length || resource || method || screen || feedUserId);
  const clearFilters = () => { setQuery(""); setGenres([]); setResource(""); setMethod(""); setScreen(""); setFeedUserId(""); };
  // Les plus actifs de la période d'abord, puis les autres comptes par ordre alphabétique.
  const activity = new Map((summary?.parUtilisateur ?? []).map((user) => [user.utilisateurId, user]));
  const pickableUsers: PickableUser[] = [
    ...(summary?.parUtilisateur ?? []).map((user) => ({ id: user.utilisateurId, nom: user.nom, detail: `${user.poste ?? user.role ?? "Équipe"} · ${user.actions} action(s)` })),
    ...accounts
      .filter((account) => account.id && !activity.has(account.id))
      .map((account) => ({ id: account.id as string, nom: [account.prenom, account.nom].filter(Boolean).join(" "), detail: `${account.poste?.nom ?? account.role} · aucune activité sur la période` }))
      .sort((a, b) => a.nom.localeCompare(b.nom)),
  ];

  const loadMore = async () => {
    if (!feed?.next) return;
    setLoadingMore(true);
    try {
      const result = await apiFetch<{ data: FeedItem[]; suivant: string | null }>(`/audit/flux?${feedQuery}&limit=60&avant=${encodeURIComponent(feed.next)}`, { skipCache: true });
      if (loadedKey.current !== feedQuery) return;
      const known = new Set(loaded.current.items.map(itemKey));
      loaded.current = { items: [...loaded.current.items, ...result.data.filter((item) => !known.has(itemKey(item)))], next: result.suivant };
      setFeed({ key: feedQuery, ...loaded.current });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Chargement impossible.");
    } finally {
      setLoadingMore(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const rows: FeedItem[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 25; page += 1) {
        const chunk: { data: FeedItem[]; suivant: string | null } = await apiFetch(`/audit/flux?${feedQuery}&limit=200${cursor ? `&avant=${encodeURIComponent(cursor)}` : ""}`, { skipCache: true });
        rows.push(...chunk.data);
        cursor = chunk.suivant;
        if (!cursor) break;
      }
      // Au-delà, le PDF dépasserait la centaine de pages : mieux vaut une période plus courte.
      if (cursor) {
        setError(`Cette période contient plus de ${rows.length} événements. Réduisez la période ou filtrez par utilisateur, puis relancez l'export.`);
        return;
      }
      const typeLabel: Record<Genre, string> = { action: "Action", echec: "Refus", navigation: "Écran consulté", clic: "Clic" };
      await tablePdf({
        title: "Journal d'audit",
        subtitle: `Du ${range.dateDebut} au ${range.dateFin} · ${rows.length} événement(s)`,
        fileName: `audit-ipaim-${range.dateDebut}-${range.dateFin}.pdf`,
        columns: [
          { label: "Date", width: 36 }, { label: "Type", width: 26 }, { label: "Utilisateur", width: 30 }, { label: "Événement", width: 50 },
          { label: "Détail", width: 51 }, { label: "Résultat", width: 20 }, { label: "Requête", width: 32 }, { label: "IP et appareil", width: 22 },
        ],
        rows: rows.map((item) => {
          const text = describe(item);
          return [
            auditDateTime(item.date), typeLabel[item.genre], item.utilisateurNom, text.title, text.detail,
            item.genre === "echec" ? `Refusé (${item.statutHttp})` : item.genre === "action" ? "Réussi" : "",
            `${item.methode ?? ""} ${item.chemin ?? item.page ?? ""}`.trim(), [item.ip, device(item.navigateur) === "—" ? "" : device(item.navigateur)].filter(Boolean).join(" "),
          ];
        }),
      });
      toast(`${rows.length} événement(s) exporté(s).`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Export impossible.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="content-scroll audit-page">
      <header className="audit-header">
        <div>
          {userId ? <button type="button" className="audit-back" onClick={() => setUserId("")}><ArrowLeft size={14} aria-hidden="true" /> Audit et supervision</button> : <p className="eyebrow">Contrôle</p>}
          <h2>{userId ? `Activité de ${selectedUser?.nom ?? currentProfile?.utilisateur?.nom ?? (userId === "anonyme" ? "comptes non identifiés" : "l’utilisateur")}` : "Audit et supervision"}</h2>
          <p>Qui fait quoi, où, quand, avec quelles valeurs et pendant combien de temps.</p>
        </div>
        <div className="audit-header-actions">
          <span className={`audit-live ${live ? "on" : ""}`} aria-live="off">
            <i />{live ? "En direct" : "En pause"}{updatedAt ? ` · actualisé à ${clock(updatedAt)}` : ""}
          </span>
          <button type="button" className="outline-button small" aria-pressed={!live} onClick={() => setLive((value) => !value)}>
            {live ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {live ? "Mettre en pause" : "Reprendre"}
          </button>
          <button type="button" className="primary-button compact" disabled={exporting} onClick={() => void exportPdf()}><Download size={15} aria-hidden="true" /> {exporting ? "Export…" : "Exporter en PDF"}</button>
        </div>
      </header>

      <section className="audit-controls" aria-label="Filtres">
        <div className="segmented compact">
          <div className="segmented-options" role="radiogroup" aria-label="Période">
            {([["today", "Aujourd’hui"], ["7d", "7 jours"], ["30d", "30 jours"], ["custom", "Personnalisée"]] as const).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={period === value} className="segmented-option" onClick={() => setPeriod(value)}>{label}</button>
            ))}
          </div>
        </div>
        {period === "custom" && (
          <>
            <label>Du<input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} /></label>
            <label>Au<input type="date" value={customEnd} min={customStart} max={today} onChange={(event) => setCustomEnd(event.target.value)} /></label>
          </>
        )}
        <label className="report-search audit-search">
          <Search aria-hidden="true" focusable="false" />
          <input type="search" value={query} placeholder="Rechercher partout : nom, action, valeur saisie, bouton cliqué, écran, IP, identifiant…" aria-label="Recherche approfondie dans l’audit" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </section>

      {error && <div className="api-error" role="alert">{error}</div>}

      {!userId && <section className="audit-kpis" aria-label="Chiffres de la période">
        <div><span><PencilLine size={14} aria-hidden="true" /> Actions</span><strong>{summary ? summary.totaux.actions.toLocaleString("fr-FR") : "…"}</strong></div>
        <div className={summary && summary.totaux.echecs > 0 ? "alert" : ""}><span><ShieldAlert size={14} aria-hidden="true" /> Refus et échecs</span><strong>{summary ? summary.totaux.echecs.toLocaleString("fr-FR") : "…"}</strong></div>
        <div><span><MousePointerClick size={14} aria-hidden="true" /> Clics</span><strong>{summary ? summary.totaux.clics.toLocaleString("fr-FR") : "…"}</strong></div>
        <div><span><Clock size={14} aria-hidden="true" /> Temps actif cumulé</span><strong>{summary ? duration(summary.totaux.tempsMs) : "…"}</strong></div>
        <div className={summary && summary.totaux.enLigne > 0 ? "online" : ""}><span><Activity size={14} aria-hidden="true" /> En ligne maintenant</span><strong>{summary ? summary.totaux.enLigne : "…"}</strong></div>
        <div><span><Users size={14} aria-hidden="true" /> Utilisateurs actifs</span><strong>{summary ? summary.totaux.utilisateursActifs : "…"}</strong></div>
      </section>}

      <section className="panel audit-timeline-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Activité {timeline?.pas === "heure" ? "par heure" : "par jour"}{selectedUser ? ` · ${selectedUser.nom}` : ""}</p><h3>Volume d’activité</h3></div>
          <div className="trend-legend"><span className="audit-key actions">Actions</span><span className="audit-key echecs">Refus</span><span className="audit-key clics">Clics</span></div>
        </div>
        {timeline ? <TimelineChart timeline={timeline} /> : <p className="empty-state">Chargement…</p>}
      </section>

      <div className={`audit-layout ${userId ? "solo" : ""}`}>
        <div className="audit-main">
          {userId && (
            <section className="panel audit-profile">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Profil d’activité</p>
                  <h3>{selectedUser?.nom ?? currentProfile?.utilisateur?.nom ?? (userId === "anonyme" ? "Tentatives sans compte" : "Utilisateur")}{selectedUser?.enLigne && <span className="audit-online-badge">En ligne</span>}</h3>
                  <p className="panel-subtitle">{[currentProfile?.utilisateur?.poste ?? (currentProfile?.utilisateur?.role === "admin" ? "Administrateur" : currentProfile?.utilisateur?.role), currentProfile?.utilisateur?.email, selectedUser ? `dernière activité ${ago(selectedUser.derniereActivite, now)}` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <button type="button" className="outline-button small" onClick={() => setUserId("")}><ArrowLeft size={14} aria-hidden="true" /> Retour à l’audit</button>
              </div>
              {currentProfile ? (
                <>
                  <div className="audit-profile-totals">
                    <div><span>Temps actif</span><strong>{duration(currentProfile.totaux.tempsMs)}</strong></div>
                    <div><span>Écrans consultés</span><strong>{currentProfile.totaux.visites}</strong></div>
                    <div><span>Clics</span><strong>{currentProfile.totaux.clics}</strong></div>
                    <div><span>Actions</span><strong>{currentProfile.totaux.actions}</strong></div>
                    <div><span>Refus</span><strong>{currentProfile.totaux.echecs}</strong></div>
                  </div>
                  <div className="audit-profile-grid">
                    <div>
                      <h4>Temps passé par écran</h4>
                      {currentProfile.tempsParPage.length ? <Bars unit={duration} rows={currentProfile.tempsParPage.map((row) => ({ label: row.titre, value: row.tempsMs, note: `${row.visites} visite${row.visites > 1 ? "s" : ""} · ${row.clics} clic${row.clics > 1 ? "s" : ""}` }))} /> : <p className="worklist-empty">Aucun temps mesuré sur la période.</p>}
                    </div>
                    <div>
                      <h4>Là où il clique le plus</h4>
                      {currentProfile.clicsParElement.length ? <Bars unit={(value) => `${value} clic${value > 1 ? "s" : ""}`} rows={currentProfile.clicsParElement.slice(0, 10).map((row) => ({ label: row.element, value: row.clics, note: row.titre }))} /> : <p className="worklist-empty">Aucun clic enregistré sur la période.</p>}
                    </div>
                  </div>
                  {currentProfile.parcours.length > 0 && (
                    <>
                      <h4>Parcours récent (du plus récent au plus ancien)</h4>
                      <ol className="audit-journey">
                        {currentProfile.parcours.slice(0, 24).map((visit) => (
                          <li key={visit.id} title={`${auditDateTime(visit.debut)} · ${visit.page}`}><strong>{visit.titre}</strong><span>{clock(visit.debut)} · {duration(visit.dureeMs)}</span></li>
                        ))}
                      </ol>
                    </>
                  )}
                  {(currentProfile.actionsParType.length > 0 || currentProfile.appareils.length > 0) && (
                    <div className="audit-profile-grid">
                      {currentProfile.actionsParType.length > 0 && <div><h4>Ce qu’il a fait</h4><Bars unit={(value) => `${value}`} rows={currentProfile.actionsParType.map((row) => ({ label: row.action, value: row.total, note: "" }))} /></div>}
                      {currentProfile.appareils.length > 0 && (
                        <div>
                          <h4>Appareils et adresses</h4>
                          <ul className="audit-devices">{currentProfile.appareils.slice(0, 6).map((row, index) => <li key={`${row.ip}-${index}`}><strong>{device(row.navigateur)}</strong><span>{row.ip ?? "IP inconnue"} · {row.actions} action{row.actions > 1 ? "s" : ""} · {ago(row.derniereUtilisation, now)}</span></li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : userId === "anonyme" ? <p className="worklist-empty">Tentatives de connexion sans compte identifié : voir le flux ci-dessous.</p> : <p className="empty-state">Chargement du profil…</p>}
            </section>
          )}

          <section className="panel audit-feed-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">{userId ? "Tout ce qu’il a fait, consulté et cliqué" : "Flux d’activité"}</p><h3>{items ? `${items.length}${feed?.next ? "+" : ""} événement${items.length > 1 ? "s" : ""}` : "Chargement…"}</h3></div>
              <div className="toolbar">
                {hasFilters && <button type="button" className="outline-button small" onClick={clearFilters}><X size={14} aria-hidden="true" /> Effacer les filtres</button>}
              </div>
            </div>
            <div className="audit-chips" role="group" aria-label="Types d’événements">
              {GENRES.map((genre) => (
                <button key={genre.value} type="button" className={`audit-chip ${genre.value}`} aria-pressed={genres.includes(genre.value)} onClick={() => toggleGenre(genre.value)}>{genre.label}</button>
              ))}
              {!userId && <UserPicker users={pickableUsers} value={feedUserId} onChange={setFeedUserId} />}
              <select aria-label="Type de donnée" value={resource} onChange={(event) => setResource(event.target.value)}>
                <option value="">Toutes les données</option>
                {(summary?.parRessource ?? []).map((row) => <option key={row.ressource} value={row.ressource}>{row.ressource} ({row.actions})</option>)}
              </select>
              <select aria-label="Type d’action" value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="">Créations, modifications, suppressions</option><option value="POST">Créations</option><option value="PATCH">Modifications</option><option value="DELETE">Suppressions</option>
              </select>
              <select aria-label="Écran" value={screen} onChange={(event) => setScreen(event.target.value)}>
                <option value="">Tous les écrans</option>
                {(summary?.parPage ?? []).map((row) => <option key={row.titre} value={row.titre}>{row.titre}</option>)}
              </select>
            </div>
            <ol className="audit-feed">
              {items?.map((item) => {
                const key = itemKey(item);
                const text = describe(item);
                const expandable = item.genre === "action" || item.genre === "echec";
                const open = expanded === key;
                return (
                  <li key={key} className={`audit-feed-item ${item.genre} ${fresh.has(key) ? "fresh" : ""} ${open ? "open" : ""}`}>
                    <GenreIcon item={item} />
                    <div className="audit-feed-body">
                      <p className="audit-feed-title">
                        <button type="button" className="audit-feed-user" title="Voir le profil de cet utilisateur" onClick={() => setUserId(item.utilisateurId)}>{item.utilisateurNom}</button>
                        <span>{text.title}</span>
                      </p>
                      {text.detail && <p className="audit-feed-detail">{text.detail}</p>}
                      {open && <ItemDetail item={item} />}
                    </div>
                    <div className="audit-feed-meta">
                      <time dateTime={item.date} title={auditDateTime(item.date)}>{period === "today" ? clock(item.date) : auditDateTime(item.date)}</time>
                      {item.genre === "echec" && <span className="status status-refusee">Refusé · {item.statutHttp}</span>}
                      {expandable && <button type="button" className="audit-feed-toggle" aria-expanded={open} aria-label={open ? "Masquer le détail" : "Voir le détail"} onClick={() => setExpanded(open ? null : key)}><ChevronDown size={16} aria-hidden="true" /></button>}
                    </div>
                  </li>
                );
              })}
            </ol>
            {items && !items.length && <p className="empty-state">Aucun événement ne correspond à ces critères.</p>}
            {feed?.next && items && items.length > 0 && <button type="button" className="outline-button audit-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Chargement…" : "Afficher les événements plus anciens"}</button>}
          </section>
        </div>

        {!userId && <aside className="audit-side">
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Utilisateurs</p><h3>Qui est actif</h3></div></div>
            <ul className="audit-users">
              {summary?.parUtilisateur.map((user) => (
                <li key={user.utilisateurId}>
                  <button type="button" className={`audit-user ${userId === user.utilisateurId ? "active" : ""}`} aria-pressed={userId === user.utilisateurId} onClick={() => setUserId(userId === user.utilisateurId ? "" : user.utilisateurId)}>
                    <span className={`audit-presence ${user.enLigne ? "on" : ""}`} title={user.enLigne ? "En ligne" : "Hors ligne"} />
                    <span className="audit-user-name"><strong>{user.nom}</strong><small>{user.enLigne ? "En ligne" : ago(user.derniereActivite, now)}{user.poste ? ` · ${user.poste}` : ""}{!user.compteActif && user.utilisateurId !== "anonyme" ? " · compte supprimé" : ""}</small></span>
                    <span className="audit-user-stats"><strong>{duration(user.tempsMs)}</strong><small>{user.actions} action{user.actions > 1 ? "s" : ""} · {user.clics} clic{user.clics > 1 ? "s" : ""}{user.echecs ? ` · ${user.echecs} refus` : ""}</small></span>
                  </button>
                </li>
              ))}
            </ul>
            {summary && !summary.parUtilisateur.length && <p className="worklist-empty">Aucune activité sur la période.</p>}
          </section>
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Écrans</p><h3>Temps passé par écran</h3><p className="panel-subtitle">Temps actif : onglet visible, arrêt après 5 minutes sans interaction.</p></div></div>
            {summary?.parPage.length ? <Bars unit={duration} rows={summary.parPage.map((row) => ({ label: row.titre, value: row.tempsMs, note: `${row.visites} visite${row.visites > 1 ? "s" : ""} · ${row.clics} clic${row.clics > 1 ? "s" : ""}` }))} /> : <p className="worklist-empty">{summary ? "Aucun temps mesuré sur la période." : "Chargement…"}</p>}
          </section>
        </aside>}
      </div>
    </div>
  );
}
