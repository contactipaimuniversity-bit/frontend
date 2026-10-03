import {
  cacheResponse,
  currentOfflineSession,
  enqueueOperation,
  listOfflineOperations,
  mergeOfflineRecords,
  readCachedResponse,
  responseCacheKey,
} from "./offline";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const GET_TIMEOUT_MS = 5000;
const offlineCreatablePaths = new Set([
  "/personnes",
  "/demandes-bourse",
  "/inscriptions",
  "/prospects",
  "/paiements",
  "/candidatures-personnel",
]);
const offlineEditablePath = /^\/(?:(?:personnes|demandes-bourse|inscriptions|prospects|candidatures-personnel)\/[^/]+|(?:demandes-bourse|inscriptions)\/[^/]+\/elements\/[^/]+|paiements\/[^/]+\/affectation)$/;
const referenceWritePath = /^\/(elements-requis|types-bourse)(?:\/.*)?$/;

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
    return [{ montant: Number(body.montant ?? 0), elementDossierId: String(body.elementDossierId ?? "") }];
  });
  const obligations = elements.map((element) => {
    const montantAttendu = Number(element.montantAttendu ?? 0);
    const montantPaye = (element.paiements ?? []).reduce((total, paiement) => total + Number(paiement.montant), 0) +
      pendingPayments.filter((payment) => payment.elementDossierId === element.id).reduce((total, payment) => total + payment.montant, 0);
    return {
      id: element.id,
      nom: element.elementRequis.nom,
      categorie: element.categorie ?? "DOCUMENT",
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

async function getCachedGet<T>(path: string, token: string | null) {
  const query = new URLSearchParams(path.split("?", 2)[1] ?? "");
  const typeBourseId = query.get("typeBourseId");
  if (path.startsWith("/inscriptions?") && typeBourseId) {
    const all: Array<Record<string, unknown>> = [];
    const firstPage = await readCachedResponse<{
      data: Array<Record<string, unknown>>;
      meta?: { totalPages?: number };
    }>(responseCacheKey(`${API_URL}/inscriptions?page=1&limit=100`, token));
    if (firstPage) {
      all.push(...firstPage.data);
      for (let page = 2; page <= (firstPage.meta?.totalPages ?? 1); page += 1) {
        const cachedPage = await readCachedResponse<{ data: Array<Record<string, unknown>> }>(
          responseCacheKey(`${API_URL}/inscriptions?page=${page}&limit=100`, token),
        );
        if (cachedPage) all.push(...cachedPage.data);
      }
      const search = query.get("q")?.trim().toLocaleLowerCase();
      const filtered = all.filter((item) => {
        const application = item.demandeBourse as Record<string, unknown> | null;
        if (application?.typeBourseId !== typeBourseId) return false;
        if (!search) return true;
        const person = item.personne as Record<string, unknown> | undefined;
        return [person?.nom, person?.prenom, person?.telephone, item.filiere, item.niveau, item.anneeScolaire]
          .filter((value): value is string => typeof value === "string")
          .join(" ")
          .toLocaleLowerCase()
          .includes(search);
      });
      const page = Number(query.get("page") ?? 1);
      const limit = Number(query.get("limit") ?? 20);
      const start = (page - 1) * limit;
      return {
        data: filtered.slice(start, start + limit),
        meta: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
      } as T;
    }
  }
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
        (!niveau || element.niveauApplicable === niveau || element.niveauApplicable === "TOUS"),
      ) as T;
    }
  }
  const cached = await readCachedResponse<T>(responseCacheKey(`${API_URL}${path}`, token));
  if (cached !== undefined) return mergeOfflineRecords(path, cached);
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
  onCached?: (value: T) => void;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const token =
    options.token ??
    (typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem("ipaim-token"));
  const offlineSession = currentOfflineSession();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body)
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const method = (options.method ?? "GET").toUpperCase();
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (
    (method === "POST" || method === "PATCH" || method === "DELETE") &&
    referenceWritePath.test(path) &&
    ((typeof navigator !== "undefined" && !navigator.onLine) || Boolean(offlineSession))
  )
    throw new Error("Les référentiels ne peuvent être modifiés que lorsque vous êtes connecté.");
  const idempotencyKey = method === "POST" && token ? crypto.randomUUID() : null;
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  if (offline) {
    if (method === "GET") {
      const cached = await getCachedGet<T>(path, token);
      if (cached !== undefined) return cached;
      throw new Error("Vous êtes hors ligne et cette donnée n’est pas disponible sur cet appareil.");
    }
    if (
      (method === "POST" && offlineCreatablePaths.has(path)) ||
      (method === "PATCH" && offlineEditablePath.test(path))
    ) {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
      const queued = await enqueueOperation(path, method as "POST" | "PATCH", body, idempotencyKey ?? crypto.randomUUID(), token);
      return { id: queued.temporaryId } as T;
    }
    throw new Error("Cette action nécessite une connexion en ligne.");
  }

  if (offlineSession && !token && !options.bypassOffline) {
    if (method === "GET") {
      const cached = await getCachedGet<T>(path, null);
      if (cached !== undefined) return cached;
      throw new Error("Cette donnée n’a pas encore été téléchargée sur cet appareil.");
    }
    if (
      (method === "POST" && offlineCreatablePaths.has(path)) ||
      (method === "PATCH" && offlineEditablePath.test(path))
    ) {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
      const queued = await enqueueOperation(path, method as "POST" | "PATCH", body, crypto.randomUUID(), null);
      return { id: queued.temporaryId } as T;
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
    delete (fetchOptions as RequestInit & { onCached?: (value: T) => void }).onCached;
    if (method === "GET") {
      const timeoutSignal = AbortSignal.timeout(GET_TIMEOUT_MS);
      fetchOptions.signal = fetchOptions.signal
        ? AbortSignal.any([fetchOptions.signal, timeoutSignal])
        : timeoutSignal;
    }
    response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
  } catch (failure) {
    if (method === "GET") {
      const cached = await getCachedGet<T>(path, token);
      if (cached !== undefined) return cached;
    }
    if (token && (
      (method === "POST" && offlineCreatablePaths.has(path) && idempotencyKey) ||
      (method === "PATCH" && offlineEditablePath.test(path))
    )) {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
      const queued = await enqueueOperation(path, method as "POST" | "PATCH", body, idempotencyKey ?? crypto.randomUUID(), token);
      return { id: queued.temporaryId } as T;
    }
    throw failure;
  }
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined")
      window.dispatchEvent(new Event("ipaim-session-expired"));
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    throw new Error(message || "Une erreur est survenue avec le serveur.");
  }
  if (method === "GET") {
    await cacheResponse(responseCacheKey(`${API_URL}${path}`, token), payload).catch(() => {});
    return mergeOfflineRecords(path, payload as T);
  }
  return payload as T;
}

