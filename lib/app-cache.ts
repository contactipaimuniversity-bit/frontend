/**
 * Efface les fichiers de l'application gardés par le navigateur (pages, scripts,
 * images) puis recharge. La session, les données de consultation et les saisies
 * hors ligne en attente sont ailleurs (sessionStorage, IndexedDB) : elles restent.
 */
export async function clearAppCacheAndReload() {
  // Sans réseau, l'application ne pourrait plus se rouvrir : on vérifie d'abord.
  try {
    await fetch(window.location.origin, { method: "HEAD", cache: "no-store" });
  } catch {
    throw new Error("Connexion indisponible : le cache n'a pas été vidé, sinon l'application ne pourrait plus s'ouvrir.");
  }
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ("caches" in window) {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  }
  window.location.reload();
}
