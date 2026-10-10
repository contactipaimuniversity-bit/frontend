"use client";

import { useEffect, useState } from "react";
import { ActionIcon } from "@/components/action-icon";
import { apiFetch } from "@/lib/api";
import { navigateTo, pathForDossier } from "@/lib/routes";

type PrintEntry = {
  id: string;
  typeDocument: string;
  mode: string;
  dossierType?: string | null;
  dossierId?: string | null;
  libelle: string;
  reference?: string | null;
  utilisateurId: string;
  utilisateurNom: string;
  date: string;
};
type PrintPage = {
  data: PrintEntry[];
  auteurs: Array<{ utilisateurId: string; utilisateurNom: string }>;
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const DOCUMENT_LABELS: Record<string, string> = {
  RECU_PAIEMENT: "Reçu de paiement",
  RECU_REMBOURSEMENT: "Reçu de remboursement",
  CERTIFICAT_BOURSE: "Certificat de bourse",
  CERTIFICAT_INSCRIPTION: "Certificat d'inscription",
  BON_COMMANDE: "Bon de commande",
  RAPPORT_ACTIVITE: "Rapport d'activité",
  BULLETIN_NOTES: "Bulletin de notes",
  PV_DELIBERATION: "Procès-verbal de délibération",
  BULLETIN_PAIE: "Bulletin de paie",
  CARTE_ETUDIANT: "Carte d'étudiant",
  RELEVE_NOTES: "Relevé de notes annuel",
  ATTESTATION_REUSSITE: "Attestation de réussite",
  DIPLOME: "Diplôme",
};
const DOSSIER_LABELS: Record<string, string> = {
  "demande-bourse": "Demande de bourse",
  inscription: "Inscription",
  depense: "Dépense",
};

const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
const hour = (value: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));

export function PrintsPage({ refreshSignal }: { refreshSignal: number }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [author, setAuthor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PrintPage | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  // Les bornes sont celles de la journée à l'heure du poste.
  const query = new URLSearchParams({ page: String(page), limit: "25" });
  if (search) query.set("q", search);
  if (type) query.set("typeDocument", type);
  if (author) query.set("utilisateurId", author);
  if (from) query.set("dateDebut", new Date(`${from}T00:00:00`).toISOString());
  if (to) query.set("dateFin", new Date(`${to}T23:59:59.999`).toISOString());
  const path = `/impressions?${query.toString()}`;

  useEffect(() => {
    let active = true;
    void apiFetch<PrintPage>(path, { skipCache: true })
      .then((value) => {
        if (!active) return;
        setResult(value);
        setError("");
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : "Historique indisponible.");
      });
    return () => {
      active = false;
    };
  }, [path, refreshSignal, version]);

  const change = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const meta = result?.meta;
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Traçabilité</p>
          <h2>Historique des impressions</h2>
          <p>Chaque document imprimé ou exporté en PDF : sur quel dossier, par qui, quel jour et à quelle heure.</p>
        </div>
        <button className="outline-button small" onClick={() => setVersion((current) => current + 1)}>Actualiser</button>
      </div>
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Documents édités</p>
            <h3>{meta?.total ?? "--"} impression(s)</h3>
          </div>
          <div className="toolbar">
            <form className="search-form" onSubmit={(event) => { event.preventDefault(); change(() => setSearch(draft.trim())); }}>
              <input aria-label="Rechercher une impression" placeholder="Dossier, référence, utilisateur..." value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button className="outline-button small">Rechercher</button>
            </form>
            <select aria-label="Type de document" value={type} onChange={(event) => change(() => setType(event.target.value))}>
              <option value="">Tous les documents</option>
              {Object.entries(DOCUMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select aria-label="Imprimé par" value={author} onChange={(event) => change(() => setAuthor(event.target.value))}>
              <option value="">Tous les utilisateurs</option>
              {(result?.auteurs ?? []).map((item) => <option key={item.utilisateurId} value={item.utilisateurId}>{item.utilisateurNom}</option>)}
            </select>
            <label className="print-date-filter">Du<input type="date" value={from} max={to || undefined} onChange={(event) => change(() => setFrom(event.target.value))} /></label>
            <label className="print-date-filter">au<input type="date" value={to} min={from || undefined} onChange={(event) => change(() => setTo(event.target.value))} /></label>
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jour</th>
                <th>Heure</th>
                <th>Document</th>
                <th>Dossier</th>
                <th>Imprimé par</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(result?.data ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td className="strong-cell">{day(entry.date)}</td>
                  <td>{hour(entry.date)}</td>
                  <td>
                    {DOCUMENT_LABELS[entry.typeDocument] ?? entry.typeDocument}
                    <small className="cell-detail">{entry.mode === "PDF" ? "Export PDF" : "Impression directe"}</small>
                  </td>
                  <td>
                    {entry.libelle}
                    <small className="cell-detail">{[entry.dossierType ? DOSSIER_LABELS[entry.dossierType] : null, entry.reference ? `Réf. ${entry.reference}` : null].filter(Boolean).join(" · ")}</small>
                  </td>
                  <td>{entry.utilisateurNom}</td>
                  <td>
                    {entry.dossierId && (entry.dossierType === "demande-bourse" || entry.dossierType === "inscription") && (
                      <button className="row-action icon-action" aria-label="Ouvrir le dossier" onClick={() => navigateTo(pathForDossier({ type: entry.dossierType as "demande-bourse" | "inscription", id: entry.dossierId! }))}>
                        <ActionIcon name="open" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!result?.data.length && (
                <tr><td colSpan={6} className="empty-state">{result ? "Aucune impression sur cette sélection." : "Chargement..."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && (
          <div className="pagination-bar">
            <span>Page {meta.page} sur {meta.totalPages} · {meta.total} impression(s)</span>
            <div className="pagination-actions">
              <button className="outline-button small" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>Précédente</button>
              <button className="outline-button small" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>Suivante</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
