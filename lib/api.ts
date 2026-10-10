import {
  API_URL,
  cacheResponse,
  currentOfflineSession,
  enqueueOperation,
  listOfflineOperations,
  mergeOfflineRecords,
  OfflineMethod,
  readCachedProspectRelances,
  readCachedResponse,
  responseCacheKey,
  toQueuedBody,
} from "./offline";

import { toast } from "../components/feedback";
import { hasAccess } from "./access";
import { checkServer, isOffline, reportServerReachable } from "./connectivity";

/** Refus du serveur, avec son code HTTP. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const GET_TIMEOUT_MS = 5000;
const PREFETCH_INTERVAL_MS = 5 * 60 * 1000;
// Un téléchargement complet par jour ; entre deux, seuls les dossiers modifiés sont relus.
const FULL_PREFETCH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ACADEMIC_PREFETCH_INTERVAL_MS = 30 * 60 * 1000;
const PREFETCH_KEY = "ipaim-donnees-locales";
const SERVER_UNREACHABLE = "Le serveur est injoignable. Cette action nécessite une connexion.";
const OFFLINE_SAVED = "Enregistré sur cet appareil. L’envoi se fera au retour de la connexion.";
const SUCCESS_MESSAGES: Record<string, string> = {
  POST: "Enregistrement effectué.",
  PATCH: "Modification enregistrée.",
  DELETE: "Suppression effectuée.",
};
const offlineCreatablePaths = new Set([
  "/personnes",
  "/demandes-bourse",
  "/inscriptions",
  "/prospects",
  "/paiements",
  "/candidatures-personnel",
  // Séance tenue avec son appel, et brouillon de demande de dépense.
  "/scolarite/seances",
  "/depenses",
]);
// Notes d'une évaluation : l'envoi remplace les notes transmises, il peut donc attendre.
// Pièce jointe ou soumission d'une dépense, photo d'identité : elles attendent avec leur dossier.
const offlineAttachmentPath = /^\/(?:depenses\/[^/]+\/(?:pieces|soumettre)|personnes\/[^/]+\/photo)$/;
const offlineExpenseEditPath = /^\/depenses\/[^/]+$/;
const offlineGradesPath = /^\/notes\/evaluations\/[^/]+\/(?:notes|copies)$/;
const offlineEditablePath = /^\/(?:(?:personnes|demandes-bourse|inscriptions|prospects|candidatures-personnel)\/[^/]+|(?:demandes-bourse|inscriptions)\/[^/]+\/elements\/[^/]+|paiements\/[^/]+\/affectation)$/;
const offlineProspectRelancePath = /^\/prospects\/[^/]+\/relances$/;
const referenceWritePath = /^\/(elements-requis|types-bourse)(?:\/.*)?$/;

function supportsOfflineWrite(method: string, path: string) {
  return (
    (method === "POST" && (offlineCreatablePaths.has(path) || offlineProspectRelancePath.test(path) || offlineAttachmentPath.test(path))) ||
    (method === "PATCH" && (offlineEditablePath.test(path) || offlineExpenseEditPath.test(path))) ||
    (method === "PUT" && offlineGradesPath.test(path))
  );
}

function emptyOfflineResponse(path: string) {
  if (
    path === "/paiements/non-affectes" ||
    /^\/(demandes-bourse|inscriptions)\/[^/]+\/elements$/.test(path)
  ) return [];
  return { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } };
}

function hasOfflineRecords(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Array.isArray((value as { data?: unknown[] } | null)?.data) &&
    (value as { data: unknown[] }).data.length > 0;
}

async function getOfflineFinance(path: string, token: string | null) {
  const match = path.match(/^\/(demandes-bourse|inscriptions)\/([^/]+)\/finance$/);
  if (!match) return undefined;
  const [, collection, dossierId] = match;
  const elementsPath = `/${collection}/${dossierId}/elements`;
  let elements = await readCachedResponse<import("./types").RequiredElement[]>(
    responseCacheKey(`${API_URL}${elementsPath}`, token),
  );
  if (elements === undefined)
    elements = await mergeOfflineRecords(elementsPath, [] as import("./types").RequiredElement[]);
  if (!Array.isArray(elements)) return undefined;
  const operations = await listOfflineOperations(token);
  const pendingPayments = operations.flatMap((operation) => {
    if (operation.path !== "/paiements" || operation.method !== "POST") return [];
    const body = typeof operation.body === "object" && operation.body !== null ? operation.body as Record<string, unknown> : null;
    if (!body || body[collection === "demandes-bourse" ? "demandeBourseId" : "inscriptionId"] !== dossierId) return [];
    // Comme côté serveur, les échéances de bourse ne font pas partie des obligations du dossier.
    if (body.echeanceId) return [];
    return [{ montant: Number(body.montant ?? 0), elementDossierId: String(body.elementDossierId ?? "") }];
  });
  const obligations = elements.map((element) => {
    const montantAttendu = Number(element.montantAttendu ?? 0);
    const montantPaye = (element.paiements ?? [])
      .filter((paiement) => !(paiement as { _offline?: boolean })._offline)
      .reduce((total, paiement) => total + Number(paiement.montant), 0) +
      pendingPayments.filter((payment) => payment.elementDossierId === element.id).reduce((total, payment) => total + payment.montant, 0);
    return {
      id: element.id,
      nom: element.elementRequis.nom,
      categorie: (element.elementRequis as { categorie?: string }).categorie ?? element.categorie ?? "DOCUMENT",
      statut: element.statut,
      montantAttendu: montantAttendu.toFixed(2),
      montantPaye: montantPaye.toFixed(2),
      resteAPayer: Math.max(0, montantAttendu - montantPaye).toFixed(2),
    };
  });
  const montantPayeNonAffecte = pendingPayments.filter((payment) => !payment.elementDossierId).reduce((total, payment) => total + payment.montant, 0);
  return {
    demandeId: dossierId,
    obligations,
    montantPayeNonAffecte: montantPayeNonAffecte.toFixed(2),
    totalAttendu: obligations.reduce((total, obligation) => total + Number(obligation.montantAttendu), 0).toFixed(2),
    totalPaye: (obligations.reduce((total, obligation) => total + Number(obligation.montantPaye), 0) + montantPayeNonAffecte).toFixed(2),
  };
}

type Row = Record<string, unknown>;
const offlineCollections: Record<string, string> = {
  "/personnes": "dateEnregistrement",
  "/prospects": "",
  "/demandes-bourse": "dateDepot",
  "/inscriptions": "dateInscription",
  "/candidatures-personnel": "dateDepot",
};

// Toutes les lignes d'une liste téléchargées pour le travail hors ligne (pages de 100).
async function readCachedCollection(resource: string, token: string | null) {
  const pageKey = (page: number) => responseCacheKey(`${API_URL}${resource}?page=${page}&limit=100`, token);
  const firstPage = await readCachedResponse<{ data: Row[]; meta?: { totalPages?: number } }>(pageKey(1));
  if (!firstPage || !Array.isArray(firstPage.data)) return undefined;
  const rows = [...firstPage.data];
  for (let page = 2; page <= (firstPage.meta?.totalPages ?? 1); page += 1) {
    const cachedPage = await readCachedResponse<{ data: Row[] }>(pageKey(page));
    if (Array.isArray(cachedPage?.data)) rows.push(...cachedPage.data);
  }
  return rows;
}

function matchesSearch(item: Row, search: string) {
  const person = (item.personne ?? {}) as Row;
  const words = [
    item.nom, item.prenom, item.telephone, item.matricule, item.quartier,
    person.nom, person.prenom, person.telephone, person.matricule,
    item.filiere, item.filiereSouhaitee, item.niveau, item.anneeScolaire, item.fonction, item.diplome,
  ].filter((value): value is string => typeof value === "string").join(" ").toLocaleLowerCase();
  return search.split(/\s+/).every((word) => words.includes(word));
}

// Recherche, filtres et pagination d'une liste, refaits sur l'appareil quand le serveur est absent.
async function getOfflineCollection(path: string, token: string | null) {
  const [resource, rawQuery = ""] = path.split("?", 2);
  if (!(resource in offlineCollections)) return undefined;
  const rows = await readCachedCollection(resource, token);
  if (!rows) return undefined;
  const query = new URLSearchParams(rawQuery);
  const search = query.get("q")?.trim().toLocaleLowerCase();
  const status = query.get("statut");
  const followUp = query.get("statutRelance");
  const typeBourseId = query.get("typeBourseId");
  const filtered = rows.filter((item) => {
    if (status && item.statut !== status) return false;
    if (followUp && item.statutRelance !== followUp) return false;
    if (typeBourseId) {
      const scholarship = (item.typeBourse ?? item.demandeBourse ?? {}) as Row;
      if ((item.typeBourseId ?? scholarship.id ?? scholarship.typeBourseId) !== typeBourseId && scholarship.typeBourseId !== typeBourseId) return false;
    }
    return !search || matchesSearch(item, search);
  });
  const dateField = offlineCollections[resource];
  const ascending = query.get("ordreDate") === "asc";
  if (dateField)
    filtered.sort((left, right) => (ascending ? 1 : -1) * String(left[dateField] ?? "").localeCompare(String(right[dateField] ?? "")));
  else if (ascending) filtered.reverse();
  const page = Math.max(1, Number(query.get("page")) || 1);
  const limit = Math.max(1, Number(query.get("limit")) || 20);
  return {
    data: filtered.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) },
  };
}

// Journal des paiements : la copie locale sert quel que soit l'ordre demandé.
async function getOfflinePayments(path: string, token: string | null) {
  if (path !== "/paiements" && !path.startsWith("/paiements?")) return undefined;
  const ascending = new URLSearchParams(path.split("?", 2)[1] ?? "").get("ordreDate") === "asc";
  for (const candidate of ["/paiements", "/paiements?ordreDate=desc", "/paiements?ordreDate=asc"]) {
    const cached = await readCachedResponse<Row[]>(responseCacheKey(`${API_URL}${candidate}`, token));
    if (!Array.isArray(cached)) continue;
    return [...cached].sort((left, right) => (ascending ? 1 : -1) * String(left.datePaiement ?? "").localeCompare(String(right.datePaiement ?? "")));
  }
  return [];
}

async function getCachedGet<T>(path: string, token: string | null) {
  const offlineFinance = await getOfflineFinance(path, token);
  if (offlineFinance !== undefined) return offlineFinance as T;
  if (path.startsWith("/elements-requis?")) {
    const cachedFiltered = await readCachedResponse<T>(responseCacheKey(`${API_URL}${path}`, token));
    if (Array.isArray(cachedFiltered) && cachedFiltered.length > 0)
      return mergeOfflineRecords(path, cachedFiltered);
    const base = await readCachedResponse<import("./types").CatalogElement[]>(
      responseCacheKey(`${API_URL}/elements-requis`, token),
    );
    if (base !== undefined) {
      const query = new URLSearchParams(path.split("?", 2)[1]);
      const contexte = query.get("contexte");
      const niveau = query.get("niveauApplicable");
      return base.filter((element) =>
        (!contexte || element.contexte === contexte || element.contexte === "TOUS") &&
        (!niveau || element.niveauApplicable === niveau || element.niveauApplicable === "TOUS" ||
          (niveau === "DEUXIEME_ANNEE" && element.niveauApplicable === "DEUXIEME_ANNEE_PLUS")),
      ) as T;
    }
  }
  const cached = await readCachedResponse<T>(responseCacheKey(`${API_URL}${path}`, token));
  if (cached !== undefined) return mergeOfflineRecords(path, cached);
  if (path.startsWith("/academique/classes?anneeId=")) {
    const current = await readCachedResponse<{ annee?: { id?: string } | null }>(responseCacheKey(`${API_URL}/academique/classes`, token));
    if (current?.annee?.id === path.split("=")[1]) return current as T;
  }
  const collection = await getOfflineCollection(path, token);
  if (collection !== undefined) return mergeOfflineRecords(path, collection as T);
  const payments = await getOfflinePayments(path, token);
  if (payments !== undefined) return mergeOfflineRecords(path, payments as T);
  const prospectRelanceMatch = path.match(/^\/prospects\/([^/]+)\/relances$/);
  if (prospectRelanceMatch) {
    const cachedRelances = await readCachedProspectRelances(
      prospectRelanceMatch[1],
      token,
    );
    if (cachedRelances !== undefined)
      return mergeOfflineRecords(path, cachedRelances as T);
  }
  const localPage = await mergeOfflineRecords(path, emptyOfflineResponse(path) as T);
  if (
    path === "/paiements/non-affectes" ||
    /^\/(demandes-bourse|inscriptions)\/[^/]+\/elements$/.test(path) ||
    hasOfflineRecords(localPage)
  ) return localPage;
  return undefined;
}

type RequestOptions<T> = RequestInit & {
  token?: string | null;
  bypassOffline?: boolean;
  /** N'affiche pas la notification de succès (l'appelant donne son propre retour). */
  silent?: boolean;
  /** Lecture ponctuelle (recherche) : ne pas la conserver pour le mode hors ligne. */
  skipCache?: boolean;
  onCached?: (value: T) => void;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  // `token: null` demande explicitement une requête sans session.
  const token =
    options.token !== undefined
      ? options.token
      : typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem("ipaim-token");
  const offlineSession = currentOfflineSession();
  const headers = new Headers(options.headers);
  // Un envoi de fichier (FormData) fixe lui-même son en-tête multipart.
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const method = (options.method ?? "GET").toUpperCase();
  // La connexion elle-même doit toujours tenter le serveur.
  const offline = isOffline() && !options.bypassOffline;
  if (
    (method === "POST" || method === "PATCH" || method === "DELETE") &&
    referenceWritePath.test(path) &&
    (offline || Boolean(offlineSession))
  )
    throw new Error("Les référentiels ne peuvent être modifiés que lorsque vous êtes connecté.");
  const idempotencyKey = method === "POST" && token ? crypto.randomUUID() : null;
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  // Identifiant donné sur l'appareil : le même avant et après l'envoi (référence du reçu).
  const localId = method === "POST" && token && supportsOfflineWrite(method, path) ? crypto.randomUUID() : undefined;
  if (localId) headers.set("X-Identifiant-Local", localId);

  if (offline) {
    if (method === "GET") {
      const cached = await getCachedGet<T>(path, token);
      if (cached !== undefined) return cached;
      throw new Error("Vous êtes hors ligne et cette donnée n’est pas disponible sur cet appareil.");
    }
    if (supportsOfflineWrite(method, path)) {
      return queuedResult<T>(await enqueueOperation(path, method as OfflineMethod, toQueuedBody(options.body), idempotencyKey ?? crypto.randomUUID(), token, localId));
    }
    throw new Error("Cette action nécessite une connexion en ligne.");
  }

  if (offlineSession && !token && !options.bypassOffline) {
    if (method === "GET") {
      const cached = await getCachedGet<T>(path, null);
      if (cached !== undefined) return cached;
      throw new Error("Cette donnée n’a pas encore été téléchargée sur cet appareil.");
    }
    if (supportsOfflineWrite(method, path)) {
      return queuedResult<T>(await enqueueOperation(path, method as OfflineMethod, toQueuedBody(options.body), crypto.randomUUID(), null));
    }
    throw new Error("Cette action nécessite une connexion en ligne.");
  }

  if (method === "GET" && options.onCached && typeof window !== "undefined") {
    const cached = await readCachedResponse<T>(responseCacheKey(`${API_URL}${path}`, token));
    if (cached !== undefined)
      options.onCached(await mergeOfflineRecords(path, cached));
  }

  let response: Response;
  try {
    const fetchOptions: RequestInit = { ...options };
    delete (fetchOptions as RequestInit & { token?: string | null }).token;
    delete (fetchOptions as RequestInit & { bypassOffline?: boolean }).bypassOffline;
    delete (fetchOptions as RequestInit & { silent?: boolean }).silent;
    delete (fetchOptions as RequestInit & { skipCache?: boolean }).skipCache;
    delete (fetchOptions as RequestInit & { onCached?: (value: T) => void }).onCached;
    if (method === "GET") {
      const timeoutSignal = AbortSignal.timeout(GET_TIMEOUT_MS);
      fetchOptions.signal = fetchOptions.signal
        ? AbortSignal.any([fetchOptions.signal, timeoutSignal])
        : timeoutSignal;
    }
    response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
  } catch (failure) {
    // Requête annulée par l'écran lui-même : ce n'est pas une panne.
    if (wasAborted(options.signal)) throw failure;
    // Panne possible du serveur : la sonde confirme et bascule l'application en mode local.
    void checkServer();
    if (method === "GET") {
      const cached = await getCachedGet<T>(path, token);
      if (cached !== undefined) return cached;
    }
    if (token && supportsOfflineWrite(method, path)) {
      return queuedResult<T>(await enqueueOperation(path, method as OfflineMethod, toQueuedBody(options.body), idempotencyKey ?? crypto.randomUUID(), token, localId));
    }
    if (failure instanceof TypeError && !options.bypassOffline) throw new Error(SERVER_UNREACHABLE);
    throw failure;
  }
  reportServerReachable();
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined")
      window.dispatchEvent(new Event("ipaim-session-expired"));
    // Session refusée : une fenêtre dédiée l'explique, le message technique du serveur n'apporte rien.
    if (response.status === 401 && token)
      throw new Error("Votre session a expiré. Reconnectez-vous pour continuer.");
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    throw new ApiError(message || "Une erreur est survenue avec le serveur.", response.status);
  }
  if (method === "GET" && options.skipCache) return payload as T;
  if (method === "GET") {
    await cacheResponse(responseCacheKey(`${API_URL}${path}`, token), payload).catch(() => {});
    return mergeOfflineRecords(path, payload as T);
  }
  if (!options.bypassOffline && !options.silent) toast(SUCCESS_MESSAGES[method] ?? "Opération effectuée.");
  return payload as T;
}

