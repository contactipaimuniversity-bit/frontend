"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/connectivity";
import { studentPost, studentToken } from "@/lib/student-api";

// Notifications push de l'espace étudiant : les annonces arrivent sur le
// téléphone même application fermée. Sur iPhone, seulement une fois l'app
// installée sur l'écran d'accueil (iOS 16.4 ou plus récent).

export type PushSupport = "ok" | "ios-install" | "unsupported";
export type PushState = { support: PushSupport; permission: NotificationPermission | "unknown"; subscribed: boolean; ready: boolean };

const CHANGE_EVENT = "ipaim-etudiant-push";
const WORKER_TIMEOUT_MS = 6000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "ios-install";
  return capable ? "ok" : "unsupported";
}

// Le service worker de l'espace étudiant (enregistré par l'application installée/en ligne).
async function worker(): Promise<ServiceWorkerRegistration> {
  const registration = await Promise.race([
    navigator.serviceWorker.getRegistration("/etudiant").then((found) => found ?? navigator.serviceWorker.ready),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), WORKER_TIMEOUT_MS)),
  ]);
  if (!registration) throw new Error("Les notifications ne sont disponibles que dans l'application en ligne (pas en mode test).");
  return registration;
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function currentSubscription() {
  if (pushSupport() !== "ok") return null;
  try {
    const registration = await worker();
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Active les notifications : autorisation, abonnement du téléphone, envoi au serveur. */
export async function enablePush() {
  if (pushSupport() !== "ok") throw new Error("Les notifications ne sont pas disponibles sur ce navigateur.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications refusées. Tu peux les autoriser dans les réglages du téléphone, rubrique du navigateur ou de l'application." : "Autorisation non accordée.");
  const response = await fetch(`${API_URL}/etudiant/push/cle`);
  const { cle } = (await response.json().catch(() => ({}))) as { cle?: string | null };
  if (!cle) throw new Error("Les notifications ne sont pas encore disponibles. Réessaie plus tard.");
  const registration = await worker();
  const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cle) }));
  await studentPost("/etudiant/moi/push", subscription.toJSON());
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (subscription) {
    await studentPost("/etudiant/moi/push/desabonnement", { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function testPush() {
  const subscription = await currentSubscription();
  if (!subscription) throw new Error("Active d'abord les notifications.");
  await studentPost("/etudiant/moi/push/essai", { endpoint: subscription.endpoint });
}

/** À la déconnexion : ce téléphone ne reçoit plus les annonces de ce compte. */
export async function forgetPushForSignOut() {
  const subscription = await currentSubscription();
  if (subscription && studentToken()) await studentPost("/etudiant/moi/push/desabonnement", { endpoint: subscription.endpoint }).catch(() => undefined);
}

/**
 * Au démarrage : un téléphone déjà autorisé est (ré)attaché au compte connecté,
 * par exemple après une reconnexion ou un changement de compte.
 */
export async function syncPushSubscription() {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) await studentPost("/etudiant/moi/push", subscription.toJSON()).catch(() => undefined);
}

export function usePush() {
  const [state, setState] = useState<PushState>({ support: "unsupported", permission: "unknown", subscribed: false, ready: false });
  const refresh = useCallback(async () => {
    const support = pushSupport();
    const permission = support === "ok" ? Notification.permission : "unknown";
    const subscription = support === "ok" && permission === "granted" ? await currentSubscription() : null;
    setState({ support, permission, subscribed: Boolean(subscription), ready: true });
  }, []);
  useEffect(() => {
    const run = () => void refresh();
    const first = window.setTimeout(run, 0);
    window.addEventListener(CHANGE_EVENT, run);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener(CHANGE_EVENT, run);
    };
  }, [refresh]);
  return state;
}
