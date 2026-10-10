"use client";

import { ReactNode, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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
    void apiFetch<T>(path, { skipCache: true })
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

// Téléchargement d'un tableau au format CSV (lisible par Excel).
export function downloadCsv(name: string, rows: Array<Array<string | number | null | undefined>>) {
  const text = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