let lastOfflineNotice = 0;

// Réponse rendue à l'écran pour une saisie mise en file. L'identifiant provisoire de la
// personne permet d'y rattacher aussitôt une photo, elle aussi mise en file.
function queuedResult<T>(queued: import("./offline").OfflineOperation) {
  // Un dossier et ses pièces partent en file d'un seul geste : un seul message.
  if (Date.now() - lastOfflineNotice > 3000) toast(OFFLINE_SAVED, "info");
  lastOfflineNotice = Date.now();
  const person = queued.temporaryRelatedId ?? (queued.body as { personneId?: unknown } | undefined)?.personneId;
  return { id: queued.temporaryId, ...(typeof person === "string" ? { personneId: person } : {}), _offline: true } as T;
}

function wasAborted(signal: AbortSignal | null | undefined) {
  return Boolean(signal?.aborted);
}

function prefetchKey() {
  try {
    return `${PREFETCH_KEY}:${(JSON.parse(window.sessionStorage.getItem("ipaim-user") ?? "null") as { id?: string } | null)?.id ?? ""}`;
  } catch {
    return PREFETCH_KEY;
  }
}

/** Date du dernier téléchargement complet des données de consultation, pour l'utilisateur courant. */
export function lastOfflineDownload(): number | null {
  if (typeof window === "undefined") return null;
  try {
    return Number(window.localStorage.getItem(prefetchKey())) || null;
  } catch {
    return null;
  }
}

