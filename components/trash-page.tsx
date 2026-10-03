"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { statusLabels } from "@/lib/types";

type TrashEntry = {
  id: string;
  type: string;
  entiteId: string;
  libelle: string;
  motif: string;
  supprimeParId?: string | null;
  supprimeParNom: string;
  dateSuppression: string;
  donnees?: unknown;
};

const trashTypeLabels: Record<string, string> = {
  PERSONNE: "Personne et sa lignée",
  DEMANDE_BOURSE: "Demande de bourse et ses inscriptions liées",
  INSCRIPTION: "Inscription",
  UTILISATEUR: "Compte utilisateur",
};

const snapshotFieldLabels: Record<string, string> = {
  personne: "Personne",
  personneId: "Identifiant de la personne",
  demandesBourse: "Demandes de bourse",
  demandeBourse: "Demande de bourse liée",
  inscriptions: "Inscriptions",
  prospect: "Prospect",
  themes: "Historique des échanges",
  elementsDossier: "Pièces et obligations",
  elementRequis: "Élément requis",
  elementSubstitutUtilise: "Substitut utilisé",
  paiements: "Paiements",
  echeance: "Échéance",
  typeBourse: "Type de bourse",
  echeances: "Échéances de bourse",
  id: "Identifiant",
  nom: "Nom",
  prenom: "Prénom",
  email: "Adresse e-mail",
  role: "Rôle",
  telephone: "Téléphone",
  quartier: "Quartier",
  dateNaissance: "Date de naissance",
  lieuNaissance: "Lieu de naissance",
  tuteurNom: "Nom du tuteur",
  tuteurPrenom: "Prénom du tuteur",
  tuteurTelephone: "Téléphone du tuteur",
  dateEnregistrement: "Date d’enregistrement",
  niveauDemande: "Niveau demandé",
  filiereSouhaitee: "Filière souhaitée",
  filiereSecondaireSouhaitee: "Filière secondaire",
  ecoleOrigine: "École d’origine",
  dateDepot: "Date de dépôt",
  dateEntretien: "Date d’entretien",
  equipeEntretien: "Équipe d’entretien",
  dateDecision: "Date de décision",
  statut: "Statut",
  anneeScolaire: "Année scolaire",
  niveau: "Niveau",
  filiere: "Filière",
  viaBourse: "Inscription via bourse",
  dateInscription: "Date d’inscription",
  date: "Date",
  theme: "Sujet",
  obligatoire: "Obligatoire",
  categorie: "Catégorie",
  contexte: "Contexte",
  niveauApplicable: "Niveau applicable",
  statutRelance: "Statut de relance",
  intention: "Intention",
  elementRequisId: "Identifiant de l’élément requis",
  elementSubstitutUtiliseId: "Identifiant du substitut",
  montantAttendu: "Montant attendu",
  montant: "Montant payé",
  montantPaye: "Montant payé",
  resteAPayer: "Reste à payer",
  dateFourniture: "Date de fourniture",
  datePaiement: "Date du paiement",
  typePaiement: "Type de paiement",
  echeanceId: "Identifiant d’échéance",
  elementDossierId: "Identifiant de l’élément de dossier",
  demandeBourseId: "Identifiant de la demande liée",
  inscriptionId: "Identifiant de l’inscription liée",
  fraisInscription: "Frais d’inscription",
  tauxReduction: "Taux de réduction",
  libelle: "Libellé",
  ordre: "Ordre",
  dateEcheance: "Date d’échéance",
  montantPayeNonAffecte: "Paiement non affecté",
  creeParId: "Identifiant du créateur",
};

