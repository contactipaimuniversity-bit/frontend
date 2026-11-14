"use client";

import { useEffect, useState } from "react";

// Installation de l'espace étudiant sur l'écran d'accueil.
// Chrome/Edge (Android, ordinateur) annoncent « beforeinstallprompt » quand l'app
// est installable : on le garde pour proposer l'installation au bon moment.
// Safari (iPhone) n'a pas cet événement : on y explique le geste à faire.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const READY_EVENT = "ipaim-etudiant-installable";
const DISMISS_KEY = "ipaim-etudiant-install-plus-tard";
const DISMISS_DAYS = 7;

let deferred: InstallEvent | null = null;
if (typeof window !== "undefined") {
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

function readState(): InstallState {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ua = navigator.userAgent;
  // iPhone/iPad, y compris l'iPad qui se présente comme un Mac.
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY));
    dismissed = Number.isFinite(until) && until > Date.now();
  } catch {
    /* stockage indisponible : on propose à chaque visite */
  }
  return { installed: standalone, canPrompt: Boolean(deferred), ios, dismissed };
}

export function useInstall() {
  const [state, setState] = useState<InstallState>({ installed: true, canPrompt: false, ios: false, dismissed: true });

  useEffect(() => {
    const refresh = () => setState(readState());
    refresh();
    window.addEventListener(READY_EVENT, refresh);
    return () => window.removeEventListener(READY_EVENT, refresh);
  }, []);

  const prompt = async () => {
    if (!deferred) return;
    const event = deferred;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    deferred = null;
    setState(readState());
  };

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      /* rien à retenir */
    }
    setState((previous) => ({ ...previous, dismissed: true }));
  };

  return {
    ...state,
    /** Il y a quelque chose à proposer : installation directe, ou geste à expliquer sur iPhone. */
    available: !state.installed && (state.canPrompt || state.ios),
    prompt,
    dismiss,
  };
}