export async function downloadOfflineReferenceData() {
  if (typeof navigator === "undefined" || !navigator.onLine || currentOfflineSession()) return;
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

  const [, , applications, enrollments] = await Promise.allSettled([
    apiFetch<unknown[]>("/elements-requis"),
    apiFetch<unknown[]>("/types-bourse"),
    loadDossierIds("demandes-bourse"),
    loadDossierIds("inscriptions"),
    loadDossierIds("demandes-bourse", "statut=ACCEPTEE"),
    apiFetch<unknown>("/paiements"),
  ]);
  await import("jspdf").catch(() => undefined);
  const applicationIds = applications.status === "fulfilled" ? applications.value : [];
  const enrollmentIds = enrollments.status === "fulfilled" ? enrollments.value : [];
  const detailPaths = [
    ...applicationIds.map((id) => `/demandes-bourse/${id}`),
    ...applicationIds.map((id) => `/demandes-bourse/${id}/elements`),
    ...applicationIds.map((id) => `/demandes-bourse/${id}/finance`),
    ...enrollmentIds.map((id) => `/inscriptions/${id}`),
    ...enrollmentIds.map((id) => `/inscriptions/${id}/elements`),
    ...enrollmentIds.map((id) => `/inscriptions/${id}/finance`),
  ];

  for (let index = 0; index < detailPaths.length; index += 20) {
    await Promise.allSettled(
      detailPaths
        .slice(index, index + 20)
        .map((path) => apiFetch<unknown>(path)),
    );
  }
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
