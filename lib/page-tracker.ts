"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/offline";

const IDLE_AFTER_MS = 5 * 60 * 1000;
const MIN_DURATION_MS = 1000;

// Mesure le temps réellement passé sur chaque écran pour la page d'audit :
// seul compte le temps où l'onglet est visible et l'utilisateur actif
// (au-delà de 5 minutes sans interaction, le compteur s'arrête).
export function usePageTimeTracker(page: string, titre: string, token: string | null) {
  useEffect(() => {
    if (!token) return;
    let startedAt: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let lastInteraction = Date.now();

    const send = () => {
      if (startedAt === null) return;
      const end = Math.min(Date.now(), lastInteraction + IDLE_AFTER_MS);
      const dureeMs = end - startedAt;
      const debut = new Date(startedAt).toISOString();
      startedAt = null;
      if (dureeMs < MIN_DURATION_MS) return;
      // keepalive : la mesure part même si l'onglet se ferme.
      void fetch(`${API_URL}/audit/navigation`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ page, titre, debut, dureeMs }),
      }).catch(() => undefined);
    };
    const onInteraction = () => {
      const now = Date.now();
      // Retour après une longue inactivité : on clôt la période précédente et on en ouvre une nouvelle.
      if (startedAt !== null && now - lastInteraction > IDLE_AFTER_MS) {
        send();
        startedAt = now;
      }
      lastInteraction = now;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") send();
      else {
        startedAt = Date.now();
        lastInteraction = Date.now();
      }
    };

    const interactionEvents = ["pointerdown", "keydown", "wheel", "touchstart", "pointermove"] as const;
    for (const name of interactionEvents) window.addEventListener(name, onInteraction, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      send();
      for (const name of interactionEvents) window.removeEventListener(name, onInteraction);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
    };
  }, [page, titre, token]);
}
