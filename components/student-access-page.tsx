"use client";

import { useMemo, useState } from "react";
import { KeyRound, Printer } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { Badge, Empty, LoadingBlock, PageIntro, Panel, messageOf, useLoad } from "@/components/ui-kit";
import { hasAccess } from "@/lib/access";
import { API_URL } from "@/lib/connectivity";
import { StudentAccessSlip, studentAccessSlipsPdf } from "@/lib/pdf-docs";
import { User, formatDate } from "@/lib/types";

type AccessRow = {
  personneId: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  filiere: string | null;
  niveau: string | null;
  classe: string | null;
  etat: "AUCUN" | "EN_ATTENTE" | "ACTIF" | "DESACTIVE";
  codeEnCours: boolean;
  codeExpireLe: string | null;
  codeCreeLe: string | null;
  activeLe: string | null;
};
type Filters = { poles: Array<{ id: string; nom: string }>; filieres: Array<{ id: string; nom: string; poleId: string | null }>; niveaux: Array<{ code: string; libelle: string }>; classes: Array<{ id: string; nom: string; poleId: string | null }> };
type Show = "a-remettre" | "sans-code" | "tous";

function state(row: AccessRow) {
  if (row.etat === "ACTIF") return { label: "Accès activé", tone: "ok" as const };
  if (row.etat === "DESACTIVE") return { label: "Désactivé", tone: "bad" as const };
  if (row.codeEnCours) return { label: `Code remis le ${row.codeCreeLe ? formatDate(row.codeCreeLe) : "—"}`, tone: "wait" as const };
  if (row.etat === "EN_ATTENTE") return { label: "Code expiré", tone: "off" as const };
  return { label: "Jamais remis", tone: "off" as const };
}

