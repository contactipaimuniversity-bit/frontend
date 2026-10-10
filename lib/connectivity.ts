export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// `navigator.onLine` ne dit que si l'appareil a un réseau. Lors d'une coupure de
// courant côté serveur, le Wi-Fi reste souvent allumé : on sonde donc le serveur
// lui-même pour savoir s'il faut travailler sur les données locales.
const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 4_000;
let serverDown = false;
let probing: Promise<boolean> | null = null;
let probeTimer: number | undefined;
let listening = false;

function announce(name: string) {
  window.dispatchEvent(new Event(name));
}

function scheduleProbe() {
  window.clearTimeout(probeTimer);
  probeTimer = window.setTimeout(() => void checkServer(), PROBE_INTERVAL_MS);
}

export function isOffline() {
  return typeof navigator !== "undefined" && (!navigator.onLine || serverDown);
}

/** Interroge le serveur et met à jour l'état de connexion. Renvoie true s'il répond. */
export function checkServer(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (!listening) {
    listening = true;
    window.addEventListener("online", () => { if (serverDown) void checkServer(); });
  }
  probing ??= fetch(`${API_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    .then((response) => response.ok)
    .catch(() => false)
    .then((reachable) => {
      probing = null;
      if (reachable) {
        reportServerReachable();
      } else {
        if (!serverDown) {
          serverDown = true;
          announce("ipaim-connectivity");
        }
        scheduleProbe();
      }
      return reachable;
    });
  return probing;
}

/** Une réponse du serveur vient d'arriver : il est joignable. */
export function reportServerReachable() {
  if (!serverDown) return;
  serverDown = false;
  window.clearTimeout(probeTimer);
  announce("ipaim-connectivity");
  announce("ipaim-server-online");
}
