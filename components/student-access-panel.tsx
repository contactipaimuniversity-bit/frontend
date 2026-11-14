"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Smartphone } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { Badge, Panel, messageOf } from "@/components/ui-kit";
import { API_URL } from "@/lib/connectivity";
import { formatDate } from "@/lib/types";

type AccountState = {
  matricule: string | null;
  etat: "AUCUN" | "EN_ATTENTE" | "ACTIF" | "DESACTIVE";
  codeEnCours: boolean;
  codeExpireLe: string | null;
  codeCreeLe: string | null;
  codeCreeParNom: string | null;
  activeLe: string | null;
  derniereConnexion: string | null;
  desactiveLe: string | null;
};
type IssuedCode = AccountState & { codeActivation: string; etudiant: string };

const STATES: Record<AccountState["etat"], { label: string; tone: "ok" | "wait" | "off" | "bad" }> = {
  AUCUN: { label: "Pas d'accès", tone: "off" },
  EN_ATTENTE: { label: "En attente d'activation", tone: "wait" },
  ACTIF: { label: "Actif", tone: "ok" },
  DESACTIVE: { label: "Désactivé", tone: "bad" },
};

// Requête directe (sans clé d'idempotence) : la réponse contient le code en
// clair, elle ne doit être conservée nulle part sur le serveur.
async function call<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const token = window.sessionStorage.getItem("ipaim-token");
  const response = await fetch(`${API_URL}${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
    throw new Error(message || "Le serveur est injoignable. Cette action nécessite une connexion.");
  }
  return body as T;
}

// Accès de l'étudiant à son espace mobile : remise d'un code d'activation
// (première connexion ou mot de passe oublié) et fermeture du compte.
export function StudentAccessPanel({ personId, canEdit }: { personId: string; canEdit: boolean }) {
  const [state, setState] = useState<AccountState | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    call<AccountState>(`/comptes-etudiants/${encodeURIComponent(personId)}`)
      .then((loaded) => active && setState(loaded))
      .catch((failure) => active && setError(messageOf(failure, "État du compte indisponible.")));
    return () => {
      active = false;
    };
  }, [personId]);

  const issue = async () => {
    if (state?.etat === "ACTIF" && !(await askConfirm({ title: "Remettre un nouveau code ?", message: "Utile si l'étudiant a oublié son mot de passe. Son mot de passe actuel reste valable tant qu'il n'a pas utilisé le nouveau code.", confirmLabel: "Générer le code" }))) return;
    setBusy(true);
    try {
      const result = await call<IssuedCode>(`/comptes-etudiants/${encodeURIComponent(personId)}/code`, "POST");
      setIssued(result);
      setState(result);
    } catch (failure) {
      toast(messageOf(failure, "Code impossible à générer."), "error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!(await askConfirm({ title: "Désactiver l'accès ?", message: "L'étudiant est déconnecté de tous ses appareils. Il faudra lui remettre un nouveau code pour rouvrir son accès.", confirmLabel: "Désactiver", danger: true }))) return;
    setBusy(true);
    try {
      setState(await call<AccountState>(`/comptes-etudiants/${encodeURIComponent(personId)}/desactivation`, "POST"));
      setIssued(null);
      toast("Accès désactivé.");
    } catch (failure) {
      toast(messageOf(failure, "Désactivation impossible."), "error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!issued) return;
    const link = `${window.location.origin}/etudiant`;
    try {
      await navigator.clipboard.writeText(`Espace étudiant IPAIM : ${link}\nMatricule : ${issued.matricule}\nCode d'activation : ${issued.codeActivation}`);
      toast("Instructions copiées.");
    } catch {
      toast("Copie impossible : recopiez le code à la main.", "error");
    }
  };

  const status = state ? STATES[state.etat] : null;
  return (
    <Panel
      eyebrow="Espace étudiant"
      title={<span className="student-access-title"><Smartphone size={17} aria-hidden="true" /> Application mobile {status && <Badge tone={status.tone}>{status.label}</Badge>}</span>}
      subtitle="L'étudiant consulte son emploi du temps, ses notes, ses paiements et sa carte sur son téléphone. Remettez-lui un code pour qu'il active son accès."
      actions={canEdit && state ? (
        <div className="action-group">
          <button className="primary-button small" disabled={busy} onClick={() => void issue()}><KeyRound size={15} aria-hidden="true" /> {state.etat === "ACTIF" ? "Nouveau code" : "Générer un code d'accès"}</button>
          {(state.etat === "ACTIF" || state.etat === "EN_ATTENTE") && <button className="outline-button small" disabled={busy} onClick={() => void disable()}>Désactiver</button>}
        </div>
      ) : undefined}
    >
      {error && <p className="form-error">{error}</p>}
      {issued && (
        <div className="student-access-code" role="status">
          <p>Code à remettre à <strong>{issued.etudiant}</strong> — il ne sera plus affiché après cette page.</p>
          <dl>
            <div><dt>Adresse</dt><dd>{typeof window !== "undefined" ? `${window.location.host}/etudiant` : "/etudiant"}</dd></div>
            <div><dt>Matricule</dt><dd>{issued.matricule}</dd></div>
            <div><dt>Code</dt><dd className="student-access-code-value">{issued.codeActivation}</dd></div>
          </dl>
          <p className="panel-subtitle">Valable jusqu&apos;au {issued.codeExpireLe ? formatDate(issued.codeExpireLe) : "—"}, pour une seule activation.</p>
          <button className="outline-button small" onClick={() => void copy()}><Copy size={14} aria-hidden="true" /> Copier les instructions</button>
        </div>
      )}
      {state && !issued && (
        <dl className="person-file-facts">
          <div><dt>Identifiant</dt><dd>{state.matricule ?? "—"}</dd></div>
          <div><dt>Activé le</dt><dd>{state.activeLe ? formatDate(state.activeLe) : "—"}</dd></div>
          <div><dt>Dernière connexion</dt><dd>{state.derniereConnexion ? formatDate(state.derniereConnexion) : "—"}</dd></div>
          {state.codeEnCours && <div><dt>Code en cours</dt><dd>remis le {state.codeCreeLe ? formatDate(state.codeCreeLe) : "—"}{state.codeCreeParNom ? ` par ${state.codeCreeParNom}` : ""}, valable jusqu&apos;au {state.codeExpireLe ? formatDate(state.codeExpireLe) : "—"}</dd></div>}
          {state.desactiveLe && <div><dt>Désactivé le</dt><dd>{formatDate(state.desactiveLe)}</dd></div>}
        </dl>
      )}
    </Panel>
  );
}
