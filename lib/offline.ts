export type OfflineOperation = {
  id: string;
  key: string;
  userId: string;
  temporaryId: string;
  temporaryRelatedId?: string;
  path: string;
  method: "POST" | "PATCH";
  body: unknown;
  createdAt: number;
  error?: string;
};

type CachedResponse = { key: string; value: unknown; savedAt: number };
type IdMapping = { temporaryId: string; realId: string };
export type OfflineAccount = { userId: string; email: string; user: import("./types").User };
type StoredOfflineAccount = OfflineAccount & { salt: string; verifier: string; iterations: number };

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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

async function store<T>(name: string, mode: IDBTransactionMode, action: (objectStore: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(name, mode).objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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

export async function cacheResponse(key: string, value: unknown) {
  await store("responses", "readwrite", (objectStore) =>
    objectStore.put({ key, value, savedAt: Date.now() } satisfies CachedResponse),
  );
}

export async function readCachedResponse<T>(key: string) {
  const cached = await store<CachedResponse | undefined>("responses", "readonly", (objectStore) => objectStore.get(key));
  return cached?.value as T | undefined;
}

async function listCachedResponses() {
  return store<CachedResponse[]>("responses", "readonly", (objectStore) => objectStore.getAll());
}

export async function listOfflineOperations(token?: string | null) {
  const operations = await store<OfflineOperation[]>("queue", "readonly", (objectStore) => objectStore.getAll());
  return (token === undefined ? operations : operations.filter((operation) => operation.userId === scope(token)))
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

export async function enqueueOperation(path: string, method: "POST" | "PATCH", body: unknown, key: string, token: string | null) {
  const queue = await listOfflineOperations(token);
  const serialized = JSON.stringify(body);
  const duplicate = queue.find((operation) => operation.method === method && operation.path === path && JSON.stringify(operation.body) === serialized);
  if (duplicate) return duplicate;

  const operation: OfflineOperation = {
    id: key,
    key,
    userId: scope(token),
    temporaryId: crypto.randomUUID(),
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
    createdAt: performance.timeOrigin + performance.now(),
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

export async function syncOfflineQueue(token: string) {
  if (!navigator.onLine) return;
  const queue = await listOfflineOperations(token);
  for (const operation of queue) {
    try {
      const mappings = new Map((await idMappings()).map((mapping) => [mapping.temporaryId, mapping.realId]));
      const resolvedPath = [...mappings].reduce((path, [temporaryId, realId]) => path.replaceAll(temporaryId, realId), operation.path);
        if (!navigator.onLine) break;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}${resolvedPath}`, {
        method: operation.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": operation.key },
        body: JSON.stringify(replaceIds(operation.body, mappings)),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : "Envoi impossible.");
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
      await removeOfflineOperation(operation.id);
    } catch (failure) {
      await updateOfflineOperation({
        ...operation,
        error: failure instanceof Error ? failure.message : "Synchronisation impossible.",
      });
      break;
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

export async function mergeOfflineRecords<T>(path: string, value: T): Promise<T> {
  const parsedUrl = new URL(path, window.location.origin);
  const resource = parsedUrl.pathname;
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
      if (body.elementDossierId) return [];
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
              : applicableLevel === "DEUXIEME_ANNEE_PLUS" || applicableLevel === "TOUS";
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
    return elements.map((element) => {
      const item = asRecord(element);
      const requiredElement = asRecord(item?.elementRequis);
      const status = typeof requiredElement?.id === "string"
        ? statusUpdates.get(requiredElement.id)
        : undefined;
      return status ? { ...item, statut: status } : element;
    }) as T;
  }
  if (parsedUrl.searchParams.get("page") && parsedUrl.searchParams.get("page") !== "1") return value;
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
          (firstYear ? applicableLevel === "PREMIERE_ANNEE" || applicableLevel === "TOUS" : applicableLevel === "DEUXIEME_ANNEE_PLUS" || applicableLevel === "TOUS");
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
  const verifier = await derivePasswordVerifier(password, salt, iterations);
  const account: StoredOfflineAccount = {
    userId,
    email: normalizedEmail,
    user,
    salt: toBase64(salt),
    verifier: toBase64(verifier),
    iterations,
  };
  await store("offlineAccounts", "readwrite", (objectStore) => objectStore.put(account));
}

export async function unlockOfflineAccount(email: string, password: string): Promise<OfflineAccount | null> {
  const account = await store<StoredOfflineAccount | undefined>(
    "offlineAccounts",
    "readonly",
    (objectStore) => objectStore.get(email.trim().toLocaleLowerCase()),
  );
  if (!account) return null;
  const attemptedVerifier = await derivePasswordVerifier(password, fromBase64(account.salt), account.iterations);
  if (!sameBytes(attemptedVerifier, fromBase64(account.verifier))) return null;
  return { userId: account.userId, email: account.email, user: account.user };
}