let prefetching: Promise<void> | null = null;

/**
 * Télécharge les données utiles sans connexion. Sans `force`, pas plus d'une fois toutes
 * les cinq minutes ; avec "complet", tout est relu, pas seulement ce qui a changé.
 */
export function downloadOfflineReferenceData(force: boolean | "complet" = false) {
  if (typeof navigator === "undefined" || isOffline() || currentOfflineSession()) return Promise.resolve();
  if (!window.sessionStorage.getItem("ipaim-token")) return Promise.resolve();
  if (!force && Date.now() - (lastOfflineDownload() ?? 0) < PREFETCH_INTERVAL_MS) return Promise.resolve();
  prefetching ??= prefetchOfflineData(force).finally(() => { prefetching = null; });
  return prefetching;
}

/** Oublie l'état du dernier téléchargement : le prochain sera complet. */
export function resetOfflineDownload() {
  try {
    for (const suffix of ["", ":serveur", ":complet", ":academique"]) window.localStorage.removeItem(`${prefetchKey()}${suffix}`);
  } catch {}
}

async function inBatches(paths: string[]) {
  for (let index = 0; index < paths.length; index += 20) {
    if (isOffline()) return false;
    await Promise.allSettled(paths.slice(index, index + 20).map((path) => apiFetch<unknown>(path)));
  }
  return true;
}

