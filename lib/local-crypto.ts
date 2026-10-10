// Chiffrement des données de consultation gardées sur l'appareil (AES-GCM).
// La clé est dérivée du mot de passe à la connexion et ne vit que le temps de
// la session du navigateur : sans le mot de passe, la copie locale est illisible.
// La file d'attente des saisies n'est pas chiffrée : elle doit rester lisible
// quoi qu'il arrive, pour ne jamais perdre un enregistrement.

const KEY_STORAGE = "ipaim-cle-locale";
let imported: { raw: string; key: CryptoKey } | null = null;

export type Sealed = { iv: Uint8Array; data: ArrayBuffer };

function toBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

/** Clé de chiffrement (brute, en base64) dérivée du mot de passe. */
export async function deriveDataKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt.slice().buffer as ArrayBuffer, iterations }, material, 256);
  return toBase64(new Uint8Array(bits));
}

/** Empreinte d'une clé : permet de savoir qu'elle a changé sans la conserver. */
export async function dataKeyFingerprint(rawKey: string) {
  const digest = await crypto.subtle.digest("SHA-256", fromBase64(rawKey));
  return toBase64(new Uint8Array(digest).slice(0, 8));
}

export function rememberDataKey(rawKey: string) {
  window.sessionStorage.setItem(KEY_STORAGE, rawKey);
  imported = null;
}

export function forgetDataKey() {
  window.sessionStorage.removeItem(KEY_STORAGE);
  imported = null;
}

async function currentKey() {
  const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(KEY_STORAGE);
  if (!raw) return null;
  if (imported?.raw !== raw)
    imported = { raw, key: await crypto.subtle.importKey("raw", fromBase64(raw), "AES-GCM", false, ["encrypt", "decrypt"]) };
  return imported.key;
}

/** Chiffre une valeur. Renvoie null quand aucune clé n'est disponible pour cette session. */
export async function seal(value: unknown): Promise<Sealed | null> {
  const key = await currentKey();
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value ?? null)));
  return { iv, data };
}

/** Déchiffre une valeur. Lève une erreur si la clé de la session ne correspond pas. */
export async function unseal(sealed: Sealed): Promise<unknown> {
  const key = await currentKey();
  if (!key) throw new Error("Clé locale indisponible.");
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.iv.slice() }, key, sealed.data);
  return JSON.parse(new TextDecoder().decode(clear));
}
