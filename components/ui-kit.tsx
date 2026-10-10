"use client";

import { ReactNode, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, Info, type LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { listPdf } from "@/lib/pdf-docs";
import { toast } from "@/components/feedback";

// Briques communes aux pages de gestion (académique, personnel, paie, comptabilité).

export const messageOf = (failure: unknown, fallback = "Action impossible.") => (failure instanceof Error ? failure.message : fallback);

export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export const number = (value: number | string | null | undefined, digits = 2) =>
  value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const personName = (person?: { nom: string; prenom: string } | null) => (person ? `${person.nom} ${person.prenom}` : "—");

// Lecture d'une ressource, rechargée à la demande ou quand l'en-tête demande une actualisation.
export function useLoad<T>(path: string | null, signal = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    // Les données académiques gardent une copie sur l'appareil (appel et notes hors ligne) ;
    // le personnel, la paie et la comptabilité se lisent toujours sur le serveur.
    void apiFetch<T>(path, { skipCache: !/^\/(academique|scolarite|notes)\//.test(path) })
      .then((value) => {
        if (!active) return;
        setData(value);
        setError("");
      })
      .catch((failure) => {
        if (active) setError(messageOf(failure, "Données indisponibles."));
      });
    return () => {
      active = false;
    };
  }, [path, signal, version]);
  return { data: path ? data : null, error, reload: () => setVersion((current) => current + 1), setData };
}

// Exécution d'une action avec état d'attente et message d'erreur.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (failure) {
      setError(messageOf(failure));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export const send = <T,>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown, silent = false) =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body), silent });

export function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <section className={`modal ${wide ? "expense-modal" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<[T, string]>; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div className="report-toolbar">
      <div className="segmented compact">
        <div className="segmented-options" role="radiogroup" aria-label={label}>
          {tabs.map(([key, text]) => (
            <button key={key} type="button" role="radio" aria-checked={value === key} className="segmented-option" onClick={() => onChange(key)}>
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageIntro({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {children && <div className="page-intro-actions">{children}</div>}
    </div>
  );
}

export function Panel({ eyebrow, title, subtitle, actions, children }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel full-panel kit-panel">
      <div className="panel-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h3>{title}</h3>
          {subtitle && <p className="panel-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="toolbar">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "wait" | "bad" | "off" | "run"; children: ReactNode }) {
  const css = { ok: "status-complete", wait: "status-en_attente", bad: "status-refusee", off: "status-neutre", run: "status-en_cours" }[tone];
  return <span className={`status ${css}`}>{children}</span>;
}

export function FormActions({ busy, disabled, label = "Enregistrer", danger, onCancel }: { busy: boolean; disabled?: boolean; label?: string; danger?: boolean; onCancel: () => void }) {
  return (
    <div className="form-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>
        Annuler
      </button>
      <button className={danger ? "danger-solid-button" : "primary-button compact"} disabled={busy || disabled}>
        {busy ? "Enregistrement..." : label}
      </button>
    </div>
  );
}

export function Empty({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={columns} className="empty-state">
        {children}
      </td>
    </tr>
  );
}

// Champs d'un formulaire tenus dans un seul objet.
export function useForm<T extends Record<string, string | boolean>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const bind = (key: keyof T) => ({
    value: values[key] as string,
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value })),
  });
  const check = (key: keyof T) => ({
    checked: values[key] as boolean,
    onChange: (event: { target: { checked: boolean } }) => setValues((current) => ({ ...current, [key]: event.target.checked })),
  });
  return { values, setValues, bind, check };
}

// Téléchargement d'un tableau en PDF : la première ligne porte les intitulés des colonnes.
export function downloadPdf(name: string, title: string, subtitle: string, rows: Array<Array<string | number | null | undefined>>) {
  void listPdf(name, title, subtitle, rows).catch((failure) => toast(messageOf(failure), "error"));
}

// ---------- Accueil par cartes ----------

// Bulle d'aide d'une carte : elle s'ouvre au survol et au focus clavier.
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={text}>
      <Info size={16} aria-hidden="true" focusable="false" />
      <span className="info-tip-bubble" aria-hidden="true">{text}</span>
    </span>
  );
}

// Point d'interrogation à côté d'un champ : la bulle explique le réglage et ce que change sa valeur.
export function FieldHelp({ text }: { text: string }) {
  return (
    <span className="info-tip inline" tabIndex={0} role="note" aria-label={text}>
      <CircleHelp size={15} aria-hidden="true" focusable="false" />
      <span className="info-tip-bubble" aria-hidden="true">{text}</span>
    </span>
  );
}

export type HubCard<Key extends string> = { key: Key; icon: LucideIcon; title: string; value: string; detail: string; tone?: "alert" | "warn"; info: string };

// Une carte par tâche : son chiffre clé, sa bulle d'aide, et un clic pour ouvrir son écran.
export function HubCards<Key extends string>({ cards, onOpen }: { cards: HubCard<Key>[]; onOpen: (key: Key) => void }) {
  return (
    <div className="hub-grid">
      {cards.map((card) => (
        <article className={`hub-card ${card.tone ?? ""}`} key={card.key}>
          <button type="button" className="hub-card-open" onClick={() => onOpen(card.key)}>
            <span className="hub-card-icon"><card.icon size={22} aria-hidden="true" focusable="false" /></span>
            <span className="hub-card-title">{card.title}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
            <span className="hub-card-more">Ouvrir <ChevronRight size={15} aria-hidden="true" focusable="false" /></span>
          </button>
          <InfoTip text={card.info} />
        </article>
      ))}
    </div>
  );
}

export function HubBack({ label, onBack }: { label: string; onBack: () => void }) {
  return <button type="button" className="settings-back" onClick={onBack}><ChevronLeft size={16} aria-hidden="true" /> {label}</button>;
}

// Pagination d'une liste déjà chargée : 20 lignes par page.
export function usePaged<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount, total: items.length, setPage };
}

export function PageBar({ page, pageCount, total, noun, onPage }: { page: number; pageCount: number; total: number; noun: string; onPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="pagination-bar">
      <span>Page {page} sur {pageCount} · {total} {noun}</span>
      <div className="pagination-actions">
        <button className="outline-button small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédente</button>
        <button className="outline-button small" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Suivante</button>
      </div>
    </div>
  );
}