async function prefetchOfflineData(force: boolean | "complet") {
  let user: import("./types").User | null = null;
  try {
    user = JSON.parse(window.sessionStorage.getItem("ipaim-user") ?? "null") as import("./types").User | null;
  } catch {}
  const token = window.sessionStorage.getItem("ipaim-token");
  // On ne demande que ce que l'utilisateur a le droit de consulter.
  const can = (area: import("./access").AccessArea) => hasAccess(user, area);
  const none = Promise.resolve<string[]>([]);
  const remembered = (suffix: string) => {
    try { return window.localStorage.getItem(`${prefetchKey()}${suffix}`); } catch { return null; }
  };
  const remember = (suffix: string, value: string) => {
    try { window.localStorage.setItem(`${prefetchKey()}${suffix}`, value); } catch {}
  };
  type DossierPage = {
    data: Array<{ id: string }>;
    meta: { totalPages: number };
  };
  const loadDossierIds = async (resource: string, filters = "") => {
    const ids: string[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await apiFetch<DossierPage>(
        `/${resource}?${filters ? `${filters}&` : ""}page=${page}&limit=100`,
      );
      ids.push(...result.data.map((dossier) => dossier.id));
      totalPages = result.meta.totalPages;
      page += 1;
    } while (page <= totalPages);
    return ids;
  };

  // Ce qui a changé sur le serveur depuis le dernier passage. L'heure est relevée
  // avant de lire les listes : rien de ce qui change pendant le téléchargement n'est manqué.
  type Changes = { horodatage: string; complet: boolean; demandesBourse?: string[]; inscriptions?: string[]; prospects?: string[] };
  const fullDue = force === "complet" || Date.now() - Number(remembered(":complet") ?? 0) > FULL_PREFETCH_INTERVAL_MS;
  const since = fullDue ? "" : remembered(":serveur") ?? "";
  const changes = await apiFetch<Changes>(`/synchronisation/changements?depuis=${encodeURIComponent(since)}`, { skipCache: true }).catch(() => null);

  const [, , applications, enrollments, prospects] = await Promise.allSettled([
    apiFetch<unknown[]>("/elements-requis"),
    apiFetch<unknown[]>("/types-bourse"),
    can("scholarships") || can("payments") || can("certificates") ? loadDossierIds("demandes-bourse") : none,
    can("enrollments") || can("payments") || can("certificates") ? loadDossierIds("inscriptions") : none,
    can("prospects") ? loadDossierIds("prospects") : none,
    can("people") ? loadDossierIds("personnes") : none,
    can("recruiting") ? loadDossierIds("candidatures-personnel") : none,
    can("payments") ? apiFetch<unknown>("/paiements") : none,
    // Référentiels du formulaire de dépense, pour préparer un brouillon sans connexion.
    can("expenses") ? apiFetch<unknown>("/finances/categories") : none,
    can("expenses") ? apiFetch<unknown>("/finances/fournisseurs") : none,
    // Première page de « Mes demandes » : l'écran des dépenses s'ouvre aussi sans connexion.
    can("expenses") ? apiFetch<unknown>("/depenses?vue=mes&page=1&limit=20") : none,
    can("expenses") ? apiFetch<unknown>("/depenses/compteurs") : none,
  ]);
  await import("jspdf").catch(() => undefined);
  let applicationIds = applications.status === "fulfilled" ? applications.value : [];
  let enrollmentIds = enrollments.status === "fulfilled" ? enrollments.value : [];
  let prospectIds = prospects.status === "fulfilled" ? prospects.value : [];

  // Téléchargement partiel seulement si la copie locale existe bien (elle a pu être effacée).
  const sample = applicationIds[0] ? `/demandes-bourse/${applicationIds[0]}/elements` : enrollmentIds[0] ? `/inscriptions/${enrollmentIds[0]}/elements` : null;
  const hasLocalCopy = !sample || (await readCachedResponse(responseCacheKey(`${API_URL}${sample}`, token)).catch(() => undefined)) !== undefined;
  const incremental = Boolean(changes && !changes.complet && hasLocalCopy);
  if (incremental && changes) {
    const changed = (ids: string[], modified: string[] | undefined) => ids.filter((id) => modified?.includes(id));
    applicationIds = changed(applicationIds, changes.demandesBourse);
    enrollmentIds = changed(enrollmentIds, changes.inscriptions);
    prospectIds = changed(prospectIds, changes.prospects);
  }
  const completed = await inBatches([
    ...applicationIds.map((id) => `/demandes-bourse/${id}`),
    // La situation financière se recalcule sur l'appareil à partir des éléments du dossier.
    ...applicationIds.map((id) => `/demandes-bourse/${id}/elements`),
    ...enrollmentIds.map((id) => `/inscriptions/${id}`),
    ...enrollmentIds.map((id) => `/inscriptions/${id}/elements`),
    ...prospectIds.map((id) => `/prospects/${id}/relances`),
  ]);
  if (!completed) return;
  if (changes) {
    // Marge de sécurité : on redemandera les deux dernières minutes au prochain passage.
    remember(":serveur", new Date(new Date(changes.horodatage).getTime() - 2 * 60 * 1000).toISOString());
    if (!incremental) remember(":complet", String(Date.now()));
  }

  // Académique : de quoi faire l'appel et saisir des notes sans connexion.
  const academicDue = Boolean(force) || Date.now() - Number(remembered(":academique") ?? 0) > ACADEMIC_PREFETCH_INTERVAL_MS;
  if (academicDue && (can("teaching") || can("grades"))) {
    type ClassList = { annee: { id: string } | null; classes: Array<{ id: string }> };
    type GradeGrid = { evaluations: Array<{ id: string; anonyme: boolean; statut: string }> };
    const [, classList] = await Promise.allSettled([apiFetch<unknown>("/academique/annees"), apiFetch<ClassList>("/academique/classes")]);
    const classIds = classList.status === "fulfilled" ? classList.value.classes.map((item) => item.id) : [];
    const courseLists = await Promise.allSettled(classIds.map((id) => apiFetch<Array<{ id: string }>>(`/academique/cours?classeId=${id}`)));
    const courseIds = courseLists.flatMap((result) => result.status === "fulfilled" ? result.value.map((course) => course.id) : []);
    const academicDone = await inBatches([
      ...classIds.map((id) => `/academique/classes/${id}`),
      ...(can("teaching") ? classIds.flatMap((id) => [`/scolarite/seances?classeId=${id}`, `/academique/emploi-du-temps?classeId=${id}`]) : []),
    ]);
    if (!academicDone) return;
    if (can("grades")) {
      for (let index = 0; index < courseIds.length; index += 20) {
        if (isOffline()) return;
        const grids = await Promise.allSettled(courseIds.slice(index, index + 20).map((id) => apiFetch<GradeGrid>(`/notes/cours/${id}`)));
        // Évaluations corrigées sous anonymat : la liste des copies se saisit aussi hors ligne.
        await inBatches(grids.flatMap((grid) => grid.status === "fulfilled"
          ? grid.value.evaluations.filter((evaluation) => evaluation.anonyme && evaluation.statut === "OUVERTE").map((evaluation) => `/notes/evaluations/${evaluation.id}/copies`)
          : []));
      }
    }
    remember(":academique", String(Date.now()));
  }

  remember("", String(Date.now()));
  window.dispatchEvent(new Event("ipaim-offline-change"));
}

export function notifySessionChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("ipaim-session"));
}

export async function login(email: string, motDePasse: string) {
  return apiFetch<{
    access_token: string;
    utilisateur: import("./types").User;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, motDePasse }),
    token: null,
    bypassOffline: true,
  });
}
