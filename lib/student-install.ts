"use client";

import { useEffect, useState } from "react";

// Installation de l'application (espace étudiant ou espace de gestion) sur
// l'écran d'accueil ou le bureau.
// Chrome/Edge (Android, ordinateur) annoncent « beforeinstallprompt » quand l'app
// est installable : on le garde pour proposer l'installation au bon moment.
// Safari (iPhone) n'a pas cet événement : on y explique le geste à faire.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const READY_EVENT = "ipaim-etudiant-installable";
const DISMISS_KEY = "ipaim-etudiant-install-plus-tard";
const DISMISS_DAYS = 7;

let deferred: InstallEvent | null = null;
if (typeof window !== "undefined") {
  // Signal déjà capté par le script de la page, avant le chargement de l'application.
  const early = () => {
    const captured = (window as Window & { __ipaimInstall?: InstallEvent | null }).__ipaimInstall;
    if (captured && captured !== deferred) {
      deferred = captured;
      window.dispatchEvent(new Event(READY_EVENT));
    }
  };
  early();
  window.addEventListener("ipaim-install-captured", early);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    window.dispatchEvent(new Event(READY_EVENT));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    window.dispatchEvent(new Event(READY_EVENT));
  });
}

type InstallState = { installed: boolean; canPrompt: boolean; ios: boolean; dismissed: boolean };

function readState(dismissKey: string, perVisit: boolean): InstallState {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ua = navigator.userAgent;
  // iPhone/iPad, y compris l'iPad qui se présente comme un Mac.
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try {
    const until = Number((perVisit ? window.sessionStorage : window.localStorage).getItem(dismissKey));
    dismissed = Number.isFinite(until) && until > Date.now();
  } catch {
    /* stockage indisponible : on propose à chaque visite */
  }
  return { installed: standalone, canPrompt: Boolean(deferred), ios, dismissed };
}

/**
 * dismissKey : où retenir « Plus tard » (un par espace).
 * perVisit : « Plus tard » ne vaut que pour la visite en cours ; la proposition
 * revient à la prochaine ouverture du site.
 */
export function useInstall(dismissKey = DISMISS_KEY, perVisit = false) {
  const [state, setState] = useState<InstallState>({ installed: true, canPrompt: false, ios: false, dismissed: true });

  useEffect(() => {
    const refresh = () => setState(readState(dismissKey, perVisit));
    refresh();
    window.addEventListener(READY_EVENT, refresh);
    return () => window.removeEventListener(READY_EVENT, refresh);
  }, [dismissKey, perVisit]);

  const prompt = async () => {
    if (!deferred) return;
    const event = deferred;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    deferred = null;
    setState(readState(dismissKey, perVisit));
    // Les autres endroits qui proposent l'installation se mettent à jour.
    window.dispatchEvent(new Event(READY_EVENT));
  };

  const dismiss = () => {
    try {
      (perVisit ? window.sessionStorage : window.localStorage).setItem(dismissKey, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      /* rien à retenir */
    }
    setState((previous) => ({ ...previous, dismissed: true }));
    window.dispatchEvent(new Event(READY_EVENT));
  };

  return {
    ...state,
    /** Il y a quelque chose à proposer : installation directe, ou geste à expliquer sur iPhone. */
    available: !state.installed && (state.canPrompt || state.ios),
    prompt,
    dismiss,
  };
}

// ---------- Guide d'installation selon le téléphone et le navigateur ----------

/**
 * Quel geste expliquer quand le navigateur ne propose pas l'installation d'un clic :
 * - ios-safari / ios-other : Partager → « Sur l'écran d'accueil » (Chrome sur
 *   iPhone le permet aussi depuis iOS 16.4, via son bouton Partager) ;
 * - in-app : lien ouvert dans WhatsApp, Facebook, Instagram… dont le
 *   navigateur intégré ne sait pas installer : il faut l'ouvrir dans Chrome ;
 * - android : Chrome sans proposition (refusée récemment, critères pas encore
 *   remplis) : menu ⋮ → « Installer l'application » / « Ajouter à l'écran d'accueil » ;
 * - desktop : icône d'installation de la barre d'adresse ou menu du navigateur.
 */
export type InstallGuide = "ios-safari" | "ios-other" | "in-app" | "android" | "desktop";

/** Lien qui ouvre directement cette page dans Chrome (Android) ou Safari (iPhone) depuis WhatsApp, Facebook… */
export function openInBrowserLink(): string | null {
  if (typeof window === "undefined") return null;
  const { host, pathname, search } = window.location;
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end`;
  if (/iphone|ipad|ipod/i.test(ua)) return `x-safari-https://${host}${pathname}${search}`;
  return null;
}

export function installGuide(): InstallGuide {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Snapchat|TikTok|Twitter|; wv\)/i.test(ua);
  if (inApp) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios-safari";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

// Une seule grande fenêtre à la fois : celle des notifications attend que
// celle de l'installation soit fermée.
const MODAL_EVENT = "ipaim-etudiant-install-modal";
let installModalOpen = false;

export function setInstallModalOpen(open: boolean) {
  if (installModalOpen === open) return;
  installModalOpen = open;
  window.dispatchEvent(new Event(MODAL_EVENT));
}

export function useInstallModalOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const refresh = () => setOpen(installModalOpen);
    refresh();
    window.addEventListener(MODAL_EVENT, refresh);
    return () => window.removeEventListener(MODAL_EVENT, refresh);
  }, []);
  return open;
}

/** L'application est-elle ouverte depuis l'écran d'accueil (installée) ? */
export function isStandalone() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
