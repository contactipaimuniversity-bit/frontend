import { API_URL, checkServer, isOffline, reportServerReachable } from "./connectivity";
import { dataKeyFingerprint, deriveDataKey, rememberDataKey, seal, Sealed, unseal } from "./local-crypto";

export { API_URL };

export type OfflineOperation = {
  id: string;
  key: string;
  userId: string;
  temporaryId: string;
  temporaryRelatedId?: string;
  path: string;
  method: OfflineMethod;
  body: unknown;
  createdAt: number;
  error?: string;
  /** Version de la fiche connue de l'appareil au moment d'une modification (PATCH). */
  baseVersion?: string;
};
export type OfflineMethod = "POST" | "PATCH" | "PUT";

/** Envoi de fichier mis en file : la pièce attend sur l'appareil avec son dossier. */
export type QueuedUpload = { __multipart: true; fields: Record<string, string>; fileField: string; file: Blob; fileName: string };

export function isQueuedUpload(body: unknown): body is QueuedUpload {
  return Boolean(body && typeof body === "object" && (body as { __multipart?: unknown }).__multipart === true);
}

/** Corps d'une requête sous une forme que la file d'attente sait conserver. */
export function toQueuedBody(body: BodyInit | null | undefined): unknown {
  if (typeof body === "string") return JSON.parse(body);
  if (!(body instanceof FormData)) return body ?? undefined;
  const upload: QueuedUpload = { __multipart: true, fields: {}, fileField: "fichier", file: new Blob(), fileName: "" };
  for (const [name, value] of body.entries()) {
    if (typeof value === "string") upload.fields[name] = value;
    else Object.assign(upload, { fileField: name, file: value, fileName: value.name });
  }
  return upload;
}

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type CachedResponse = { key: string; value: unknown; savedAt: number };
// Sur le disque, la valeur est chiffrée dès qu'une clé de session existe.
type StoredResponse = { key: string; savedAt: number; value?: unknown; sealed?: Sealed };
/** Personne créée hors ligne qui ressemble à une fiche déjà présente sur le serveur. */
export type DuplicateNotice = {
  id: string;
  nom: string;
  prenom: string;
  date: number;
  similaires: Array<{ id: string; nom: string; prenom: string; dateNaissance?: string | null; telephone?: string | null; matricule?: string | null }>;
};
type IdMapping = { temporaryId: string; realId: string };
export type OfflineAccount = { userId: string; email: string; user: import("./types").User };
type StoredOfflineAccount = OfflineAccount & {
  salt: string;
  verifier: string;
  iterations: number;
  lastOnlineAt?: number;
  /** Sel de la clé qui chiffre les données de consultation, et empreinte de cette clé. */
  dataSalt?: string;
  dataKeyCheck?: string;
};
const versionedRecordPath = /^\/(personnes|prospects|demandes-bourse|inscriptions|candidatures-personnel)\/([^/]+)$/;
const MIRROR_LIFETIME_MS = 60_000;

// Sans connexion en ligne pendant ce délai, le déverrouillage local est refusé :
// un compte désactivé ou dont les droits ont changé ne reste pas ouvert indéfiniment.
const OFFLINE_ACCOUNT_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;
// Deux envois identiques dans ce délai sont un double clic, pas deux saisies.
const DOUBLE_SUBMIT_WINDOW_MS = 2000;
const databaseName = "ipaim-offline-v1";
let databasePromise: Promise<IDBDatabase> | undefined;

function database() {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("Le stockage local est indisponible."));
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("responses"))
        db.createObjectStore("responses", { keyPath: "key" });
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id" });
      } else {
        const queue = request.transaction?.objectStore("queue");
        const cursorRequest = queue?.openCursor();
        if (cursorRequest) {
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const oldOperation = cursor.value as Partial<OfflineOperation>;
            cursor.update({
              ...oldOperation,
              userId: oldOperation.userId ?? scope(window.sessionStorage.getItem("ipaim-token")),
              method: oldOperation.method ?? "POST",
            });
            cursor.continue();
          };
        }
      }
      if (!db.objectStoreNames.contains("mappings"))
        db.createObjectStore("mappings", { keyPath: "temporaryId" });
      if (!db.objectStoreNames.contains("offlineAccounts"))
        db.createObjectStore("offlineAccounts", { keyPath: "email" });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Le navigateur peut fermer la connexion de lui-même (données du site
      // effacées, autre onglet qui met la base à jour) : on en rouvrira une.
      const forget = () => { databasePromise = undefined; };
      db.onclose = forget;
      db.onversionchange = () => { db.close(); forget(); };
      resolve(db);
    };
    request.onerror = () => { databasePromise = undefined; reject(request.error); };
  });
  return databasePromise;
}

async function store<T>(name: string, mode: IDBTransactionMode, action: (objectStore: IDBObjectStore) => IDBRequest<T>) {
  const run = async () => {
    const db = await database();
    return new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(name, mode).objectStore(name));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  try {
    return await run();
  } catch (failure) {
    // Connexion fermée entre-temps : une nouvelle tentative la rouvre.
    if (!(failure instanceof DOMException) || failure.name !== "InvalidStateError") throw failure;
    databasePromise = undefined;
    return run();
  }
}

function scope(token: string | null) {
  if (!token) {
    if (typeof window !== "undefined") {
      try {
        const session = JSON.parse(window.sessionStorage.getItem("ipaim-offline-session") ?? "null") as { userId?: string } | null;
        if (session?.userId) return session.userId;
      } catch {}
    }
    return "anonymous";
  }
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).sub as string;
  } catch {
    return "session";
  }
}

export function responseCacheKey(url: string, token: string | null) {
  return `${scope(token)}:${url}`;
}

// Copie déchiffrée, en mémoire, des données de consultation de l'utilisateur courant :
// les fusions d'affichage la parcourent souvent, on évite de tout déchiffrer à chaque fois.
let mirror: { scope: string; loadedAt: number; entries: Map<string, CachedResponse> } | null = null;

function currentScope() {
  return scope(typeof window === "undefined" ? null : window.sessionStorage.getItem("ipaim-token"));
}

// Une entrée illisible (clé différente après un changement de mot de passe) est traitée comme absente.
async function openStored(stored: StoredResponse | undefined): Promise<CachedResponse | undefined> {
  if (!stored) return undefined;
  if (!stored.sealed) return { key: stored.key, savedAt: stored.savedAt, value: stored.value };
  try {
    return { key: stored.key, savedAt: stored.savedAt, value: await unseal(stored.sealed) };
  } catch {
    return undefined;
  }
}

export async function cacheResponse(key: string, value: unknown) {
  const savedAt = Date.now();
  const sealed = await seal(value);
  const stored: StoredResponse = sealed ? { key, savedAt, sealed } : { key, savedAt, value };
  await store("responses", "readwrite", (objectStore) => objectStore.put(stored));
  if (mirror && key.startsWith(`${mirror.scope}:`)) mirror.entries.set(key, { key, savedAt, value });
}

export async function readCachedResponse<T>(key: string) {
  const cached = await openStored(await store<StoredResponse | undefined>("responses", "readonly", (objectStore) => objectStore.get(key)));
  return cached?.value as T | undefined;
}

