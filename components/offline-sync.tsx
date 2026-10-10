"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearCachedResponses,
  currentOfflineSession,
  dismissDuplicateNotice,
  DuplicateNotice,
  listDuplicateNotices,
  exportOfflineQueue,
  importOfflineQueue,
  isQueuedUpload,
  listOfflineOperations,
  OfflineOperation,
  removeOfflineOperation,
  syncOfflineQueue,
} from "@/lib/offline";
import { downloadOfflineReferenceData, lastOfflineDownload, resetOfflineDownload } from "@/lib/api";
import { checkServer, isOffline } from "@/lib/connectivity";
import { askConfirm, toast } from "@/components/feedback";

const RETRY_INTERVAL_MS = 60_000;

export function OfflineSync({ onOpenPage }: { onOpenPage: () => void }) {
  const { online, syncing, operations, localOnly } = useOfflineQueue();
  const label = syncing
    ? "Synchronisation en cours"
    : localOnly && online
      ? "Reconnexion requise"
    : !online
      ? "Mode hors ligne"
      : operations.length
        ? `${operations.length} en attente`
        : "Synchronisé";

  return (
    <div className="offline-sync">
      <button
        className={`offline-sync-trigger ${!online ? "offline" : syncing ? "syncing" : ""}`}
        type="button"
        onClick={onOpenPage}
        aria-label={`${label}. Ouvrir la page de synchronisation.`}
      >
        <i />
        {label}
        {operations.length > 0 && <strong>{operations.length}</strong>}
        <span className="offline-sync-arrow" aria-hidden="true">↗</span>
      </button>
    </div>
  );
}

