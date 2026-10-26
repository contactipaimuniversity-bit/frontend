"use client";

import { useState } from "react";
import { CircleAlert, CircleCheckBig, Clock3, Wallet } from "lucide-react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { Badge, Empty, PageIntro, Panel, send, useAction, useLoad } from "@/components/ui-kit";
import { hasAccess } from "@/lib/access";
import { User, formatMoney, statusLabels } from "@/lib/types";

type Statut = "EN_ATTENTE" | "VALIDE" | "NON_RECU";
type Ligne = {
  id: string;
  numeroRecu: string | null;
  datePaiement: string;
  montant: number;
  typePaiement: string;
  modePaiement: string;
  caissier: string | null;
  personne: { nom: string; prenom: string; matricule?: string | null } | null;
  dossier: string;
  objet: string | null;
  annule: boolean;
  statutRemise: Statut;
  remiseTraiteeLe: string | null;
  remiseTraiteeParNom: string | null;
  remiseMotif: string | null;
};
type Total = { nombre: number; montant: number };
type Groupe = { caissier: string | null; jour: string; mode: string; total: number; valide: number; enAttente: number; nonRecu: number; nombre: number };
type Remises = { lignes: Ligne[]; tronque: boolean; synthese: { total: Total; valide: Total; enAttente: Total; nonRecu: Total }; parCaissier: Groupe[]; caissiers: string[] };

const MODES: Record<string, string> = { ESPECES: "Espèces", MOBILE_MONEY: "Mobile money", VIREMENT: "Virement", CHEQUE: "Chèque" };
const STATUTS: Record<Statut, { label: string; tone: "ok" | "wait" | "bad" }> = {
  VALIDE: { label: "Validé", tone: "ok" },
  EN_ATTENTE: { label: "En attente", tone: "wait" },
  NON_RECU: { label: "Non reçu", tone: "bad" },
};