/** Données de consultation de l'utilisateur courant, déchiffrées. */
async function listCachedResponses() {
  const owner = currentScope();
  if (mirror && mirror.scope === owner && Date.now() - mirror.loadedAt < MIRROR_LIFETIME_MS)
    return [...mirror.entries.values()];
  const stored = await store<StoredResponse[]>("responses", "readonly", (objectStore) =>
    objectStore.getAll(IDBKeyRange.bound(`${owner}:`, `${owner}:\uffff`)));
  const opened = (await Promise.all(stored.map(openStored))).filter((entry): entry is CachedResponse => Boolean(entry));
  mirror = { scope: owner, loadedAt: Date.now(), entries: new Map(opened.map((entry) => [entry.key, entry])) };
  return opened;
}

// Dernière version connue d'une fiche, d'après les copies gardées sur l'appareil.
async function knownVersion(recordId: string) {
  let latest: string | undefined;
  const consider = (item: Record<string, unknown> | undefined) => {
    if (item?.id === recordId && typeof item.modifieLe === "string" && (!latest || item.modifieLe > latest)) latest = item.modifieLe;
  };
  for (const entry of await listCachedResponses()) {
    const rows = Array.isArray(entry.value) ? entry.value : asRecord(entry.value)?.data ?? [entry.value];
    for (const row of Array.isArray(rows) ? rows.map(asRecord) : []) {
      consider(row);
      consider(asRecord(row?.personne));
    }
  }
  return latest;
}

export async function readCachedProspectRelances(
  prospectId: string,
  token: string | null,
) {
  const keyPrefix = `${scope(token)}:`;
  const cachedResponses = (await listCachedResponses())
    .filter((entry) => entry.key.startsWith(keyPrefix))
    .sort((left, right) => right.savedAt - left.savedAt);

  for (const entry of cachedResponses) {
    const cachedUrl = new URL(
      entry.key.slice(keyPrefix.length),
      window.location.origin,
    );
    if (cachedUrl.pathname !== "/prospects") continue;
    const cachedRows = asRecord(entry.value)?.data;
    if (!Array.isArray(cachedRows)) continue;
    const prospect = cachedRows
      .map(asRecord)
      .find((item) => item?.id === prospectId);
    if (Array.isArray(prospect?.relances)) return prospect.relances;
  }

  return undefined;
}

export async function listOfflineOperations(token?: string | null) {
  const operations = await store<OfflineOperation[]>("queue", "readonly", (objectStore) => objectStore.getAll());
  return (token === undefined ? operations : operations.filter((operation) => operation.userId === scope(token)))
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

export async function enqueueOperation(path: string, method: OfflineMethod, body: unknown, key: string, token: string | null, temporaryId: string = crypto.randomUUID()) {
  const queue = await listOfflineOperations(token);
  const serialized = JSON.stringify(body);
  const now = performance.timeOrigin + performance.now();
  // Deux versements identiques pour un même dossier sont légitimes : seul un
  // double clic (même contenu, à l'instant) est écarté.
  const duplicate = queue.find((operation) =>
    operation.method === method &&
    operation.path === path &&
    now - operation.createdAt < DOUBLE_SUBMIT_WINDOW_MS &&
    JSON.stringify(operation.body) === serialized);
  if (duplicate) return duplicate;

  const operation: OfflineOperation = {
    id: key,
    key,
    userId: scope(token),
    temporaryId,
    temporaryRelatedId:
      path === "/prospects" && !(body as { personneId?: string })?.personneId
        ? crypto.randomUUID()
        : (path === "/demandes-bourse" || path === "/inscriptions") &&
            asRecord(body)?.nouvellePersonne
          ? crypto.randomUUID()
          : undefined,
    path,
    method,
    body,
    createdAt: now,
    // Une fiche créée hors ligne (identifiant provisoire) n'a pas encore de version serveur.
    baseVersion: method === "PATCH" && versionedRecordPath.test(path)
      ? await knownVersion(path.match(versionedRecordPath)![2]).catch(() => undefined)
      : undefined,
  };
  await store("queue", "readwrite", (objectStore) => objectStore.put(operation));
  window.dispatchEvent(new Event("ipaim-offline-change"));
  return operation;
}

export async function updateOfflineOperation(operation: OfflineOperation) {
  await store("queue", "readwrite", (objectStore) => objectStore.put(operation));
  window.dispatchEvent(new Event("ipaim-offline-change"));
}

export async function removeOfflineOperation(id: string) {
  await store("queue", "readwrite", (objectStore) => objectStore.delete(id));
  window.dispatchEvent(new Event("ipaim-offline-change"));
}

async function idMappings() {
  return store<IdMapping[]>("mappings", "readonly", (objectStore) => objectStore.getAll());
}

function replaceIds(value: unknown, mappings: Map<string, string>): unknown {
  if (typeof value === "string") return mappings.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceIds(item, mappings));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceIds(item, mappings)]));
  return value;
}

/** Copie de secours de la file d'attente (et des correspondances d'identifiants) de l'utilisateur. */
export async function exportOfflineQueue(token: string | null) {
  return {
    format: "ipaim-file-attente",
    version: 1,
    exportedAt: new Date().toISOString(),
    userId: scope(token),
    // Les pièces jointes en attente sont incluses, encodées dans le fichier.
    operations: await Promise.all((await listOfflineOperations(token)).map(async (operation) =>
      isQueuedUpload(operation.body)
        ? { ...operation, body: { ...operation.body, file: await toDataUrl(operation.body.file) } }
        : operation)),
    mappings: await idMappings(),
  };
}

/** Recharge une copie de secours. Renvoie le nombre d'enregistrements remis en attente. */
export async function importOfflineQueue(backup: unknown, token: string | null) {
  const file = asRecord(backup);
  if (file?.format !== "ipaim-file-attente" || !Array.isArray(file.operations))
    throw new Error("Ce fichier n’est pas une copie de secours IPAIM.");
  if (file.userId !== scope(token))
    throw new Error("Cette copie de secours appartient à un autre utilisateur.");
  const known = new Set((await listOfflineOperations()).map((operation) => operation.id));
  let restored = 0;
  for (const mapping of Array.isArray(file.mappings) ? file.mappings : []) {
    const item = asRecord(mapping);
    if (typeof item?.temporaryId === "string" && typeof item.realId === "string")
      await store("mappings", "readwrite", (objectStore) => objectStore.put({ temporaryId: item.temporaryId, realId: item.realId }));
  }
  for (const candidate of file.operations) {
    const operation = asRecord(candidate);
    if (
      typeof operation?.id !== "string" || typeof operation.key !== "string" ||
      typeof operation.temporaryId !== "string" || typeof operation.path !== "string" ||
      (operation.method !== "POST" && operation.method !== "PATCH" && operation.method !== "PUT") ||
      typeof operation.createdAt !== "number" || known.has(operation.id)
    ) continue;
    const body = asRecord(operation.body);
    if (body?.__multipart === true && typeof body.file === "string")
      operation.body = { ...body, file: await (await fetch(body.file)).blob() };
    await store("queue", "readwrite", (objectStore) => objectStore.put({ ...operation, userId: scope(token), error: undefined }));
    restored += 1;
  }
  window.dispatchEvent(new Event("ipaim-offline-change"));
  return restored;
}