// Requête directe (sans clé d'idempotence) : la réponse contient les codes en
// clair, elle ne doit être conservée nulle part sur le serveur.
async function issueCodes(personneIds: string[], dureeJours: number, remplacerCodesEnCours: boolean) {
  const token = window.sessionStorage.getItem("ipaim-token");
  const response = await fetch(`${API_URL}/comptes-etudiants/codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ personneIds, dureeJours, remplacerCodesEnCours }),
  });
  const body = (await response.json().catch(() => null)) as { fiches?: StudentAccessSlip[]; ignores?: string[]; codesConserves?: string[]; message?: string | string[] } | null;
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
    throw new Error(message || "Le serveur est injoignable. Cette action nécessite une connexion.");
  }
  return { fiches: body?.fiches ?? [], ignores: body?.ignores ?? [], kept: body?.codesConserves ?? [] };
}

// Fiches d'accès à l'espace étudiant, à imprimer par lot (10 par page) et à
// remettre en main propre : matricule, code d'activation et QR code.
export function StudentAccessPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const filters = useLoad<Filters>("/comptes-etudiants/filtres", refreshSignal);
  const [poleId, setPoleId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("");
  const [classeId, setClasseId] = useState("");
  // Par défaut : seulement ceux qui n'ont encore rien reçu (pas de code valable).
  const [show, setShow] = useState<Show>("sans-code");
  const [replace, setReplace] = useState(false);
  const [days, setDays] = useState("30");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams({ ...(poleId ? { poleId } : {}), ...(filiereId ? { filiereId } : {}), ...(niveau ? { niveau } : {}), ...(classeId ? { classeId } : {}) }).toString();
  const list = useLoad<AccessRow[]>(`/comptes-etudiants${query ? `?${query}` : ""}`, refreshSignal);
  const canEdit = hasAccess(user, "people", "edit") || hasAccess(user, "enrollments", "edit");

  const rows = useMemo(() => {
    const all = list.data ?? [];
    if (show === "tous") return all;
    // À remettre : tous ceux qui n'ont pas activé leur accès ; sans code : en plus, aucun code valable en cours.
    return all.filter((row) => row.etat !== "ACTIF" && (show === "a-remettre" || !row.codeEnCours));
  }, [list.data, show]);
  // Un code encore valable n'est remplacé que si on le demande explicitement.
  const selectable = rows.filter((row) => row.etat !== "ACTIF" && (replace || !row.codeEnCours));
  const chosen = selectable.filter((row) => selection.has(row.personneId));
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;
  const counts = useMemo(() => {
    const all = list.data ?? [];
    return { total: all.length, actifs: all.filter((row) => row.etat === "ACTIF").length, enCours: all.filter((row) => row.etat !== "ACTIF" && row.codeEnCours).length };
  }, [list.data]);

  const toggle = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  };

  const print = async () => {
    if (!chosen.length) return;
    const replacing = replace ? chosen.filter((row) => row.codeEnCours).length : 0;
    const confirmed = await askConfirm({
      title: `Imprimer ${chosen.length} fiche(s) d'accès ?`,
      message: `Un nouveau code est créé pour chaque étudiant, valable ${days} jours.${replacing ? ` ${replacing} étudiant(s) ont déjà un code en cours : leur ancienne fiche ne marchera plus.` : ""} Les codes ne seront affichés que dans ce PDF : gardez-le jusqu'à la distribution.`,
      confirmLabel: "Générer et imprimer",
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const { fiches, ignores, kept } = await issueCodes(chosen.map((row) => row.personneId), Number(days) || 30, replace);
      if (fiches.length) {
        const label = classeId ? filters.data?.classes.find((item) => item.id === classeId)?.nom : filiereId ? filters.data?.filieres.find((item) => item.id === filiereId)?.nom : poleId ? filters.data?.poles.find((item) => item.id === poleId)?.nom : niveau || "etudiants";
        await studentAccessSlipsPdf(fiches, { url: `${window.location.origin}/etudiant`, fileName: `acces-espace-etudiant-${(label ?? "etudiants").replace(/\s+/g, "-").toLowerCase()}.pdf` });
      }
      toast(`${fiches.length} fiche(s) prête(s) à imprimer.${kept.length ? ` ${kept.length} avaient déjà un code valable : non régénéré(s).` : ""}${ignores.length ? ` ${ignores.length} déjà actif(s) ignoré(s).` : ""}`);
      setSelection(new Set());
      list.reload();
    } catch (failure) {
      toast(messageOf(failure, "Génération impossible."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Espace étudiant" title="Fiches d'accès" text="Générez en une fois les codes d'activation des étudiants qui n'ont pas encore activé leur espace, et imprimez des fiches à découper (10 par page) à leur remettre en main propre.">
        {canEdit && <button className="primary-button compact" disabled={busy || !chosen.length} onClick={() => void print()}><Printer size={15} aria-hidden="true" /> {busy ? "Préparation…" : `Générer et imprimer (${chosen.length})`}</button>}
      </PageIntro>

      <div className="stats-grid">
        <article className="stat-card blue"><span>Étudiants (filtre)</span><strong>{list.data ? counts.total : "…"}</strong><p>avec matricule</p></article>
        <article className="stat-card mint"><span>Accès activés</span><strong>{list.data ? counts.actifs : "…"}</strong><p>déjà connectés au moins une fois</p></article>
        <article className="stat-card orange"><span>Codes en attente</span><strong>{list.data ? counts.enCours : "…"}</strong><p>remis, pas encore utilisés</p></article>
      </div>

      <Panel eyebrow="Étudiants" title={list.data ? `${rows.length} étudiant(s)` : "Chargement…"} subtitle="Cochez les étudiants dont il faut imprimer la fiche. Les accès déjà activés ne sont jamais modifiés.">
        <div className="form-grid">
          <label>Pôle<select value={poleId} onChange={(event) => { setPoleId(event.target.value); setFiliereId(""); setClasseId(""); setSelection(new Set()); }}><option value="">Tous</option>{filters.data?.poles.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</select></label>
          <label>Filière<select value={filiereId} onChange={(event) => { setFiliereId(event.target.value); setSelection(new Set()); }}><option value="">Toutes</option>{filters.data?.filieres.filter((item) => !poleId || item.poleId === poleId).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</select></label>
          <label>Niveau<select value={niveau} onChange={(event) => { setNiveau(event.target.value); setSelection(new Set()); }}><option value="">Tous</option>{filters.data?.niveaux.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select></label>
          <label>Classe<select value={classeId} onChange={(event) => { setClasseId(event.target.value); setSelection(new Set()); }}><option value="">Toutes</option>{filters.data?.classes.filter((item) => !poleId || item.poleId === poleId).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</select></label>
          <label>Afficher<select value={show} onChange={(event) => { setShow(event.target.value as Show); setSelection(new Set()); }}><option value="sans-code">Pas encore de code (à générer)</option><option value="a-remettre">Accès non activé (avec codes en cours)</option><option value="tous">Tous</option></select></label>
          <label>Validité du code (jours)<input type="number" min="1" max="120" value={days} onChange={(event) => setDays(event.target.value)} /></label>
          <label className="check-row" title="Utile seulement pour un étudiant qui a perdu sa fiche : son ancienne fiche ne marchera plus."><input type="checkbox" checked={replace} onChange={(event) => { setReplace(event.target.checked); setSelection(new Set()); }} /> Remplacer aussi les codes déjà remis</label>
        </div>
        {(list.error || filters.error) && <p className="form-error">{list.error || filters.error}</p>}
        {!list.data && !list.error ? (
          <LoadingBlock />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{canEdit && <input type="checkbox" aria-label="Tout sélectionner" checked={allChosen} disabled={!selectable.length} onChange={() => setSelection(allChosen ? new Set() : new Set(selectable.map((row) => row.personneId)))} />}</th>
                  <th>Étudiant</th><th>Matricule</th><th>Classe / filière</th><th>Accès</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const current = state(row);
                  return (
                    <tr key={row.personneId}>
                      <td>{canEdit && row.etat !== "ACTIF" && (replace || !row.codeEnCours) && <input type="checkbox" aria-label={`Sélectionner ${row.nom} ${row.prenom}`} checked={selection.has(row.personneId)} onChange={() => toggle(row.personneId)} />}</td>
                      <td className="strong-cell">{row.nom} {row.prenom}</td>
                      <td>{row.matricule ?? "—"}</td>
                      <td>{row.classe ?? [row.filiere, row.niveau].filter(Boolean).join(" · ")}</td>
                      <td><Badge tone={current.tone}>{current.label}</Badge>{row.codeEnCours && row.codeExpireLe && <small className="cell-detail">valable jusqu&apos;au {formatDate(row.codeExpireLe)}</small>}</td>
                    </tr>
                  );
                })}
                {list.data && !rows.length && <Empty columns={5}>Aucun étudiant à afficher : tous ont peut-être déjà activé leur accès.</Empty>}
              </tbody>
            </table>
          </div>
        )}
        <p className="panel-subtitle"><KeyRound size={13} aria-hidden="true" /> Par sécurité, un code déjà remis et encore valable n&apos;est jamais régénéré. Pour un étudiant qui a perdu sa fiche, cochez « Remplacer aussi les codes déjà remis » et sélectionnez-le seul.</p>
      </Panel>
    </div>
  );
}