function SnapshotTree({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  const title = snapshotFieldLabels[label] ?? label;
  if (Array.isArray(value)) {
    if (!value.length) return <div className="trash-data-field"><span>{title}</span><strong>Aucun</strong></div>;
    return (
      <details className="trash-data-group" open={depth < 1}>
        <summary>{title}<span>{value.length}</span></summary>
        <div className="trash-tree-children">
          {value.map((item, index) => <SnapshotTree key={index} label={`${title} · ${index + 1}`} value={item} depth={depth + 1} />)}
        </div>
      </details>
    );
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "motDePasse");
    return (
      <details className="trash-data-group" open={depth < 1}>
        <summary>{title}<span>{entries.length}</span></summary>
        <div className="trash-tree-children">
          {entries.map(([key, child]) => <SnapshotTree key={key} label={key} value={child} depth={depth + 1} />)}
        </div>
      </details>
    );
  }
  let formatted: string;
  if (value === null || value === undefined || value === "") formatted = "-";
  else if (typeof value === "boolean") formatted = value ? "Oui" : "Non";
  else if (typeof value === "string" && /^(date|dateNaissance|dateDepot|dateDecision|dateEntretien|dateInscription|datePaiement|dateFourniture)/i.test(label)) {
    const date = new Date(value);
    formatted = Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", ...(value.includes("T") ? { timeStyle: "short" as const } : {}) }).format(date);
  } else if (typeof value === "string") formatted = statusLabels[value] ?? value;
  else formatted = String(value);
  return <div className="trash-data-field"><span>{title}</span><strong>{formatted}</strong></div>;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TrashPage() {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [selected, setSelected] = useState<TrashEntry | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [purgingId, setPurgingId] = useState("");
  const [restoringId, setRestoringId] = useState("");
  const [error, setError] = useState("");

  const loadEntries = async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await apiFetch<TrashEntry[]>("/corbeille"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Impossible de charger la corbeille.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void apiFetch<TrashEntry[]>("/corbeille")
      .then((result) => {
        if (active) setEntries(result);
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : "Impossible de charger la corbeille.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const inspect = async (entry: TrashEntry) => {
    try {
      setSelected(await apiFetch<TrashEntry>(`/corbeille/${entry.id}`));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Impossible de charger le détail archivé.");
    }
  };

  const purge = async (entry: TrashEntry) => {
    if (!window.confirm(`Supprimer définitivement « ${entry.libelle} » ? Cette action est irréversible.`)) return;
    setPurgingId(entry.id);
    setError("");
    try {
      await apiFetch(`/corbeille/${entry.id}`, { method: "DELETE" });
      setSelected((current) => current?.id === entry.id ? null : current);
      await loadEntries();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Purge définitive impossible.");
    } finally {
      setPurgingId("");
    }
  };

  const restore = async (entry: TrashEntry) => {
    if (!window.confirm(`Restaurer « ${entry.libelle} » dans les données actives ?`)) return;
    setRestoringId(entry.id);
    setError("");
    try {
      await apiFetch(`/corbeille/${entry.id}/restaurer`, { method: "POST" });
      setSelected((current) => current?.id === entry.id ? null : current);
      await loadEntries();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Restauration impossible. Vérifiez que les éléments liés sont restaurés.");
    } finally {
      setRestoringId("");
    }
  };

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = entries.filter((entry) => [
    entry.libelle,
    entry.type,
    entry.entiteId,
    entry.motif,
    entry.supprimeParNom,
  ].join(" ").toLocaleLowerCase().includes(normalizedSearch));

  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Administration · Archives</p>
          <h2>Corbeille</h2>
          <p>Les dossiers supprimés restent consultables ici jusqu’à leur purge définitive.</p>
        </div>
        <button className="outline-button small" onClick={() => void loadEntries()} disabled={loading}>Actualiser</button>
      </div>
      {error && <div className="api-error" role="alert">{error}</div>}
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Éléments archivés</p>
            <h3>{filtered.length} élément(s) dans la corbeille</h3>
          </div>
          <label className="trash-search">Rechercher
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, type, motif, auteur..." />
          </label>
        </div>
        {loading ? <p className="empty-state">Chargement de la corbeille...</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Élément</th><th>Type</th><th>Supprimé par</th><th>Date</th><th>Motif</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td className="strong-cell">{entry.libelle}</td>
                    <td>{trashTypeLabels[entry.type] ?? entry.type}</td>
                    <td>{entry.supprimeParNom}</td>
                    <td>{displayDate(entry.dateSuppression)}</td>
                    <td className="trash-reason-cell">{entry.motif}</td>
                    <td className="action-group trash-actions">
                      <button className="row-action" onClick={() => void inspect(entry)}>Détails</button>
                      <button className="row-action" disabled={restoringId === entry.id} onClick={() => void restore(entry)}>{restoringId === entry.id ? "Restauration..." : "Restaurer"}</button>
                      <button className="danger-button" disabled={purgingId === entry.id} onClick={() => void purge(entry)}>{purgingId === entry.id ? "Purge..." : "Purger"}</button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={6} className="empty-state">{entries.length ? "Aucun élément ne correspond à la recherche." : "La corbeille est vide."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="modal trash-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">{trashTypeLabels[selected.type] ?? selected.type}</p><h3>{selected.libelle}</h3></div>
              <button className="modal-close" onClick={() => setSelected(null)} aria-label="Fermer">×</button>
            </div>
            <dl className="trash-metadata">
              <div><dt>Motif</dt><dd>{selected.motif}</dd></div>
              <div><dt>Supprimé par</dt><dd>{selected.supprimeParNom}</dd></div>
              <div><dt>Date de suppression</dt><dd>{displayDate(selected.dateSuppression)}</dd></div>
              <div><dt>Identifiant d’origine</dt><dd>{selected.entiteId}</dd></div>
            </dl>
            <h4>Informations archivées</h4>
            <div className="trash-snapshot-tree"><SnapshotTree label="Dossier archivé" value={selected.donnees} /></div>
            <div className="form-actions">
              <button className="secondary-button" onClick={() => setSelected(null)}>Fermer</button>
              <button className="outline-button" disabled={restoringId === selected.id} onClick={() => void restore(selected)}>{restoringId === selected.id ? "Restauration..." : "Restaurer"}</button>
              <button className="danger-solid-button" onClick={() => void purge(selected)} disabled={purgingId === selected.id}>Purger définitivement</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}