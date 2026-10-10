"use client";

import { useEffect, useRef } from "react";
import { API_URL } from "@/lib/offline";

type Interaction = { page: string; titre: string; element: string; type: string; contexte: string | null; date: string };

const FLUSH_EVERY_MS = 10_000;
const MAX_BATCH = 50;
const CLICKABLE = 'button, a, summary, select, [role="button"], [role="tab"], [role="radio"], [role="option"], [role="menuitem"], input[type="checkbox"], input[type="radio"]';

const clean = (value: string | null | undefined, max: number) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Libellé de l'élément cliqué. On ne lit jamais la valeur d'un champ :
// seul le nom du bouton ou du contrôle est journalisé.
function describe(target: Element): Pick<Interaction, "element" | "type" | "contexte"> | null {
  const control = target.closest(CLICKABLE);
  if (!control || control.closest(".login-form")) return null;
  const labelledBy = control.closest("label");
  const element =
    clean(control.getAttribute("aria-label"), 120) ||
    clean(control.getAttribute("title"), 120) ||
    (control instanceof HTMLSelectElement || control instanceof HTMLInputElement
      ? clean(labelledBy?.textContent, 120) || clean(control.getAttribute("name"), 120)
      : clean(control.textContent, 120));
  if (!element) return null;
  const closing = element === "×" || control.matches(".modal-close");
  const type =
    control.getAttribute("role") === "tab" ? "onglet"
    : control.getAttribute("role") === "radio" || control instanceof HTMLInputElement ? "choix"
    : control instanceof HTMLSelectElement ? "liste"
    : control instanceof HTMLAnchorElement ? "lien"
    : control.closest(".sidebar") ? "menu"
    : "bouton";
  // Où se trouvait l'élément : fenêtre ouverte, sinon bloc de la page.
  const container = control.closest('.modal, [role="dialog"], [role="alertdialog"]') ?? control.closest(".panel, .sidebar, .topbar");
  const heading = container?.matches(".sidebar") ? "Menu latéral" : container?.matches(".topbar") ? "En-tête" : clean(container?.querySelector("h3, h2")?.textContent, 120);
  return { element: closing ? "Fermer la fenêtre" : element, type, contexte: heading || null };
}

// Journalise les clics de l'utilisateur pour la page d'audit, par lots discrets.
export function useClickTracker(page: string, titre: string, token: string | null) {
  const location = useRef({ page, titre });
  useEffect(() => {
    location.current = { page, titre };
  }, [page, titre]);

  useEffect(() => {
    if (!token) return;
    let queue: Interaction[] = [];
    const flush = () => {
      if (!queue.length) return;
      const evenements = queue.slice(0, MAX_BATCH);
      queue = queue.slice(MAX_BATCH);
      void fetch(`${API_URL}/audit/interactions`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ evenements }),
      }).catch(() => undefined);
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const described = describe(event.target);
      if (!described) return;
      queue.push({ ...location.current, ...described, date: new Date().toISOString() });
      if (queue.length >= MAX_BATCH) flush();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    const timer = window.setInterval(flush, FLUSH_EVERY_MS);
    return () => {
      flush();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      window.clearInterval(timer);
    };
  }, [token]);
}