// Dates du jour en heure locale (AAAA-MM-JJ).
const day = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const PRESETS: Array<{ key: string; label: string; range: () => [string, string] }> = [
  { key: "aujourdhui", label: "Aujourd'hui", range: () => [day(), day()] },
  { key: "hier", label: "Hier", range: () => [day(-1), day(-1)] },
  { key: "avant-hier", label: "Avant-hier", range: () => [day(-2), day(-2)] },
  { key: "semaine", label: "7 derniers jours", range: () => [day(-6), day()] },
  { key: "mois", label: "Ce mois", range: () => [`${day().slice(0, 8)}01`, day()] },
];
const longDay = (value: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
const time = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

// La caisse remet chaque soir l'argent encaissé à la chargée des finances, qui
// confirme ici, encaissement par encaissement ou par lot, ce qu'elle a reçu.
export function PaymentHandoverPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canValidate = hasAccess(user, "payment-validation", "edit");
  const [preset, setPreset] = useState("aujourdhui");
  const [range, setRange] = useState<[string, string]>(() => [day(), day()]);
  const [statut, setStatut] = useState("");
  const [caissier, setCaissier] = useState("");
  const [mode, setMode] = useState("");
  const [type, setType] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const query = new URLSearchParams({ du: range[0], au: range[1], ...(statut ? { statut } : {}), ...(caissier ? { caissier } : {}), ...(mode ? { mode } : {}), ...(type ? { type } : {}), ...(search ? { q: search } : {}) }).toString();
  const data = useLoad<Remises>(`/paiements/remises?${query}`, refreshSignal);
  const action = useAction();
  const remises = data.data;
  const selectable = (ligne: Ligne) => canValidate && !ligne.annule;
  const chosen = (remises?.lignes ?? []).filter((ligne) => selection.includes(ligne.id));
  const chosenTotal = chosen.reduce((sum, ligne) => sum + ligne.montant, 0);
  const choosePreset = (key: string) => {
    const found = PRESETS.find((item) => item.key === key);
    if (found) setRange(found.range());
    setPreset(key);
    setSelection([]);
  };
  const filter = (apply: () => void) => {
    apply();
    setSelection([]);
  };

  const treat = async (lignes: Ligne[], target: Statut, context?: string) => {
    if (!lignes.length) return;
    const total = formatMoney(lignes.reduce((sum, ligne) => sum + ligne.montant, 0));
    let motif: string | null = null;
    if (target === "VALIDE") {
      const ok = await askConfirm({ title: `Confirmer la réception de ${total} ?`, message: `${context ?? `${lignes.length} encaissement(s)`} : vous attestez avoir reçu cet argent (espèces comptées, transfert ou virement vérifié). Votre nom et l'heure sont enregistrés.`, confirmLabel: "Je confirme la réception" });
      if (!ok) return;
    } else {
      motif = await askReason({
        title: target === "NON_RECU" ? `Signaler ${total} comme non reçu ?` : "Remettre en attente de validation ?",
        message: target === "NON_RECU" ? "L'encaissement reste dans les comptes, mais il est signalé comme non remis : la caisse devra s'expliquer." : "La validation est retirée ; l'encaissement repasse en attente.",
        confirmLabel: target === "NON_RECU" ? "Signaler non reçu" : "Remettre en attente",
        danger: target === "NON_RECU",
        reason: { label: target === "NON_RECU" ? "Ce qui manque" : "Pourquoi", minLength: 3, placeholder: target === "NON_RECU" ? "Ex. 20 000 F non remis, transfert introuvable..." : "Ex. validé par erreur" },
      });
      if (!motif) return;
    }
    void action.run(async () => {
      const result = await send<{ traites: number }>("/paiements/remises", "POST", { ids: lignes.map((ligne) => ligne.id), statut: target, motif }, true);
      toast(`${result.traites} encaissement(s) ${target === "VALIDE" ? "validé(s)" : target === "NON_RECU" ? "signalé(s) non reçu(s)" : "remis en attente"}.`);
      setSelection([]);
      data.reload();
    });
  };
  const pendingOf = (groupe: Groupe) => (remises?.lignes ?? []).filter((ligne) => !ligne.annule && ligne.statutRemise === "EN_ATTENTE" && (ligne.caissier ?? null) === groupe.caissier && ligne.modePaiement === groupe.mode && new Date(new Date(ligne.datePaiement).getTime() + 3600_000).toISOString().slice(0, 10) === groupe.jour);
  const toggleAll = () => {
    const ids = (remises?.lignes ?? []).filter(selectable).map((ligne) => ligne.id);
    setSelection(selection.length === ids.length ? [] : ids);
  };
  const stats = remises?.synthese;

  return (
    <div className="content-scroll handover">
      <PageIntro eyebrow="Finances" title="Validation des encaissements" text="Chaque soir, la caisse remet l'argent encaissé. Vérifiez-le, puis validez : chaque encaissement passe de « En attente » à « Validé », ou « Non reçu » s'il manque quelque chose." />

      <div className="handover-periods" role="group" aria-label="Période">
        {PRESETS.map((item) => <button key={item.key} type="button" className={preset === item.key ? "active" : ""} aria-pressed={preset === item.key} onClick={() => choosePreset(item.key)}>{item.label}</button>)}
        <label className="print-date-filter">Du<input type="date" value={range[0]} max={range[1]} onChange={(event) => { setPreset(""); setRange([event.target.value, range[1]]); setSelection([]); }} /></label>
        <label className="print-date-filter">au<input type="date" value={range[1]} min={range[0]} onChange={(event) => { setPreset(""); setRange([range[0], event.target.value]); setSelection([]); }} /></label>
      </div>

      <div className="stats-grid handover-stats">
        <article className="stat-card blue"><span><Wallet size={15} aria-hidden="true" /> Encaissé</span><strong>{stats ? formatMoney(stats.total.montant) : "…"}</strong><p>{stats ? `${stats.total.nombre} encaissement(s) sur la période` : "sur la période"}</p></article>
        <article className="stat-card mint"><span><CircleCheckBig size={15} aria-hidden="true" /> Validé</span><strong>{stats ? formatMoney(stats.valide.montant) : "…"}</strong><p>{stats ? `${stats.valide.nombre} reçu(s) et confirmé(s)` : ""}</p></article>
        <article className={`stat-card ${stats?.enAttente.nombre ? "orange" : "mint"}`}><span><Clock3 size={15} aria-hidden="true" /> En attente</span><strong>{stats ? formatMoney(stats.enAttente.montant) : "…"}</strong><p>{stats ? `${stats.enAttente.nombre} à vérifier` : ""}</p></article>
        <article className={`stat-card ${stats?.nonRecu.nombre ? "orange" : "violet"}`}><span><CircleAlert size={15} aria-hidden="true" /> Non reçu</span><strong>{stats ? formatMoney(stats.nonRecu.montant) : "…"}</strong><p>{stats ? `${stats.nonRecu.nombre} signalé(s)` : ""}</p></article>
      </div>
      {(data.error || action.error) && <p className="form-error">{action.error || data.error}</p>}

      <Panel eyebrow="Remises" title="Par caissier, par jour et par mode" subtitle="Ce que chaque caissier doit remettre. « Valider le lot » confirme d'un coup tous ses encaissements en attente de la ligne.">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Jour</th><th>Caissier</th><th>Mode</th><th>Encaissé</th><th>Validé</th><th>En attente</th><th>Non reçu</th><th /></tr></thead>
            <tbody>
              {(remises?.parCaissier ?? []).map((groupe) => {
                const pending = pendingOf(groupe);
                return (
                  <tr key={`${groupe.jour}-${groupe.caissier}-${groupe.mode}`}>
                    <td>{longDay(groupe.jour)}</td>
                    <td className="strong-cell">{groupe.caissier ?? "Non renseigné"}<small className="cell-detail">{groupe.nombre} encaissement(s)</small></td>
                    <td>{MODES[groupe.mode] ?? groupe.mode}</td>
                    <td className="strong-cell">{formatMoney(groupe.total)}</td>
                    <td>{groupe.valide ? <Badge tone="ok">{formatMoney(groupe.valide)}</Badge> : "—"}</td>
                    <td>{groupe.enAttente ? <Badge tone="wait">{formatMoney(groupe.enAttente)}</Badge> : "—"}</td>
                    <td>{groupe.nonRecu ? <Badge tone="bad">{formatMoney(groupe.nonRecu)}</Badge> : "—"}</td>
                    <td>{canValidate && pending.length > 0 && <button className="row-action" disabled={action.busy} onClick={() => void treat(pending, "VALIDE", `${groupe.caissier ?? "Caisse"} · ${MODES[groupe.mode] ?? groupe.mode} · ${longDay(groupe.jour)}`)}>Valider le lot</button>}</td>
                  </tr>
                );
              })}
              {!remises?.parCaissier.length && <Empty columns={8}>{remises ? "Aucun encaissement sur cette période." : "Chargement..."}</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        eyebrow="Détail"
        title={`${remises?.lignes.length ?? "--"} encaissement(s)`}
        subtitle={remises?.tronque ? "Seuls les 1 000 premiers sont affichés : resserrez la période." : "Cochez des lignes pour les traiter ensemble."}
        actions={
          <>
            <form className="search-form" onSubmit={(event) => { event.preventDefault(); filter(() => setSearch(draft.trim())); }}>
              <input aria-label="Rechercher un encaissement" placeholder="Nom, n° de reçu..." value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button className="outline-button small">Rechercher</button>
            </form>
            <select aria-label="Statut" value={statut} onChange={(event) => filter(() => setStatut(event.target.value))}>
              <option value="">Tous les statuts</option>
              <option value="EN_ATTENTE">En attente</option>
              <option value="VALIDE">Validés</option>
              <option value="NON_RECU">Non reçus</option>
            </select>
            <select aria-label="Caissier" value={caissier} onChange={(event) => filter(() => setCaissier(event.target.value))}>
              <option value="">Tous les caissiers</option>
              {(remises?.caissiers ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select aria-label="Mode de paiement" value={mode} onChange={(event) => filter(() => setMode(event.target.value))}>
              <option value="">Tous les modes</option>
              {Object.entries(MODES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select aria-label="Nature" value={type} onChange={(event) => filter(() => setType(event.target.value))}>
              <option value="">Toutes natures</option>
              <option value="FRAIS_DEPOT">Frais de dépôt</option>
              <option value="FRAIS_INSCRIPTION">Frais d&apos;inscription</option>
              <option value="ECHEANCE_BOURSE">Échéances de bourse</option>
            </select>
          </>
        }
      >
        {canValidate && chosen.length > 0 && (
          <div className="handover-bulk" role="region" aria-label="Sélection">
            <strong>{chosen.length} sélectionné(s) · {formatMoney(chosenTotal)}</strong>
            <button className="primary-button compact" disabled={action.busy} onClick={() => void treat(chosen, "VALIDE")}>Valider la sélection</button>
            <button className="danger-button" disabled={action.busy} onClick={() => void treat(chosen, "NON_RECU")}>Non reçu</button>
            <button className="text-button" onClick={() => setSelection([])}>Désélectionner</button>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {canValidate && <th><input type="checkbox" aria-label="Tout sélectionner" checked={Boolean(remises?.lignes.filter(selectable).length) && selection.length === remises?.lignes.filter(selectable).length} onChange={toggleAll} /></th>}
                <th>Date</th><th>Reçu</th><th>Étudiant</th><th>Objet</th><th>Mode</th><th>Caissier</th><th>Montant</th><th>Statut</th>{canValidate && <th />}
              </tr>
            </thead>
            <tbody>
              {(remises?.lignes ?? []).map((ligne) => {
                const state = STATUTS[ligne.statutRemise];
                return (
                  <tr key={ligne.id} className={ligne.annule ? "muted-row" : undefined}>
                    {canValidate && <td>{selectable(ligne) && <input type="checkbox" aria-label={`Sélectionner ${ligne.numeroRecu ?? "l'encaissement"}`} checked={selection.includes(ligne.id)} onChange={(event) => setSelection((current) => (event.target.checked ? [...current, ligne.id] : current.filter((id) => id !== ligne.id)))} />}</td>}
                    <td>{time(ligne.datePaiement)}</td>
                    <td>{ligne.numeroRecu ?? "—"}</td>
                    <td className="strong-cell">{ligne.personne ? `${ligne.personne.nom.toUpperCase()} ${ligne.personne.prenom}` : "—"}<small className="cell-detail">{ligne.dossier}</small></td>
                    <td>{ligne.objet ?? statusLabels[ligne.typePaiement] ?? ligne.typePaiement}</td>
                    <td>{MODES[ligne.modePaiement] ?? ligne.modePaiement}</td>
                    <td>{ligne.caissier ?? "—"}</td>
                    <td className="strong-cell">{formatMoney(ligne.montant)}</td>
                    <td>
                      {ligne.annule ? <Badge tone="off">Annulé</Badge> : <Badge tone={state.tone}>{state.label}</Badge>}
                      {ligne.remiseTraiteeParNom && <small className="cell-detail">{ligne.remiseTraiteeParNom}{ligne.remiseTraiteeLe ? ` · ${time(ligne.remiseTraiteeLe)}` : ""}</small>}
                      {ligne.remiseMotif && <small className="cell-detail">{ligne.remiseMotif}</small>}
                    </td>
                    {canValidate && (
                      <td className="action-group">
                        {!ligne.annule && ligne.statutRemise !== "VALIDE" && <button className="row-action" disabled={action.busy} onClick={() => void treat([ligne], "VALIDE", `${ligne.numeroRecu ?? "Encaissement"} · ${ligne.caissier ?? "caisse"}`)}>Valider</button>}
                        {!ligne.annule && ligne.statutRemise === "EN_ATTENTE" && <button className="row-action danger-row-action" disabled={action.busy} onClick={() => void treat([ligne], "NON_RECU")}>Non reçu</button>}
                        {!ligne.annule && ligne.statutRemise !== "EN_ATTENTE" && <button className="row-action" disabled={action.busy} onClick={() => void treat([ligne], "EN_ATTENTE")}>Remettre en attente</button>}
                      </td>
                    )}
                  </tr>
                );
              })}
              {!remises?.lignes.length && <Empty columns={canValidate ? 10 : 8}>{remises ? "Aucun encaissement ne correspond à ces filtres." : "Chargement..."}</Empty>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
