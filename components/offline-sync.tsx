"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  currentOfflineSession,
  listOfflineOperations,
  OfflineOperation,
  removeOfflineOperation,
  syncOfflineQueue,
} from "@/lib/offline";
import { downloadOfflineReferenceData } from "@/lib/api";

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
  const { online, syncing, operations, retry, refresh } = useOfflineQueue(false);
  const [selected, setSelected] = useState<OfflineOperation | null>(null);
  const failedCount = operations.filter((operation) => operation.error).length;

  const remove = async (operation: OfflineOperation) => {
    await removeOfflineOperation(operation.id);
    if (selected?.id === operation.id) setSelected(null);
    await refresh();
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
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    setLocalOnly(Boolean(currentOfflineSession()) && !window.sessionStorage.getItem("ipaim-token"));
    setOperations(await listOfflineOperations(window.sessionStorage.getItem("ipaim-token")).catch(() => []));
  }, []);

  const retry = useCallback(async () => {
    const token = window.sessionStorage.getItem("ipaim-token");
    if (!token || !navigator.onLine) return;
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
    if (autoSync) await retry();
    await downloadOfflineReferenceData();
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
    window.addEventListener("ipaim-session", onSession);
    void Promise.resolve().then(refresh);
    void syncAndDownload();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onChange);
      window.removeEventListener("ipaim-offline-change", onChange);
      window.removeEventListener("ipaim-session", onSession);
    };
  }, [refresh, syncAndDownload]);

  return { online, syncing, operations, localOnly, retry, refresh };
}

function operationIcon(path: string) {
  if (path.startsWith("/personnes") || path === "/prospects") return "◎";
  if (path === "/demandes-bourse") return "◇";
  if (path === "/inscriptions") return "▣";
  if (path === "/paiements") return "₣";
  if (path === "/candidatures-personnel") return "♙";
  return "↻";
}

function operationLabel(operation: OfflineOperation) {
  if (operation.method === "PATCH") {
    const resource = operation.path.split("/")[1];
    const labels: Record<string, string> = {
      personnes: "Modification d’une personne",
      "demandes-bourse": "Modification d’une demande de bourse",
      inscriptions: "Modification d’une inscription",
      paiements: "Affectation d’un paiement",
      prospects: "Modification d’un prospect",
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
  montant: "Montant",
  typePaiement: "Type de paiement",
  inscriptionId: "Inscription associée",
  echeanceId: "Échéance associée",
  diplome: "Diplôme",
  fonction: "Fonction recherchée",
  elements: "Éléments du dossier",
  statut: "Statut",
  statutRelance: "Statut de relance",
};

function summarize(operation: OfflineOperation) {
  return detailFields(operation)
    .filter(([label, value]) => label !== "Personne associée" && value !== "—")
    .slice(0, 2);
}

function detailFields(operation: OfflineOperation): Array<[string, string]> {
  const body = operation.body && typeof operation.body === "object"
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
  if (Array.isArray(value)) return value.map((item) => formatValue(key, item)).join(" · ");
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