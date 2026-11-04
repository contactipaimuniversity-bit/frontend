"use client";

import { useEffect, useRef, useState } from "react";
import { PRINT_EVENT, PrintProgress } from "@/lib/print-progress";

type State = { phase: "preparing"; label: string } | { phase: "ready"; url: string; fileName: string } | { phase: "failed"; message: string } | null;

const DEFAULT_LABEL = "Préparation du document…";

// La fenêtre commune à toutes les impressions : préparation, PDF prêt, ou erreur.
export function PrintProgressHost() {
  const [state, setState] = useState<State>(null);
  const active = useRef(false);

  useEffect(() => {
    const onPrint = (event: Event) => {
      const detail = (event as CustomEvent<PrintProgress>).detail;
      if (detail.phase === "start") {
        active.current = true;
        setState((current) => ({ phase: "preparing", label: detail.label ?? (current?.phase === "preparing" ? current.label : DEFAULT_LABEL) }));
      } else if (detail.phase === "end") {
        // Déjà prêt ou en erreur : on garde le message ; encore en préparation : rien n'a été produit.
        if (active.current) { active.current = false; setState(null); }
      } else if (detail.phase === "ready") {
        active.current = false;
        setState({ phase: "ready", url: detail.url, fileName: detail.fileName });
      } else {
        active.current = false;
        setState({ phase: "failed", message: detail.message });
      }
    };
    // Une erreur annoncée pendant une préparation (par l'écran qui imprime) la termine.
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: string }>).detail;
      if (!active.current || detail.tone !== "error") return;
      active.current = false;
      setState({ phase: "failed", message: detail.message });
    };
    window.addEventListener(PRINT_EVENT, onPrint);
    window.addEventListener("ipaim-toast", onToast);
    return () => {
      window.removeEventListener(PRINT_EVENT, onPrint);
      window.removeEventListener("ipaim-toast", onToast);
    };
  }, []);

  useEffect(() => {
    if (!state || state.phase === "preparing") return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setState(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;
  const close = () => setState(null);
  return (
    <div className="modal-backdrop app-dialog-backdrop print-progress-backdrop">
      <div className="modal app-dialog print-progress" role="alertdialog" aria-modal="true" aria-live="polite" aria-labelledby="print-progress-title">
        {state.phase === "preparing" && (
          <>
            <span className="print-progress-spinner" aria-hidden="true" />
            <h3 id="print-progress-title">{state.label}</h3>
            <p>Nous rassemblons les données et mettons le document en page. Cela peut prendre quelques secondes : gardez cette page ouverte.</p>
            <div className="form-actions"><button type="button" className="secondary-button" onClick={close}>Masquer</button></div>
          </>
        )}
        {state.phase === "ready" && (
          <>
            <span className="print-progress-done" aria-hidden="true">✓</span>
            <h3 id="print-progress-title">Votre PDF est prêt</h3>
            <p><strong>{state.fileName}</strong> a été enregistré dans vos téléchargements. Ouvrez-le pour l&apos;imprimer.</p>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={close}>Fermer</button>
              <button type="button" className="primary-button compact" autoFocus onClick={() => { window.open(state.url, "_blank", "noopener"); close(); }}>Ouvrir le PDF</button>
            </div>
          </>
        )}
        {state.phase === "failed" && (
          <>
            <span className="print-progress-failed" aria-hidden="true">!</span>
            <h3 id="print-progress-title">Le document n&apos;a pas pu être préparé</h3>
            <p>{state.message}</p>
            <div className="form-actions"><button type="button" className="primary-button compact" autoFocus onClick={close}>Fermer</button></div>
          </>
        )}
      </div>
    </div>
  );
}
