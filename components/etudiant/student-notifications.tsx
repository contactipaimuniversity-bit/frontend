"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Share } from "lucide-react";
import { studentPost, useStudentResource } from "@/lib/student-api";
import { useInstallModalOpen } from "@/lib/student-install";
import { disablePush, enablePush, testPush, usePush } from "@/lib/student-push";

const LATER_KEY = "ipaim-etudiant-notifications-plus-tard";
// « Plus tard » ne vaut que 10 minutes : la fenêtre revient ensuite, dès que
// l'étudiant rouvre ou revient sur l'application, tant qu'il n'a pas activé.
const LATER_MS = 10 * 60 * 1000;

function laterUntil() {
  try {
    return Number(window.localStorage.getItem(LATER_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Tant que les notifications ne sont pas activées sur ce téléphone, une fenêtre
 * avec l'interrupteur s'impose : à chaque ouverture de l'application, à chaque
 * retour dessus, et au plus tard 10 minutes après « Plus tard ».
 */
export function NotificationsModal() {
  const push = usePush();
  // L'installation passe d'abord (sur iPhone, elle est même nécessaire).
  const installOpen = useInstallModalOpen();
  const [closed, setClosed] = useState(() => typeof window !== "undefined" && laterUntil() > Date.now());

  // Retour sur l'application (téléphone déverrouillé, appli rouverte) ou délai écoulé : elle revient.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible" && laterUntil() <= Date.now()) setClosed(false);
    };
    const timer = window.setInterval(recheck, 60_000);
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    try {
      window.localStorage.setItem(LATER_KEY, String(Date.now() + LATER_MS));
    } catch {
      /* rien à retenir */
    }
    setClosed(true);
  };

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setClosed(true), 1400);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (installOpen || closed || !push.ready || push.support === "unsupported") return null;
  if (push.subscribed && !done) return null;

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      await enablePush();
      setDone(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const blocked = push.support === "ok" && push.permission === "denied";
  return (
    <div className="stu-modal-backdrop" role="presentation">
      <section className="stu-modal" role="dialog" aria-modal="true" aria-labelledby="stu-notify-title">
        <span className="stu-modal-icon"><BellRing size={28} aria-hidden="true" /></span>
        <h2 id="stu-notify-title">Active les notifications</h2>
        <p>Reçois les annonces de l&apos;administration, un rappel 15 minutes avant chaque cours et avant tes échéances de paiement, même application fermée.</p>

        {push.support === "ios-install" ? (
          <div className="stu-modal-steps">
            <p>Sur iPhone, installe d&apos;abord l&apos;application :</p>
            <ol>
              <li>Touche <Share size={14} aria-label="Partager" /> en bas de Safari ;</li>
              <li>choisis « Sur l&apos;écran d&apos;accueil » ;</li>
              <li>ouvre IPAIM depuis l&apos;écran d&apos;accueil et active les notifications.</li>
            </ol>
          </div>
        ) : blocked ? (
          <div className="stu-modal-steps">
            <p>Les notifications sont bloquées sur ce téléphone. Pour les autoriser :</p>
            <ol>
              <li>ouvre les réglages du navigateur (ou de l&apos;application IPAIM) ;</li>
              <li>rubrique Notifications, autorise ce site ;</li>
              <li>reviens ici et active l&apos;interrupteur.</li>
            </ol>
          </div>
        ) : (
          <div className="stu-notify-row stu-modal-switch">
            <div>
              <strong>Notifications des annonces</strong>
              <p>{done ? "Activées sur ce téléphone." : busy ? "Un instant…" : "Désactivées"}</p>
            </div>
            <button type="button" className={`stu-switch${done ? " on" : ""}`} role="switch" aria-checked={done} aria-label="Activer les notifications des annonces" disabled={busy || done} onClick={() => void enable()}>
              <span />
            </button>
          </div>
        )}

        {error && <p className="stu-form-error" role="alert">{error}</p>}
        {!done && <button type="button" className="stu-link stu-modal-later" onClick={close}>Plus tard</button>}
      </section>
    </div>
  );
}

/** Profil : état des notifications, avec activation, désactivation et essai. */
export function NotificationsSetting() {
  const push = usePush();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "ok", text: success });
    } catch (failure) {
      setMessage({ tone: "bad", text: failure instanceof Error ? failure.message : "Action impossible." });
    } finally {
      setBusy(false);
    }
  };

  let detail: string;
  if (!push.ready) detail = "…";
  else if (push.support === "ios-install") detail = "Installe d'abord l'application sur l'écran d'accueil (iPhone, iOS 16.4 ou plus).";
  else if (push.support === "unsupported") detail = "Non disponibles sur ce navigateur.";
  else if (push.permission === "denied") detail = "Bloquées : autorise-les dans les réglages du téléphone.";
  else if (push.subscribed) detail = "Activées sur ce téléphone.";
  else detail = "Désactivées.";

  const canToggle = push.ready && push.support === "ok" && push.permission !== "denied";
  return (
    <section className="stu-notify-setting">
      <div className="stu-notify-row">
        <span className="stu-notify-icon">{push.subscribed ? <BellRing size={20} aria-hidden="true" /> : <BellOff size={20} aria-hidden="true" />}</span>
        <div>
          <strong>Notifications des annonces</strong>
          <p>{detail}</p>
        </div>
        {canToggle && (
          <button type="button" className={`stu-switch${push.subscribed ? " on" : ""}`} role="switch" aria-checked={push.subscribed} aria-label="Notifications des annonces" disabled={busy} onClick={() => void run(push.subscribed ? disablePush : enablePush, push.subscribed ? "Notifications désactivées." : "Notifications activées.")}>
            <span />
          </button>
        )}
      </div>
      {push.subscribed && <ReminderToggles />}
      {push.subscribed && (
        <button type="button" className="stu-link" disabled={busy} onClick={() => void run(testPush, "Notification d'essai envoyée.")}>Envoyer une notification d&apos;essai</button>
      )}
      {message && <p className={message.tone === "ok" ? "stu-form-ok" : "stu-form-error"} role="status">{message.text}</p>}
    </section>
  );
}