/** Efface les données de consultation gardées sur l'appareil (jamais la file d'attente). */
export async function clearCachedResponses() {
  await store("responses", "readwrite", (objectStore) => objectStore.clear());
  mirror = null;
}

const duplicateNoticesKey = () => `ipaim-doublons:${currentScope()}`;

/** Personnes créées hors ligne à rapprocher d'une fiche existante. */
export function listDuplicateNotices(): DuplicateNotice[] {
  try {
    return JSON.parse(window.localStorage.getItem(duplicateNoticesKey()) ?? "[]") as DuplicateNotice[];
  } catch {
    return [];
  }
}

export function dismissDuplicateNotice(id: string) {
  try {
    window.localStorage.setItem(duplicateNoticesKey(), JSON.stringify(listDuplicateNotices().filter((notice) => notice.id !== id)));
  } catch {}
  window.dispatchEvent(new Event("ipaim-offline-change"));
}

// Après l'envoi d'une personne créée hors ligne : le serveur connaît-il déjà quelqu'un de semblable ?
async function noteDuplicates(person: Record<string, unknown> | undefined, token: string) {
  if (typeof person?.id !== "string" || typeof person.nom !== "string" || typeof person.prenom !== "string") return;
  const query = new URLSearchParams({ nom: person.nom, prenom: person.prenom, exclure: person.id });
  if (typeof person.dateNaissance === "string") query.set("dateNaissance", person.dateNaissance);
  if (typeof person.telephone === "string") query.set("telephone", person.telephone);
  const response = await fetch(`${API_URL}/personnes/doublons?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  const similaires = response.ok ? await response.json() as DuplicateNotice["similaires"] : [];
  if (!Array.isArray(similaires) || !similaires.length) return;
  const notices = listDuplicateNotices().filter((notice) => notice.id !== person.id);
  notices.push({ id: person.id, nom: person.nom, prenom: person.prenom, date: Date.now(), similaires });
  window.localStorage.setItem(duplicateNoticesKey(), JSON.stringify(notices.slice(-50)));
}

export async function syncOfflineQueue(token: string) {
  if (isOffline()) return;
  const queue = await listOfflineOperations(token);
  // Identifiants locaux des enregistrements refusés : ce qui en dépend ne peut pas être envoyé.
  const rejectedLocalIds: string[] = [];
  for (const operation of queue) {
    let rejected = false;
    try {
      const mappings = new Map((await idMappings()).map((mapping) => [mapping.temporaryId, mapping.realId]));
      const resolvedPath = [...mappings].reduce((path, [temporaryId, realId]) => path.replaceAll(temporaryId, realId), operation.path);
      if (isOffline()) break;
      const serializedOperation = `${operation.path} ${JSON.stringify(operation.body)}`;
      if (rejectedLocalIds.some((localId) => serializedOperation.includes(localId))) {
        rejected = true;
        throw new Error("Cet enregistrement dépend d’un autre enregistrement à vérifier.");
      }
      let response: Response;
      try {
        let payloadBody: BodyInit | undefined;
        if (isQueuedUpload(operation.body)) {
          const form = new FormData();
          for (const [name, value] of Object.entries(operation.body.fields)) form.append(name, mappings.get(value) ?? value);
          form.append(operation.body.fileField, operation.body.file, operation.body.fileName);
          payloadBody = form;
        } else if (operation.body !== undefined) {
          payloadBody = JSON.stringify(replaceIds(operation.body, mappings));
        }
        response = await fetch(`${API_URL}${resolvedPath}`, {
          method: operation.method,
          headers: {
            // Pour un fichier, le navigateur fixe lui-même l'en-tête multipart.
            ...(payloadBody instanceof FormData ? {} : { "Content-Type": "application/json" }),
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": operation.key,
            // Heure réelle de la saisie et identifiant donné sur l'appareil (repris sur le reçu).
            "X-Saisie-Le": new Date(operation.createdAt).toISOString(),
            ...(operation.method === "POST" ? { "X-Identifiant-Local": operation.temporaryId } : {}),
            // Le serveur refuse la modification si la fiche a changé depuis cette version.
            ...(operation.baseVersion ? { "X-Version-Connue": operation.baseVersion } : {}),
          },
          body: payloadBody,
        });
      } catch {
        void checkServer();
        throw new Error("Serveur injoignable. Un nouvel essai sera fait automatiquement.");
      }
      reportServerReachable();
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        // Un refus définitif du serveur ne doit pas bloquer le reste de la file ;
        // une session expirée, une surcharge ou une panne serveur, si.
        rejected = response.status >= 400 && response.status < 500 && ![401, 408, 429].includes(response.status);
        if (response.status === 401) window.dispatchEvent(new Event("ipaim-session-expired"));
        const message = Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message;
        throw new Error(typeof message === "string" && message ? message : "Envoi impossible.");
      }
      if (payload && typeof payload.id === "string")
        await store("mappings", "readwrite", (objectStore) => objectStore.put({ temporaryId: operation.temporaryId, realId: payload.id } satisfies IdMapping));
      const body = asRecord(operation.body);
      const localPersonId = operation.temporaryRelatedId ?? (
        body?.nouvellePersonne &&
        (operation.path === "/demandes-bourse" || operation.path === "/inscriptions")
          ? `${operation.temporaryId}:person`
          : undefined
      );
      const realPersonId = payload?.personne?.id;
      if (localPersonId && typeof realPersonId === "string")
        await store("mappings", "readwrite", (objectStore) => objectStore.put({ temporaryId: localPersonId, realId: realPersonId } satisfies IdMapping));
      if (
        operation.method === "POST" &&
        (operation.path === "/demandes-bourse" || operation.path === "/inscriptions") &&
        Array.isArray(payload?.elementsDossier)
      ) {
        for (const element of payload.elementsDossier) {
          const requiredElementId = element.elementRequis?.id ?? element.elementRequisId;
          if (typeof element.id === "string" && typeof requiredElementId === "string") {
            await store("mappings", "readwrite", (objectStore) =>
              objectStore.put({
                temporaryId: `${operation.temporaryId}:element:${requiredElementId}`,
                realId: element.id,
              } satisfies IdMapping),
            );
          }
        }
      }
      // Nos propres modifications suivantes de la même fiche partent de cette nouvelle version.
      if (operation.method === "PATCH" && typeof payload?.modifieLe === "string") {
        for (const next of queue) {
          if (next.id === operation.id || next.method !== "PATCH" || next.path !== operation.path || !next.baseVersion) continue;
          next.baseVersion = payload.modifieLe;
          await store("queue", "readwrite", (objectStore) => objectStore.put(next));
        }
      }
      if (operation.method === "POST") {
        const createdPerson = operation.path === "/personnes" ? asRecord(payload) : localPersonId ? asRecord(payload?.personne) : undefined;
        await noteDuplicates(createdPerson, token).catch(() => undefined);
      }
      await removeOfflineOperation(operation.id);
    } catch (failure) {
      await updateOfflineOperation({
        ...operation,
        error: failure instanceof Error ? failure.message : "Synchronisation impossible.",
      });
      if (!rejected) break;
      rejectedLocalIds.push(operation.temporaryId);
      if (operation.temporaryRelatedId) rejectedLocalIds.push(operation.temporaryRelatedId);
    }
  }
  window.dispatchEvent(new Event("ipaim-offline-change"));
  window.dispatchEvent(new Event("ipaim-sync-complete"));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function localPerson(operation: OfflineOperation, body: Record<string, unknown>, id = operation.temporaryId) {
  return {
    id,
    nom: body.nom ?? "",
    prenom: body.prenom ?? "",
    telephone: body.telephone,
    quartier: body.quartier,
    dateNaissance: body.dateNaissance,
    lieuNaissance: body.lieuNaissance,
    tuteurNom: body.tuteurNom,
    tuteurPrenom: body.tuteurPrenom,
    tuteurTelephone: body.tuteurTelephone,
    dateEnregistrement: new Date(operation.createdAt).toISOString(),
    _offline: true,
  };
}

function applyPendingProspectRelances(
  prospects: unknown[],
  operations: OfflineOperation[],
) {
  const pendingByProspect = new Map<string, Array<Record<string, unknown>>>();
  for (const operation of operations) {
    if (operation.method !== "POST") continue;
    const match = operation.path.match(/^\/prospects\/([^/]+)\/relances$/);
    const body = asRecord(operation.body);
    if (!match || !body) continue;
    const relances = pendingByProspect.get(match[1]) ?? [];
    relances.push({
      id: operation.temporaryId,
      commentaire: body.commentaire,
      intention: body.intention ?? null,
      statutRelance: body.statutRelance,
      date: new Date(operation.createdAt).toISOString(),
      dateProchaineRelance: body.dateProchaineRelance ?? null,
      utilisateurNom: "En attente de synchronisation",
      _offline: true,
    });
    pendingByProspect.set(match[1], relances);
  }

  return prospects.map((prospect) => {
    const item = asRecord(prospect);
    const pendingRelances = item?.id
      ? pendingByProspect.get(String(item.id))
      : undefined;
    if (!item || !pendingRelances?.length) return prospect;
    const latest = pendingRelances[pendingRelances.length - 1];
    return {
      ...item,
      statutRelance: latest.statutRelance ?? item.statutRelance,
      ...(Object.prototype.hasOwnProperty.call(latest, "intention")
        ? { intention: latest.intention }
        : {}),
      relances: [...pendingRelances.slice().reverse(), ...(Array.isArray(item.relances) ? item.relances : [])],
      _offline: true,
    };
  });
}

export async function mergeOfflineRecords<T>(path: string, value: T): Promise<T> {
  const parsedUrl = new URL(path, window.location.origin);
  const resource = parsedUrl.pathname;
  const prospectRelanceMatch = resource.match(/^\/prospects\/([^/]+)\/relances$/);
  if (prospectRelanceMatch && Array.isArray(value)) {
    const token = window.sessionStorage.getItem("ipaim-token");
    const operations = await listOfflineOperations(token);
    const prospectWithPendingRelances = applyPendingProspectRelances(
      [{ id: prospectRelanceMatch[1], relances: value }],
      operations,
    )[0];
    return (asRecord(prospectWithPendingRelances)?.relances ?? value) as T;
  }
  if (resource === "/paiements/non-affectes" && Array.isArray(value)) {
    const token = window.sessionStorage.getItem("ipaim-token");
    const operations = await listOfflineOperations(token);
    const cached = await listCachedResponses();
    const cachedRows = cached
      .filter((entry) => entry.key.startsWith(`${scope(token)}:`))
      .flatMap((entry) => Array.isArray(entry.value) ? entry.value : asRecord(entry.value)?.data ?? [])
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => Boolean(item?.id));
    const assignedPaymentIds = new Set(
      operations.flatMap((operation) => {
        const match = operation.method === "PATCH"
          ? operation.path.match(/^\/paiements\/([^/]+)\/affectation$/)
          : null;
        return match ? [match[1]] : [];
      }),
    );
    const pendingPayments = operations.flatMap((operation) => {
      if (operation.path !== "/paiements" || operation.method !== "POST") return [];
      if (assignedPaymentIds.has(operation.temporaryId)) return [];
      const body = asRecord(operation.body);
      if (!body) return [];
      if (body.elementDossierId || body.echeanceId) return [];
      const dossierId = body.demandeBourseId ?? body.inscriptionId;
      const dossier = cachedRows.find((item) => item.id === dossierId);
      const dossierOperation = operations.find((candidate) =>
        candidate.method === "POST" &&
        candidate.temporaryId === dossierId &&
        (candidate.path === "/demandes-bourse" || candidate.path === "/inscriptions"),
      );
      const dossierBody = asRecord(dossierOperation?.body);
      const nestedPerson = asRecord(dossierBody?.nouvellePersonne);
      const personOperation = dossierBody?.personneId
        ? operations.find((candidate) =>
            candidate.path === "/personnes" &&
            candidate.method === "POST" &&
            candidate.temporaryId === dossierBody.personneId,
          )
        : undefined;
      const person = asRecord(dossier?.personne) ??
        (nestedPerson && dossierOperation
          ? localPerson(
              dossierOperation,
              nestedPerson,
              dossierOperation.temporaryRelatedId ?? `${dossierOperation.temporaryId}:person`,
            )
          : personOperation
            ? localPerson(personOperation, asRecord(personOperation.body)!)
            : cachedRows.find((item) => item.id === dossierBody?.personneId));
      return [{
        id: operation.temporaryId,
        montant: body.montant ?? 0,
        datePaiement: new Date(operation.createdAt).toISOString(),
        typePaiement: body.typePaiement ?? "FRAIS_DEPOT",
        dossierId: String(dossierId ?? ""),
        dossierType: body.demandeBourseId ? "demande-bourse" : "inscription",
        personne: person,
        _offline: true,
      }];
    });
    const confirmedUnassigned = value.filter((payment) =>
      !assignedPaymentIds.has(String(asRecord(payment)?.id)),
    );
    return [...pendingPayments, ...confirmedUnassigned] as T;
  }

  const detailMatch = resource.match(
    /^\/(demandes-bourse|inscriptions)\/([^/]+)\/elements$/,
  );
  if (detailMatch && Array.isArray(value)) {
    const [, collection, dossierId] = detailMatch;
    const token = window.sessionStorage.getItem("ipaim-token");
    const operations = await listOfflineOperations(token);
    let elements = value as unknown[];
    if (elements.length === 0) {
      const dossierOperation = operations.find((operation) =>
        operation.path === `/${collection}` &&
        operation.method === "POST" &&
        operation.temporaryId === dossierId,
      );
      const dossierBody = asRecord(dossierOperation?.body);
      const cached = await listCachedResponses();
      const catalogEntry = cached.find((entry) =>
        entry.key.startsWith(`${scope(token)}:`) &&
        entry.key.endsWith("/elements-requis"),
      );
      const catalog = Array.isArray(catalogEntry?.value)
        ? catalogEntry.value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item?.id))
        : [];
      if (dossierOperation && dossierBody) {
        const isScholarship = collection === "demandes-bourse";
        const level = String(isScholarship ? dossierBody.niveauDemande : dossierBody.niveau ?? "").toUpperCase();
        const firstYear = level.includes("PREMIERE") || level.includes("1");
        elements = catalog
          .filter((item) => {
            const context = item.contexte;
            const applicableLevel = item.niveauApplicable;
            const contextMatches = isScholarship
              ? context === "BOURSE" || context === "TOUS"
              : context === "INSCRIPTION_DIRECTE" || context === "TOUS";
            const levelMatches = firstYear
              ? applicableLevel === "PREMIERE_ANNEE" || applicableLevel === "TOUS"
              : applicableLevel === "DEUXIEME_ANNEE" || applicableLevel === "DEUXIEME_ANNEE_PLUS" || applicableLevel === "TOUS";
            return contextMatches && levelMatches;
          })
          .map((item) => ({
            id: `${dossierOperation.temporaryId}:element:${item.id}`,
            [isScholarship ? "demandeBourseId" : "inscriptionId"]: dossierId,
            elementRequisId: item.id,
            statut: "ATTENDU",
            montantAttendu: item.montantAttendu ?? null,
            elementRequis: {
              id: item.id,
              nom: item.nom,
              obligatoire: item.obligatoire,
              elementSubstitutId: item.elementSubstitutId ?? null,
            },
            paiements: [],
            _offline: true,
          }));
      }
    }
    const statusUpdates = new Map<string, string>();
    for (const operation of operations) {
      const match = operation.method === "PATCH"
        ? operation.path.match(
            new RegExp(`^/${collection}/${dossierId}/elements/([^/]+)$`),
          )
        : null;
      const status = asRecord(operation.body)?.statut;
      if (match && typeof status === "string") statusUpdates.set(match[1], status);
    }
    // Paiements en attente d'envoi : ils comptent déjà dans la situation du dossier.
    const pendingByElement = new Map<string, Array<Record<string, unknown>>>();
    for (const operation of operations) {
      const body = asRecord(operation.body);
      if (operation.path !== "/paiements" || operation.method !== "POST" || typeof body?.elementDossierId !== "string") continue;
      const pending = pendingByElement.get(body.elementDossierId) ?? [];
      pending.push({ id: operation.temporaryId, montant: body.montant ?? 0, _offline: true });
      pendingByElement.set(body.elementDossierId, pending);
    }
    return elements.map((element) => {
      const item = asRecord(element);
      const requiredElement = asRecord(item?.elementRequis);
      const status = typeof requiredElement?.id === "string"
        ? statusUpdates.get(requiredElement.id)
        : undefined;
      const pending = typeof item?.id === "string" ? pendingByElement.get(item.id) : undefined;
      if (!status && !pending) return element;
      const known = Array.isArray(item?.paiements) ? item.paiements : [];
      const knownIds = new Set(known.map((payment) => asRecord(payment)?.id));
      return {
        ...item,
        ...(status ? { statut: status } : {}),
        ...(pending ? { paiements: [...known, ...pending.filter((payment) => !knownIds.has(payment.id))] } : {}),
      };
    }) as T;
  }
  if (resource === "/scolarite/seances" && Array.isArray(value)) {
    // Séances déclarées hors ligne (cahier de textes et appel) de la classe affichée.
    const classId = parsedUrl.searchParams.get("classeId");
    const operations = (await listOfflineOperations(window.sessionStorage.getItem("ipaim-token")))
      .filter((operation) => operation.path === "/scolarite/seances" && operation.method === "POST");
    if (!operations.length || !classId) return value;
    const cached = await listCachedResponses();
    const find = (suffix: string) => cached.find((entry) => entry.key.endsWith(suffix))?.value;
    const courses = (find(`/academique/cours?classeId=${classId}`) as unknown[] | undefined ?? []).map(asRecord);
    const students = ((asRecord(find(`/academique/classes/${classId}`))?.inscriptions ?? []) as unknown[]).map(asRecord);
    const knownIds = new Set(value.map((session) => asRecord(session)?.id));
    const pending = operations.flatMap((operation) => {
      const body = asRecord(operation.body);
      const course = courses.find((item) => item?.id === body?.coursId);
      if (!body || !course || knownIds.has(operation.temporaryId)) return [];
      return [{
        id: operation.temporaryId,
        date: body.date,
        heureDebut: body.heureDebut,
        dureeMinutes: Number(body.dureeMinutes ?? 0),
        contenu: body.contenu,
        saisieParNom: "En attente de synchronisation",
        enseignant: course.enseignant ?? null,
        cours: { id: course.id, matiere: course.matiere },
        absences: (Array.isArray(body.absents) ? body.absents : []).flatMap((absent) => {
          const inscriptionId = asRecord(absent)?.inscriptionId;
          const student = students.find((item) => item?.id === inscriptionId);
          return student ? [{ id: `${operation.temporaryId}:${String(inscriptionId)}`, justifiee: false, inscription: { personne: student.personne } }] : [];
        }),
        _offline: true,
      }];
    });
    return [...pending.reverse(), ...value] as T;
  }
  const gradeGrid = asRecord(value);
  if (/^\/notes\/cours\/[^/]+$/.test(resource) && Array.isArray(gradeGrid?.etudiants) && Array.isArray(gradeGrid.evaluations)) {
    // Notes saisies hors ligne : reportées dans la grille de la matière.
    const evaluationIds = new Set(gradeGrid.evaluations.map((evaluation) => String(asRecord(evaluation)?.id)));
    const pendingNotes = new Map<string, Record<string, unknown>>();
    for (const operation of await listOfflineOperations(window.sessionStorage.getItem("ipaim-token"))) {
      const match = operation.method === "PUT" ? operation.path.match(/^\/notes\/evaluations\/([^/]+)\/notes$/) : null;
      const notes = asRecord(operation.body)?.notes;
      if (!match || !evaluationIds.has(match[1]) || !Array.isArray(notes)) continue;
      for (const note of notes.map(asRecord))
        if (note?.inscriptionId) pendingNotes.set(`${match[1]}:${String(note.inscriptionId)}`, note);
    }
    if (!pendingNotes.size) return value;
    return {
      ...gradeGrid,
      etudiants: gradeGrid.etudiants.map((item) => {
        const student = asRecord(item);
        if (!student) return item;
        const notes = (Array.isArray(student.notes) ? student.notes : []).map(asRecord).filter((note): note is Record<string, unknown> => Boolean(note));
        for (const [key, note] of pendingNotes) {
          const [evaluationId, inscriptionId] = key.split(":");
          if (inscriptionId !== student.inscriptionId) continue;
          const merged = { evaluationId, valeur: note.absent || note.valeur === null || note.valeur === "" ? null : Number(note.valeur), absent: Boolean(note.absent) };
          const index = notes.findIndex((existing) => existing.evaluationId === evaluationId);
          if (index >= 0) notes[index] = { ...notes[index], ...merged };
          else notes.push(merged);
        }
        return { ...student, notes };
      }),
      _offline: true,
    } as T;
  }
  if (/^\/notes\/evaluations\/[^/]+\/copies$/.test(resource) && Array.isArray(gradeGrid?.copies)) {
    const pendingCopies = new Map<number, Record<string, unknown>>();
    for (const operation of await listOfflineOperations(window.sessionStorage.getItem("ipaim-token"))) {
      const notes = asRecord(operation.body)?.notes;
      if (operation.method !== "PUT" || operation.path !== resource || !Array.isArray(notes)) continue;
      for (const note of notes.map(asRecord)) if (note) pendingCopies.set(Number(note.numero), note);
    }
    if (!pendingCopies.size) return value;
    return {
      ...gradeGrid,
      copies: gradeGrid.copies.map((item) => {
        const copy = asRecord(item);
        const note = copy ? pendingCopies.get(Number(copy.numero)) : undefined;
        return note ? { ...copy, valeur: note.absent || note.valeur === null || note.valeur === "" ? null : Number(note.valeur), absent: Boolean(note.absent) } : item;
      }),
    } as T;
  }
  if (resource === "/depenses" && Array.isArray(gradeGrid?.data)) {
    // Brouillons de dépense préparés hors ligne : visibles en tête de la première page.
    const query = parsedUrl.searchParams;
    const status = query.get("statut");
    if ((query.get("page") ?? "1") !== "1" || query.get("q") || (status && status !== "BROUILLON")) return value;
    const allOperations = await listOfflineOperations(window.sessionStorage.getItem("ipaim-token"));
    const operations = allOperations.filter((operation) => operation.path === "/depenses" && operation.method === "POST");
    if (!operations.length) return value;
    const cached = await listCachedResponses();
    const reference = (suffix: string) => (cached.find((entry) => entry.key.endsWith(suffix))?.value as unknown[] | undefined ?? []).map(asRecord);
    const categories = reference("/finances/categories");
    const suppliers = reference("/finances/fournisseurs");
    const knownIds = new Set(gradeGrid.data.map((expense) => asRecord(expense)?.id));
    const drafts = operations.flatMap((operation) => {
      const body = asRecord(operation.body);
      if (!body || knownIds.has(operation.temporaryId)) return [];
      const amount = (Array.isArray(body.lignes) ? body.lignes : []).map(asRecord)
        .reduce((sum, line) => sum + (Number(line?.quantite) || 0) * (Number(line?.prixUnitaire) || 0), 0);
      return [{
        id: operation.temporaryId,
        numero: "En attente",
        objet: body.objet ?? "",
        justification: body.justification ?? "",
        statut: "BROUILLON",
        montant: amount.toFixed(2),
        niveauxRequis: 1,
        horsBudget: false,
        initiateurId: operation.userId,
        initiateurNom: "Vous (hors ligne)",
        dateCreation: new Date(operation.createdAt).toISOString(),
        categorieId: body.categorieId,
        categorie: categories.find((item) => item?.id === body.categorieId) ?? { id: body.categorieId, nom: "—", livraisonRequise: false, actif: true },
        fournisseurId: body.fournisseurId ?? null,
        fournisseur: suppliers.find((item) => item?.id === body.fournisseurId) ?? null,
        totalPaye: "0.00",
        resteAPayer: amount.toFixed(2),
        actions: { modifier: false, soumettre: false, reprendre: false, valider: false, blocageValidation: null, receptionner: false, facturer: false, payer: false, blocagePaiement: null, annuler: false },
        _offline: true,
        _pieces: allOperations.filter((candidate) => candidate.path === `/depenses/${operation.temporaryId}/pieces`).length,
        _soumission: allOperations.some((candidate) => candidate.path === `/depenses/${operation.temporaryId}/soumettre`),
      }];
    });
    const meta = asRecord(gradeGrid.meta);
    return { ...gradeGrid, data: [...drafts.reverse(), ...gradeGrid.data], meta: meta ? { ...meta, total: Number(meta.total ?? 0) + drafts.length } : gradeGrid.meta } as T;
  }
  if (resource === "/paiements" && Array.isArray(value)) {
    const token = window.sessionStorage.getItem("ipaim-token");
    const operations = await listOfflineOperations(token);
    const pendingPayments = operations.filter((operation) => operation.path === "/paiements" && operation.method === "POST");
    if (!pendingPayments.length) return value;
    const cached = (await listCachedResponses()).filter((entry) => entry.key.startsWith(`${scope(token)}:`));
    const cachedRows = cached
      .flatMap((entry) => Array.isArray(entry.value) ? entry.value : asRecord(entry.value)?.data ?? [])
      .map(asRecord)
      .filter((item): item is Record<string, unknown> => Boolean(item?.id));
    const cachedDetails = cached.map((entry) => asRecord(entry.value)).filter((item): item is Record<string, unknown> => Boolean(item?.id));
    const rowById = new Map([...cachedRows, ...cachedDetails].map((item) => [String(item.id), item]));
    // Les échéances sont rangées dans leur type de bourse.
    for (const row of cachedRows) {
      for (const instalment of Array.isArray(row.echeances) ? row.echeances.map(asRecord) : [])
        if (instalment?.id) rowById.set(String(instalment.id), instalment);
    }
    const assignments = new Map<string, string>();
    for (const operation of operations) {
      const match = operation.method === "PATCH" ? operation.path.match(/^\/paiements\/([^/]+)\/affectation$/) : null;
      const elementId = asRecord(operation.body)?.elementDossierId;
      if (match && typeof elementId === "string") assignments.set(match[1], elementId);
    }
    const elementName = (elementId: string) => {
      const element = rowById.get(elementId);
      const known = asRecord(element?.elementRequis)?.nom ?? element?.nom;
      if (typeof known === "string") return known;
      // Obligation d'un dossier créé hors ligne : `<dossier>:element:<référentiel>`.
      const catalogName = rowById.get(elementId.split(":element:")[1] ?? "")?.nom;
      return typeof catalogName === "string" ? catalogName : null;
    };
    const knownIds = new Set(value.map((payment) => asRecord(payment)?.id));
    const pending = pendingPayments.flatMap((operation) => {
      const body = asRecord(operation.body);
      if (!body || knownIds.has(operation.temporaryId)) return [];
      const isScholarship = Boolean(body.demandeBourseId);
      const dossierId = String(body.demandeBourseId ?? body.inscriptionId ?? "");
      const dossierOperation = operations.find((candidate) =>
        candidate.method === "POST" && candidate.temporaryId === dossierId &&
        (candidate.path === "/demandes-bourse" || candidate.path === "/inscriptions"));
      const dossierBody = asRecord(dossierOperation?.body);
      const dossier = rowById.get(dossierId);
      const nestedPerson = asRecord(dossierBody?.nouvellePersonne);
      const personOperation = typeof dossierBody?.personneId === "string"
        ? operations.find((candidate) => candidate.path === "/personnes" && candidate.method === "POST" && candidate.temporaryId === dossierBody.personneId)
        : undefined;
      const person = asRecord(dossier?.personne) ??
        (nestedPerson && dossierOperation
          ? localPerson(dossierOperation, nestedPerson, dossierOperation.temporaryRelatedId ?? `${dossierOperation.temporaryId}:person`)
          : personOperation
            ? localPerson(personOperation, asRecord(personOperation.body)!)
            : rowById.get(String(dossierBody?.personneId ?? "")));
      const track = isScholarship
        ? dossier?.filiereSouhaitee ?? dossierBody?.filiereSouhaitee
        : dossier?.filiere ?? dossierBody?.filiere;
      const elementId = typeof body.elementDossierId === "string" ? body.elementDossierId : assignments.get(operation.temporaryId);
      const instalment = typeof body.echeanceId === "string" ? rowById.get(body.echeanceId)?.libelle : undefined;
      return [{
        id: operation.temporaryId,
        montant: body.montant ?? 0,
        datePaiement: new Date(operation.createdAt).toISOString(),
        typePaiement: body.typePaiement ?? "FRAIS_DEPOT",
        modePaiement: body.modePaiement ?? "ESPECES",
        dossierId,
        dossierType: isScholarship ? "demande-bourse" : "inscription",
        dossier: `${isScholarship ? "Demande" : "Inscription"} · ${typeof track === "string" ? track : "-"}`,
        personne: person,
        obligation: elementId ? elementName(elementId) : null,
        echeance: typeof instalment === "string" ? instalment : null,
        affecte: Boolean(elementId || body.echeanceId),
        _offline: true,
      }];
    });
    const ascending = parsedUrl.searchParams.get("ordreDate") === "asc";
    return (ascending ? [...value, ...pending] : [...pending.reverse(), ...value]) as T;
  }
  if (parsedUrl.searchParams.get("page") && parsedUrl.searchParams.get("page") !== "1") {
    const page = asRecord(value);
    if (resource !== "/prospects" || !Array.isArray(page?.data)) return value;
    const token = window.sessionStorage.getItem("ipaim-token");
    const operations = await listOfflineOperations(token);
    return {
      ...page,
      data: applyPendingProspectRelances(page.data, operations),
    } as T;
  }
  const supported: Record<string, string> = {
    "/personnes": "/personnes",
    "/prospects": "/prospects",
    "/demandes-bourse": "/demandes-bourse",
    "/inscriptions": "/inscriptions",
    "/candidatures-personnel": "/candidatures-personnel",
  };
  const createPath = supported[resource];
  const page = asRecord(value);
  const data = page?.data;
  if (!createPath || !page || !Array.isArray(data)) return value;

  const token = window.sessionStorage.getItem("ipaim-token");
  const operations = await listOfflineOperations(token);
  const cachedPeople = (await listCachedResponses())
    .filter((entry) => entry.key.startsWith(`${scope(token)}:`))
    .flatMap((entry) => {
      const cachedPage = asRecord(entry.value);
      return Array.isArray(cachedPage?.data) ? cachedPage.data : [];
    })
    .map(asRecord)
    .filter((person): person is Record<string, unknown> => Boolean(person?.id));
  const cachedCatalog = (await listCachedResponses())
    .find((entry) => entry.key.startsWith(`${scope(token)}:`) && entry.key.endsWith("/elements-requis"));
  const catalog = Array.isArray(cachedCatalog?.value)
    ? cachedCatalog.value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item?.id))
    : [];
  const peopleById = new Map<string, Record<string, unknown>>();
  const localNewPeople: Record<string, unknown>[] = [];
  for (const operation of operations) {
    const body = asRecord(operation.body);
    if (
      operation.method === "POST" &&
      (operation.path === "/demandes-bourse" || operation.path === "/inscriptions") &&
      asRecord(body?.nouvellePersonne)
    ) {
      const personId = operation.temporaryRelatedId ?? `${operation.temporaryId}:person`;
      const person = localPerson(operation, asRecord(body?.nouvellePersonne)!, personId);
      peopleById.set(personId, person);
      localNewPeople.push(person);
    }
    if (operation.path !== "/personnes" && operation.path !== "/prospects") continue;
    if (!body) continue;
    if (operation.path === "/personnes") peopleById.set(operation.temporaryId, localPerson(operation, body));
    if (operation.path === "/prospects" && operation.temporaryRelatedId)
      peopleById.set(operation.temporaryRelatedId, localPerson(operation, body, operation.temporaryRelatedId));
  }

  const pending = operations.flatMap((operation) => {
    if (
      createPath === "/personnes" &&
      operation.method === "POST" &&
      (operation.path === "/demandes-bourse" || operation.path === "/inscriptions")
    ) {
      const body = asRecord(operation.body);
      const personBody = asRecord(body?.nouvellePersonne);
      return personBody
        ? [localPerson(
            operation,
            personBody,
            operation.temporaryRelatedId ?? `${operation.temporaryId}:person`,
          )]
        : [];
    }
    if (operation.path !== createPath || operation.method !== "POST") return [];
    const body = asRecord(operation.body);
    if (!body) return [];
    let item: Record<string, unknown>;
    if (createPath === "/personnes") {
      item = localPerson(operation, body);
    } else if (createPath === "/prospects") {
      item = {
        id: operation.temporaryId,
        statutRelance: body.statutRelance ?? "A_RELANCER",
        filiereSouhaitee: body.filiereSouhaitee,
        intention: body.intention,
        sourceConnaissance: body.sourceConnaissance,
        personne: localPerson(operation, body, operation.temporaryRelatedId ?? operation.temporaryId),
        _offline: true,
      };
    } else if (createPath === "/demandes-bourse" || createPath === "/inscriptions") {
      const person = peopleById.get(String(body.personneId)) ??
        cachedPeople.find((candidate) => candidate.id === body.personneId) ??
        (asRecord(body.nouvellePersonne)
          ? localPerson(
              operation,
              asRecord(body.nouvellePersonne)!,
              operation.temporaryRelatedId ?? `${operation.temporaryId}:person`,
            )
          : undefined);
      item = {
        ...body,
        id: operation.temporaryId,
        statut: createPath === "/demandes-bourse" ? "EN_ATTENTE" : "EN_COURS",
        ...(createPath === "/demandes-bourse" ? { dateDepot: new Date(operation.createdAt).toISOString() } : { dateInscription: new Date(operation.createdAt).toISOString() }),
        personne: person,
        _offline: true,
      };
      const isScholarship = createPath === "/demandes-bourse";
      const level = String(isScholarship ? body.niveauDemande : body.niveau ?? "").toUpperCase();
      const firstYear = level.includes("PREMIERE") || level.includes("1");
      const dossierElements = catalog.filter((catalogItem) => {
        const context = catalogItem.contexte;
        const applicableLevel = catalogItem.niveauApplicable;
        return (isScholarship ? context === "BOURSE" || context === "TOUS" : context === "INSCRIPTION_DIRECTE" || context === "TOUS") &&
          (firstYear ? applicableLevel === "PREMIERE_ANNEE" || applicableLevel === "TOUS" : applicableLevel === "DEUXIEME_ANNEE" || applicableLevel === "DEUXIEME_ANNEE_PLUS" || applicableLevel === "TOUS");
      });
      const statusOperations = operations.filter((candidate) => candidate.method === "PATCH" && candidate.path.startsWith(`/${createPath.slice(1)}/${operation.temporaryId}/elements/`));
      const preparation = asRecord(body.preparation);
      const preparedStatuses = asRecord(preparation?.statuses) ?? {};
      const preparationAmount = Number(String(preparation?.montant ?? "").trim().replace(",", ".") || 0);
      const preparationElementId = String(preparation?.elementId ?? "");
      const payments = operations.filter((candidate) => {
        if (candidate.path !== "/paiements" || candidate.method !== "POST") return false;
        const paymentBody = asRecord(candidate.body);
        return paymentBody?.demandeBourseId === operation.temporaryId || paymentBody?.inscriptionId === operation.temporaryId;
      });
      const statusFor = (catalogId: string) => {
        const update = statusOperations.find((candidate) => candidate.path.endsWith(`/elements/${catalogId}`));
        return String(asRecord(update?.body)?.statut ?? preparedStatuses[catalogId] ?? "ATTENDU");
      };
      const obligationsImpayees = dossierElements.flatMap((catalogItem) => {
        if (catalogItem.montantAttendu === null || catalogItem.montantAttendu === undefined) return [];
        const elementId = `${operation.temporaryId}:element:${catalogItem.id}`;
        const existingPayments = payments.filter((candidate) => asRecord(candidate.body)?.elementDossierId === elementId).reduce((sum, candidate) => sum + Number(asRecord(candidate.body)?.montant ?? 0), 0);
        const initialPayment = preparationElementId === String(catalogItem.id) ? preparationAmount : 0;
        const paid = existingPayments + initialPayment;
        const reste = Number(catalogItem.montantAttendu) - paid;
        return reste > 0 ? [{ nom: String(catalogItem.nom), reste: reste.toFixed(2) }] : [];
      });
      const elementsManquants = dossierElements.filter((catalogItem) => !["FOURNI", "SUBSTITUE"].includes(statusFor(String(catalogItem.id)))).map((catalogItem) => String(catalogItem.nom));
      item = { ...item, elementsManquants, obligationsImpayees, dossierComplet: elementsManquants.length === 0 && obligationsImpayees.length === 0, paiementEnAttenteSync: payments.length > 0 || preparationAmount > 0 };
    } else {
      item = {
        ...body,
        id: operation.temporaryId,
        statut: "DEPOSE",
        dateDepot: new Date(operation.createdAt).toISOString(),
        elementsDossier: (Array.isArray(body.elements) ? body.elements : []).map((nom) => ({ nom, statut: "ATTENDU" })),
        _offline: true,
      };
    }
    return [item];
  });

  const search = parsedUrl.searchParams.get("q")?.trim().toLocaleLowerCase();
  const filtered = pending.filter((item) => {
    if (!search) return true;
    const person = asRecord(item.personne);
    const searchable = [item.nom, item.prenom, item.filiere, item.filiereSouhaitee, person?.nom, person?.prenom]
      .filter((part): part is string => typeof part === "string").join(" ").toLocaleLowerCase();
    return searchable.includes(search);
  });
  const knownIds = new Set(data.map((item) => asRecord(item)?.id));
  const mergedPending = filtered.filter((item) => !knownIds.has(item.id));
  let merged = [...mergedPending, ...data];
  for (const operation of operations) {
    if (operation.method !== "PATCH") continue;
    const [, collection, id] = operation.path.match(/^\/(personnes|prospects|demandes-bourse|inscriptions|candidatures-personnel)\/([^/]+)$/) ?? [];
    if (!collection || !id) continue;
    const targetCollection = `/${collection}`;
    if (targetCollection !== resource) continue;
    const update = asRecord(operation.body);
    if (!update) continue;
    merged = merged.map((item) => asRecord(item)?.id === id
      ? { ...(asRecord(item) ?? {}), ...update, _offline: true }
      : item);
  }
  if (resource === "/prospects") {
    merged = applyPendingProspectRelances(merged, operations).map(asRecord) as Record<string, unknown>[];
  }
  return {
    ...page,
    data: merged,
    meta: page.meta && typeof page.meta === "object"
      ? { ...(page.meta as Record<string, unknown>), total: Number((page.meta as Record<string, unknown>).total ?? data.length) + mergedPending.length }
      : page.meta,
  } as T;
}

export function currentOfflineSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem("ipaim-offline-session") ?? "null") as OfflineAccount | null;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derivePasswordVerifier(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = salt.slice().buffer as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations }, material, 256);
  return new Uint8Array(bits);
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function enrollOfflineAccount(email: string, password: string, userId: string, user: import("./types").User) {
  const normalizedEmail = email.trim().toLocaleLowerCase();
  const iterations = 600_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const previous = await store<StoredOfflineAccount | undefined>("offlineAccounts", "readonly", (objectStore) => objectStore.get(normalizedEmail));
  // Le sel de la clé de données est conservé d'une connexion à l'autre : la copie
  // locale reste lisible tant que le mot de passe ne change pas.
  const dataSalt = previous?.userId === userId && previous.dataSalt ? fromBase64(previous.dataSalt) : crypto.getRandomValues(new Uint8Array(16));
  const [verifier, dataKey] = await Promise.all([
    derivePasswordVerifier(password, salt, iterations),
    deriveDataKey(password, dataSalt, iterations),
  ]);
  const dataKeyCheck = await dataKeyFingerprint(dataKey);
  // Mot de passe changé : l'ancienne copie est illisible, on l'efface pour la retélécharger.
  if (previous?.userId === userId && previous.dataKeyCheck && previous.dataKeyCheck !== dataKeyCheck) {
    await store("responses", "readwrite", (objectStore) => objectStore.delete(IDBKeyRange.bound(`${userId}:`, `${userId}:\uffff`)));
    mirror = null;
  }
  const account: StoredOfflineAccount = {
    userId,
    email: normalizedEmail,
    user,
    salt: toBase64(salt),
    verifier: toBase64(verifier),
    iterations,
    lastOnlineAt: Date.now(),
    dataSalt: toBase64(dataSalt),
    dataKeyCheck,
  };
  await store("offlineAccounts", "readwrite", (objectStore) => objectStore.put(account));
  rememberDataKey(dataKey);
}

/** Le serveur a refusé ces identifiants : l'accès local correspondant est retiré. */
export async function forgetOfflineAccount(email: string) {
  await store("offlineAccounts", "readwrite", (objectStore) => objectStore.delete(email.trim().toLocaleLowerCase()));
}

/** Renvoie le compte, `null` si les identifiants ne correspondent pas, ou "expired" s'il faut repasser en ligne. */
export async function unlockOfflineAccount(email: string, password: string): Promise<OfflineAccount | "expired" | null> {
  const account = await store<StoredOfflineAccount | undefined>(
    "offlineAccounts",
    "readonly",
    (objectStore) => objectStore.get(email.trim().toLocaleLowerCase()),
  );
  if (!account) return null;
  const attemptedVerifier = await derivePasswordVerifier(password, fromBase64(account.salt), account.iterations);
  if (!sameBytes(attemptedVerifier, fromBase64(account.verifier))) return null;
  // Compte enregistré avant l'ajout de cette date : le délai court à partir de maintenant.
  if (account.lastOnlineAt === undefined)
    await store("offlineAccounts", "readwrite", (objectStore) => objectStore.put({ ...account, lastOnlineAt: Date.now() }));
  else if (Date.now() - account.lastOnlineAt > OFFLINE_ACCOUNT_VALIDITY_MS) return "expired";
  if (account.dataSalt) rememberDataKey(await deriveDataKey(password, fromBase64(account.dataSalt), account.iterations));
  return { userId: account.userId, email: account.email, user: account.user };
}