export function OfflineSyncPage({ needsOnlineAuthentication, onReconnect }: { needsOnlineAuthentication: boolean; onReconnect: () => void }) {
  const { online, syncing, operations, otherUsersCount, downloadedAt, duplicates, retry, refresh } = useOfflineQueue(false);
  const [selected, setSelected] = useState<OfflineOperation | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const failedCount = operations.filter((operation) => operation.error).length;
  const token = () => window.sessionStorage.getItem("ipaim-token");

  // Retirer un enregistrement l'efface pour de bon : il ne sera jamais envoyé au serveur.
  const remove = async (operation: OfflineOperation) => {
    const confirmed = await askConfirm({
      title: "Retirer cet enregistrement ?",
      message: `« ${operationLabel(operation)} » du ${formatDate(operation.createdAt)} ne sera jamais envoyé au serveur. Cette suppression est définitive.`,
      confirmLabel: "Retirer définitivement",
      danger: true,
    });
    if (!confirmed) return;
    await removeOfflineOperation(operation.id);
    if (selected?.id === operation.id) setSelected(null);
    await refresh();
  };

  const exportQueue = async () => {
    const backup = await exportOfflineQueue(token());
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ipaim-file-attente-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Copie de secours téléchargée. Conservez ce fichier jusqu’à la synchronisation.", "info");
  };

  const importQueue = async (file: File | undefined) => {
    if (!file) return;
    try {
      const restored = await importOfflineQueue(JSON.parse(await file.text()), token());
      toast(restored ? `${restored} enregistrement(s) remis en attente.` : "Tous ces enregistrements sont déjà présents.", "info");
      await refresh();
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : "Fichier illisible.", "error");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const clearLocalData = async () => {
    const confirmed = await askConfirm({
      title: "Effacer les données de consultation ?",
      message: "Les listes et dossiers gardés sur cet appareil seront effacés ; ils seront téléchargés à nouveau à la prochaine connexion. Les enregistrements en attente d’envoi sont conservés.",
      confirmLabel: "Effacer",
      danger: true,
    });
    if (!confirmed) return;
    await clearCachedResponses();
    resetOfflineDownload();
    toast("Données de consultation effacées de cet appareil.", "info");
    if (online) void downloadOfflineReferenceData("complet");
  };

  return (
    <div className="content-scroll sync-page">
      <div className="sync-page-heading">
        <div>
          <p className="eyebrow">Données locales</p>
          <h2>Synchronisation</h2>
          <p>Suivez les enregistrements en attente de transfert vers le serveur.</p>
        </div>
        {operations.length > 0 && online && !needsOnlineAuthentication && (
          <button className="primary-button compact" disabled={syncing} onClick={() => void retry()}>
            <span aria-hidden="true">↻</span>
            {syncing ? "Synchronisation..." : "Tout synchroniser"}
          </button>
        )}
        {online && needsOnlineAuthentication && (
          <button className="primary-button compact" onClick={onReconnect}>Se reconnecter</button>
        )}
      </div>

      <section className="sync-overview" aria-label="État de synchronisation">
        <div className={`sync-connection ${online ? "connected" : "disconnected"}`}>
          <span className="sync-overview-icon">{online ? "↗" : "⌁"}</span>
          <div><small>Connexion</small><strong>{online ? "En ligne" : "Hors ligne"}</strong></div>
        </div>
        <div><small>À synchroniser</small><strong>{operations.length}</strong></div>
        <div><small>À vérifier</small><strong>{failedCount}</strong></div>
      </section>

      {!online && (
        <div className="sync-notice" role="status">
          <span aria-hidden="true">⌁</span>
          <p>Vos changements restent enregistrés sur cet appareil. La synchronisation reprendra dès que la connexion sera rétablie.</p>
        </div>
      )}
      {online && needsOnlineAuthentication && (
        <div className="sync-notice sync-auth-notice" role="status">
          <span aria-hidden="true">↗</span>
          <p>Vous êtes dans une session locale. Reconnectez-vous avec vos identifiants pour autoriser l’envoi de ces données vers le serveur.</p>
        </div>
      )}
      {otherUsersCount > 0 && (
        <div className="sync-notice" role="status">
          <span aria-hidden="true">!</span>
          <p>{otherUsersCount} enregistrement(s) saisi(s) par d’autres utilisateurs attendent sur cet appareil. Ils partiront lorsque leur auteur se reconnectera ici.</p>
        </div>
      )}

      {duplicates.length > 0 && (
        <section className="sync-duplicates" aria-label="Personnes à vérifier">
          <h3>Personnes à vérifier</h3>
          <p>Ces personnes ont été créées hors ligne alors qu’une fiche semblable existait déjà sur le serveur. Vérifiez qu’il ne s’agit pas de la même personne.</p>
          <ul>
            {duplicates.map((notice) => (
              <li key={notice.id}>
                <div>
                  <strong>{notice.nom} {notice.prenom}</strong>
                  <small>Ressemble à : {notice.similaires.map((person) => [`${person.nom} ${person.prenom}`, person.telephone, person.matricule].filter(Boolean).join(" · ")).join(" ; ")}</small>
                </div>
                <button type="button" className="outline-button" onClick={() => dismissDuplicateNotice(notice.id)}>C’est vérifié</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="sync-tools" aria-label="Données gardées sur cet appareil">
        <p>
          {downloadedAt
            ? `Données de consultation téléchargées le ${formatDate(downloadedAt)}.`
            : "Les données de consultation n’ont pas encore été téléchargées sur cet appareil."}
        </p>
        <div>
          {online && !needsOnlineAuthentication && <button type="button" className="outline-button" onClick={() => void downloadOfflineReferenceData("complet").then(refresh)}>Actualiser les données</button>}
          {operations.length > 0 && <button type="button" className="outline-button" onClick={() => void exportQueue()}>Exporter une copie de secours</button>}
          <button type="button" className="outline-button" onClick={() => importInput.current?.click()}>Importer une copie</button>
          <button type="button" className="outline-button" onClick={() => void clearLocalData()}>Effacer les données de consultation</button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={(event) => void importQueue(event.target.files?.[0])} />
        </div>
      </section>

      {operations.length === 0 ? (
        <section className="sync-empty">
          <span aria-hidden="true">✓</span>
          <h3>Tout est à jour</h3>
          <p>Aucun enregistrement local n’attend d’être envoyé.</p>
        </section>
      ) : (
        <section className="sync-records" aria-label="Enregistrements en attente">
          <div className="sync-records-heading">
            <h3>Enregistrements locaux</h3>
            <span>{operations.length} élément{operations.length === 1 ? "" : "s"}</span>
          </div>
          <div className="sync-record-grid">
            {operations.map((operation, index) => (
              <article className="sync-record" key={operation.id} style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}>
                <div className="sync-record-topline">
                  <span className={`sync-record-icon ${operation.error ? "has-error" : ""}`} aria-hidden="true">
                    {operation.error ? "!" : operation.method === "PATCH" ? "✎" : operationIcon(operation.path)}
                  </span>
                  <span className={`sync-record-state ${operation.error ? "needs-attention" : "waiting"}`}>
                    {operation.error ? "À vérifier" : "En attente"}
                  </span>
                </div>
                <h4>{operationLabel(operation)}</h4>
                <p className="sync-record-date">Enregistré le {formatDate(operation.createdAt)}</p>
                <div className="sync-record-bubbles">
                  {summarize(operation).map(([label, value]) => (
                    <span className="sync-bubble" key={label}><small>{label}</small>{value}</span>
                  ))}
                </div>
                {operation.error && <p className="sync-record-error">{operation.error}</p>}
                <footer>
                  <button type="button" className="sync-detail-button" onClick={() => setSelected(operation)}>Voir les détails <span aria-hidden="true">↗</span></button>
                  <button type="button" className="sync-remove-button" onClick={() => void remove(operation)}>Retirer</button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <div className="modal-backdrop sync-modal-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="modal sync-detail-modal" role="dialog" aria-modal="true" aria-labelledby="sync-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sync-detail-header">
              <span className={`sync-record-icon ${selected.error ? "has-error" : ""}`} aria-hidden="true">{operationIcon(selected.path)}</span>
              <div><p className="eyebrow">{selected.method === "PATCH" ? "Modification locale" : "Nouvel enregistrement"}</p><h3 id="sync-detail-title">{operationLabel(selected)}</h3></div>
              <button type="button" className="modal-close" onClick={() => setSelected(null)} aria-label="Fermer">×</button>
            </div>
            <div className="sync-detail-status">
              <span className={selected.error ? "needs-attention" : "waiting"}>{selected.error ? "Synchronisation à vérifier" : "En attente d’envoi"}</span>
              <time>{formatDate(selected.createdAt)}</time>
            </div>
            {selected.error && <p className="sync-record-error sync-modal-error">{selected.error}</p>}
            <dl className="sync-detail-fields">
              {detailFields(selected).map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
            <div className="sync-detail-actions">
              <button type="button" className="secondary-button" onClick={() => void remove(selected)}>Retirer cet enregistrement</button>
              {online && !needsOnlineAuthentication && <button type="button" className="primary-button compact" disabled={syncing} onClick={() => void retry()}>{syncing ? "Synchronisation..." : "Synchroniser"}</button>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function useOfflineQueue(autoSync = true) {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [localOnly, setLocalOnly] = useState(false);
  const [otherUsersCount, setOtherUsersCount] = useState(0);
  const [downloadedAt, setDownloadedAt] = useState<number | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateNotice[]>([]);
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    setOnline(!isOffline());
    setLocalOnly(Boolean(currentOfflineSession()) && !window.sessionStorage.getItem("ipaim-token"));
    setDownloadedAt(lastOfflineDownload());
    setDuplicates(listDuplicateNotices());
    const mine = await listOfflineOperations(window.sessionStorage.getItem("ipaim-token")).catch(() => []);
    setOperations(mine);
    setOtherUsersCount(Math.max(0, (await listOfflineOperations().catch(() => [])).length - mine.length));
  }, []);

  const retry = useCallback(async () => {
    const token = window.sessionStorage.getItem("ipaim-token");
    if (!token || isOffline()) return;
    if (syncPromiseRef.current) return syncPromiseRef.current;
    setSyncing(true);
    const syncPromise = syncOfflineQueue(token);
    syncPromiseRef.current = syncPromise;
    try {
      await syncPromise;
    } finally {
      syncPromiseRef.current = null;
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  const syncAndDownload = useCallback(async () => {
    if (!autoSync) return;
    const pending = await listOfflineOperations(window.sessionStorage.getItem("ipaim-token")).catch(() => []);
    await retry();
    // Après un envoi, les copies locales des dossiers concernés sont à rafraîchir.
    await downloadOfflineReferenceData(pending.length > 0);
  }, [autoSync, retry]);

  useEffect(() => {
    const onOnline = () => {
      void refresh();
      void syncAndDownload();
    };
    const onChange = () => void refresh();
    const onSession = () => {
      void refresh();
      void syncAndDownload();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onChange);
    window.addEventListener("ipaim-offline-change", onChange);
    window.addEventListener("ipaim-connectivity", onChange);
    // Le serveur répond à nouveau (retour du courant) alors que le réseau n'avait pas bougé.
    window.addEventListener("ipaim-server-online", onOnline);
    window.addEventListener("ipaim-session", onSession);
    void Promise.resolve().then(refresh);
    void syncAndDownload();
    // Tant qu'il reste des enregistrements à envoyer, on réessaie sans attendre l'utilisateur.
    const retryTimer = autoSync
      ? window.setInterval(() => {
          void listOfflineOperations(window.sessionStorage.getItem("ipaim-token"))
            .then(async (pending) => {
              if (pending.length && (await checkServer())) await syncAndDownload();
            })
            .catch(() => undefined);
        }, RETRY_INTERVAL_MS)
      : undefined;
    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onChange);
      window.removeEventListener("ipaim-offline-change", onChange);
      window.removeEventListener("ipaim-connectivity", onChange);
      window.removeEventListener("ipaim-server-online", onOnline);
      window.removeEventListener("ipaim-session", onSession);
    };
  }, [autoSync, refresh, syncAndDownload]);

  return { online, syncing, operations, localOnly, otherUsersCount, downloadedAt, duplicates, retry, refresh };
}

function operationIcon(path: string) {
  if (path.startsWith("/personnes") || path === "/prospects") return "◎";
  if (path === "/demandes-bourse") return "◇";
  if (path === "/inscriptions") return "▣";
  if (path === "/paiements") return "₣";
  if (path === "/candidatures-personnel") return "♙";
  if (path === "/scolarite/seances") return "✓";
  if (path.startsWith("/notes/")) return "✎";
  if (path.startsWith("/depenses")) return "₣";
  if (path.endsWith("/photo")) return "◎";
  return "↻";
}

function operationLabel(operation: OfflineOperation) {
  if (operation.method === "POST" && /^\/prospects\/[^/]+\/relances$/.test(operation.path))
    return "Compte rendu de relance prospect";
  if (operation.path.endsWith("/photo")) return "Photo d’identité";
  if (/^\/depenses\/[^/]+\/pieces$/.test(operation.path)) return "Pièce jointe de dépense";
  if (/^\/depenses\/[^/]+\/soumettre$/.test(operation.path)) return "Soumission de dépense";
  if (operation.method === "PUT") return operation.path.endsWith("/copies") ? "Notes sous anonymat" : "Saisie de notes";
  if (operation.method === "PATCH") {
    const resource = operation.path.split("/")[1];
    const labels: Record<string, string> = {
      personnes: "Modification d’une personne",
      "demandes-bourse": "Modification d’une demande de bourse",
      inscriptions: "Modification d’une inscription",
      paiements: "Affectation d’un paiement",
      prospects: "Modification d’un prospect",
      depenses: "Modification d’un brouillon de dépense",
      "candidatures-personnel": "Modification d’une candidature",
    };
    return labels[resource] ?? "Modification";
  }
  const labels: Record<string, string> = {
    "/personnes": "Nouvelle personne",
    "/demandes-bourse": "Demande de bourse",
    "/inscriptions": "Nouvelle inscription",
    "/prospects": "Nouveau prospect",
    "/paiements": "Nouveau paiement",
    "/candidatures-personnel": "Candidature du personnel",
    "/scolarite/seances": "Séance et appel",
    "/depenses": "Brouillon de dépense",
  };
  return labels[operation.path] ?? "Enregistrement";
}

const fieldLabels: Record<string, string> = {
  nom: "Nom",
  prenom: "Prénom",
  telephone: "Téléphone",
  quartier: "Quartier",
  dateNaissance: "Date de naissance",
  lieuNaissance: "Lieu de naissance",
  tuteurNom: "Nom du tuteur",
  tuteurPrenom: "Prénom du tuteur",
  tuteurTelephone: "Téléphone du tuteur",
  personneId: "Personne associée",
  niveauDemande: "Niveau demandé",
  filiereSouhaitee: "Filière souhaitée",
  filiereSecondaireSouhaitee: "Deuxième choix",
  ecoleOrigine: "École d’origine",
  anneeScolaire: "Année scolaire",
  niveau: "Niveau",
  filiere: "Filière",
  viaBourse: "Inscription via bourse",
  demandeBourseId: "Demande associée",
  elementDossierId: "Obligation du dossier",
  intention: "Intention",
  sourceConnaissance: "A connu l'IPAIM par",
  commentaire: "Compte rendu",
  dateProchaineRelance: "Prochaine relance",
  montant: "Montant",
  typePaiement: "Type de paiement",
  inscriptionId: "Inscription associée",
  echeanceId: "Échéance associée",
  diplome: "Diplôme",
  fonction: "Fonction recherchée",
  elements: "Éléments du dossier",
  statut: "Statut",
  statutRelance: "Statut de relance",
  coursId: "Cours",
  date: "Date",
  heureDebut: "Heure de début",
  dureeMinutes: "Durée (minutes)",
  contenu: "Contenu enseigné",
  absents: "Absents",
  notes: "Notes saisies",
  objet: "Objet",
  justification: "Justification",
  categorieId: "Catégorie",
  fournisseurId: "Fournisseur",
  lignes: "Lignes",
  type: "Type de pièce",
  fichier: "Fichier",
};

function summarize(operation: OfflineOperation) {
  return detailFields(operation)
    .filter(([label, value]) => label !== "Personne associée" && value !== "—")
    .slice(0, 2);
}

function detailFields(operation: OfflineOperation): Array<[string, string]> {
  const body: Record<string, unknown> = isQueuedUpload(operation.body)
    ? { ...operation.body.fields, fichier: `${operation.body.fileName} (${Math.max(1, Math.round(operation.body.file.size / 1024))} Ko)` }
    : operation.body && typeof operation.body === "object"
      ? operation.body as Record<string, unknown>
      : {};
  return Object.entries(body).flatMap(([key, value]) => {
    if (key === "nouvellePersonne" && value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value as Record<string, unknown>).map(([personKey, personValue]) => [
        `Personne · ${fieldLabels[personKey] ?? humanize(personKey)}`,
        formatValue(personKey, personValue),
      ] as [string, string]);
    }
    return [[fieldLabels[key] ?? humanize(key), formatValue(key, value)] as [string, string]];
  });
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toLocaleUpperCase());
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.every((item) => item && typeof item === "object") ? `${value.length} élément(s)` : value.map((item) => formatValue(key, item)).join(" · ");
  if (typeof value === "object") return "Détails associés";
  if (typeof value === "string" && /date/i.test(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("fr-FR");
  }
  if (typeof value === "string" && /Id$/.test(key)) return `Référence locale · ${value.slice(-6)}`;
  return String(value);
}

function formatDate(value: number) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}