type ReminderPrefs = { rappelsCours: boolean; rappelsPaiement: boolean };

/** Rappels automatiques : chacun se coupe sans toucher aux annonces. */
function ReminderToggles() {
  const prefs = useStudentResource<ReminderPrefs>("/etudiant/moi/notifications/preferences");
  const [local, setLocal] = useState<ReminderPrefs | null>(null);
  const [error, setError] = useState("");
  const value = local ?? prefs.data;
  if (!value) return null;

  const toggle = async (key: keyof ReminderPrefs) => {
    const next = { ...value, [key]: !value[key] };
    setLocal(next);
    setError("");
    try {
      setLocal(await studentPost<ReminderPrefs>("/etudiant/moi/notifications/preferences", { [key]: next[key] }));
    } catch (failure) {
      setLocal(value);
      setError(failure instanceof Error ? failure.message : "Réglage impossible.");
    }
  };

  const rows: Array<[keyof ReminderPrefs, string, string]> = [
    ["rappelsCours", "Rappels de cours", "15 minutes avant chaque cours."],
    ["rappelsPaiement", "Rappels de paiement", "Une semaine avant une échéance, puis la veille."],
  ];
  return (
    <div className="stu-reminders">
      {rows.map(([key, title, detail]) => (
        <div key={key} className="stu-notify-row">
          <div>
            <strong>{title}</strong>
            <p>{detail}</p>
          </div>
          <button type="button" className={`stu-switch${value[key] ? " on" : ""}`} role="switch" aria-checked={value[key]} aria-label={title} onClick={() => void toggle(key)}>
            <span />
          </button>
        </div>
      ))}
      {error && <p className="stu-form-error" role="alert">{error}</p>}
    </div>
  );
}
