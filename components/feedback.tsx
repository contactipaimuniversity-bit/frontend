"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };
type DialogRequest = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Demande un texte libre (ex. motif de suppression) avec une longueur minimale. */
  reason?: { label: string; minLength: number; placeholder?: string };
};
type PendingDialog = DialogRequest & { resolve: (value: string | boolean | null) => void };

const TOAST_EVENT = "ipaim-toast";
const DIALOG_EVENT = "ipaim-dialog";

export function toast(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, tone } }));
}

function openDialog(request: DialogRequest) {
  return new Promise<string | boolean | null>((resolve) => {
    window.dispatchEvent(new CustomEvent(DIALOG_EVENT, { detail: { ...request, resolve } }));
  });
}

/** Remplace window.confirm : résout à true si l'utilisateur confirme. */
export async function askConfirm(request: Omit<DialogRequest, "reason">) {
  return (await openDialog(request)) === true;
}

/** Remplace window.prompt : résout au texte saisi, ou null si annulé. */
export async function askReason(request: DialogRequest & { reason: NonNullable<DialogRequest["reason"]> }) {
  const result = await openDialog(request);
  return typeof result === "string" ? result : null;
}

export function FeedbackHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  const [reason, setReason] = useState("");
  const nextId = useRef(1);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: ToastTone }>).detail;
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, ...detail }]);
      window.setTimeout(
        () => setToasts((current) => current.filter((item) => item.id !== id)),
        detail.tone === "error" ? 7000 : 4000,
      );
    };
    const onDialog = (event: Event) => {
      setReason("");
      setDialog((event as CustomEvent<PendingDialog>).detail);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(DIALOG_EVENT, onDialog);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(DIALOG_EVENT, onDialog);
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    if (!dialog.reason) confirmButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dialog.resolve(null);
      setDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const close = (value: string | boolean | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dialog) return;
    close(dialog.reason ? reason.trim() : true);
  };
  const reasonTooShort = Boolean(dialog?.reason && reason.trim().length < dialog.reason.minLength);

  return (
    <>
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            <p>{item.message}</p>
            <button type="button" aria-label="Fermer la notification" onClick={() => setToasts((current) => current.filter((entry) => entry.id !== item.id))}>×</button>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="modal-backdrop app-dialog-backdrop" onMouseDown={() => close(null)}>
          <form className="modal app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
            <h3 id="app-dialog-title">{dialog.title}</h3>
            {dialog.message && <p>{dialog.message}</p>}
            {dialog.reason && (
              <label>
                {dialog.reason.label}
                <textarea autoFocus required minLength={dialog.reason.minLength} maxLength={500} value={reason} placeholder={dialog.reason.placeholder} onChange={(event) => setReason(event.target.value)} />
              </label>
            )}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => close(null)}>Annuler</button>
              <button ref={confirmButton} type="submit" disabled={reasonTooShort} className={dialog.danger ? "danger-solid-button" : "primary-button compact"}>
                {dialog.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
