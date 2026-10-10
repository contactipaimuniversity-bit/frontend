"use client";

import { FormEvent, useState } from "react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { API_URL } from "@/lib/offline";
import { FiscalYear, User, formatDate, formatMoney } from "@/lib/types";
import { BookOpenText, ChartNoAxesCombined, ListTree, NotebookText, Scale } from "lucide-react";
import { Badge, Empty, FormActions, HubBack, HubCard, HubCards, Modal, PageIntro, Panel, dateTime, downloadPdf, messageOf, send, today, useAction, useForm, useLoad } from "@/components/ui-kit";

type Account = { id: string; numero: string; libelle: string; classe: number; actif: boolean };
type EntryLine = { id: string; libelle?: string | null; debit: string; credit: string; compte: Account };
type Entry = { id: string; numero: string; journal: string; date: string; libelle: string; reference?: string | null; sourceType: string; statut: string; extourneParId?: string | null; creeParNom: string; lignes: EntryLine[] };
type Journal = { data: Entry[]; meta: { page: number; total: number; totalPages: number }; journaux: Record<string, string> };
type Balance = { lignes: Array<{ compteId: string; numero: string; libelle: string; debit: number; credit: number; soldeDebiteur: number; soldeCrediteur: number }>; totaux: { debit: number; credit: number; soldeDebiteur: number; soldeCrediteur: number } };
type Ledger = { compte: Account; report: number; solde: number; lignes: Array<{ id: string; date: string; numero: string; journal: string; libelle: string; reference?: string | null; debit: number; credit: number; solde: number }> };
type Amount = { numero: string; libelle: string; montant: number };
type Statements = {
  resultat: { charges: Amount[]; produits: Amount[]; totalCharges: number; totalProduits: number; resultat: number };
  bilan: { actif: Amount[]; passif: Amount[]; totalActif: number; totalPassif: number; resultat: number };
  tresorerie: { caisse: number; banque: number; mobileMoney: number; dettesFournisseurs: number; dettesPersonnel: number; dettesSociales: number };
};

const SOURCES: Record<string, string> = {
  MANUELLE: "Saisie manuelle",
  PAIEMENT: "Encaissement étudiant",
  FACTURE_DEPENSE: "Facture de dépense",
  DECAISSEMENT: "Paiement de dépense",
  PAIE: "Paie du mois",
  PAIE_PAIEMENT: "Versement des salaires",
  EXTOURNE: "Extourne",
};
const CLASSES: Record<number, string> = { 1: "Capitaux", 2: "Immobilisations", 3: "Stocks", 4: "Tiers", 5: "Trésorerie", 6: "Charges", 7: "Produits", 8: "Autres" };

// Période consultée : un exercice, ou des dates libres.
function usePeriod(signal: number) {
  const years = useLoad<FiscalYear[]>("/finances/exercices", signal);
  const [yearId, setYearId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (yearId) params.set("exerciceId", yearId);
  if (from) params.set("du", new Date(`${from}T00:00:00`).toISOString());
  if (to) params.set("au", new Date(`${to}T23:59:59.999`).toISOString());
  const controls = (
    <>
      <select aria-label="Exercice" value={yearId} onChange={(event) => setYearId(event.target.value)}>
        <option value="">Tous les exercices</option>
        {(years.data ?? []).map((year) => <option key={year.id} value={year.id}>{year.libelle}{year.cloture ? " (clôturé)" : ""}</option>)}
      </select>
      <label className="print-date-filter">Du<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="print-date-filter">au<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
    </>
  );
  // Période rappelée en tête des exports.
  const year = (years.data ?? []).find((item) => item.id === yearId);
  const label = [year ? `Exercice ${year.libelle}` : "Tous les exercices", from && `du ${from}`, to && `au ${to}`].filter(Boolean).join(" · ");
  return { query: params.toString(), controls, label };
}

function EntryForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const accounts = useLoad<Account[]>("/comptabilite/comptes");
  const form = useForm({ journal: "OD", date: today(), libelle: "", reference: "" });
  const [lines, setLines] = useState([{ compte: "", debit: "", credit: "" }, { compte: "", debit: "", credit: "" }]);
  const action = useAction();
  const total = (key: "debit" | "credit") => lines.reduce((sum, line) => sum + (Number(line[key]) || 0), 0);
  const balanced = total("debit") > 0 && Math.round(total("debit") * 100) === Math.round(total("credit") * 100);
  const update = (index: number, patch: Partial<(typeof lines)[number]>) => setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/comptabilite/ecritures", "POST", { ...form.values, lignes: lines.filter((line) => line.compte) }, true);
      toast("Écriture enregistrée en brouillon : validez-la pour qu'elle compte.");
      onSaved();
      onClose();
    });
  };
  return (
    <Modal wide title="Nouvelle écriture" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Journal
            <select {...form.bind("journal")}>
              <option value="OD">Opérations diverses</option>
              <option value="CA">Caisse</option>
              <option value="BQ">Banque</option>
              <option value="MM">Mobile money</option>
              <option value="AC">Achats</option>
            </select>
          </label>
          <label>Date<input required type="date" {...form.bind("date")} /></label>
        </div>
        <div className="form-grid">
          <label>Libellé<input required minLength={3} {...form.bind("libelle")} /></label>
          <label>Pièce justificative (référence)<input {...form.bind("reference")} /></label>
        </div>
        <div className="expense-lines">
          <div className="entry-line expense-line-head"><span>Compte</span><span>Débit</span><span>Crédit</span><span /></div>
          {lines.map((line, index) => (
            <div className="entry-line" key={index}>
              <select required aria-label={`Compte ligne ${index + 1}`} value={line.compte} onChange={(event) => update(index, { compte: event.target.value })}>
                <option value="">Sélectionner un compte</option>
                {(accounts.data ?? []).filter((account) => account.actif).map((account) => <option key={account.id} value={account.numero}>{account.numero} · {account.libelle}</option>)}
              </select>
              <input type="number" min="0" step="0.01" aria-label={`Débit ligne ${index + 1}`} value={line.debit} disabled={Boolean(line.credit)} onChange={(event) => update(index, { debit: event.target.value })} />
              <input type="number" min="0" step="0.01" aria-label={`Crédit ligne ${index + 1}`} value={line.credit} disabled={Boolean(line.debit)} onChange={(event) => update(index, { credit: event.target.value })} />
              <button type="button" className="row-action danger-row-action" disabled={lines.length <= 2} aria-label={`Retirer la ligne ${index + 1}`} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>×</button>
            </div>
          ))}
          <div className="expense-line-foot">
            <button type="button" className="row-action" onClick={() => setLines((current) => [...current, { compte: "", debit: "", credit: "" }])}>+ Ajouter une ligne</button>
            <span>Débit <strong>{formatMoney(total("debit"))}</strong> · Crédit <strong>{formatMoney(total("credit"))}</strong> {balanced ? <Badge tone="ok">Équilibrée</Badge> : <Badge tone="bad">Déséquilibrée</Badge>}</span>
          </div>
        </div>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} disabled={!balanced} label="Enregistrer en brouillon" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function JournalTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const period = usePeriod(signal);
  const [journal, setJournal] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const entries = useLoad<Journal>(`/comptabilite/journal?page=${page}&limit=25${journal ? `&journal=${journal}` : ""}${status ? `&statut=${status}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}${period.query ? `&${period.query}` : ""}`, signal);
  const action = useAction();
  const act = (work: () => Promise<unknown>) => void action.run(async () => { await work(); entries.reload(); });
  const reverse = async (entry: Entry) => {
    const motif = await askReason({ title: `Extourner ${entry.numero}`, message: "Une écriture inverse sera créée : rien ne s'efface en comptabilité.", confirmLabel: "Extourner", danger: true, reason: { label: "Motif de l'extourne", minLength: 5 } });
    if (motif) act(() => send(`/comptabilite/ecritures/${entry.id}/extourner`, "POST", { motif }));
  };
  const validate = async (entry: Entry) => {
    if (await askConfirm({ title: `Valider ${entry.numero} ?`, message: "Une écriture validée est définitive.", confirmLabel: "Valider" })) act(() => send(`/comptabilite/ecritures/${entry.id}/valider`, "POST"));
  };
  const meta = entries.data?.meta;
  return (
    <>
      <div className="finance-inline-form">
        <form className="search-form" onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
          <input aria-label="Rechercher une écriture" placeholder="Libellé, numéro, pièce..." value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button className="outline-button small">Rechercher</button>
        </form>
        <select className="expense-select" aria-label="Journal" value={journal} onChange={(event) => { setJournal(event.target.value); setPage(1); }}>
          <option value="">Tous les journaux</option>
          {Object.entries(entries.data?.journaux ?? {}).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <select className="expense-select" aria-label="État" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Toutes</option>
          <option value="VALIDEE">Validées</option>
          <option value="BROUILLON">Brouillons</option>
        </select>
        {period.controls}
        {canEdit && <button className="outline-button small" onClick={() => setCreating(true)}>+ Nouvelle écriture</button>}
      </div>
      {(action.error || entries.error) && <p className="form-error">{action.error || entries.error}</p>}
      <div className="entries">
        {(entries.data?.data ?? []).map((entry) => (
          <article className={`entry ${entry.extourneParId ? "reversed" : ""}`} key={entry.id}>
            <header>
              <div>
                <strong>{entry.numero} · {entry.libelle}</strong>
                <small>{formatDate(entry.date)} · {entries.data?.journaux[entry.journal] ?? entry.journal} · {SOURCES[entry.sourceType] ?? entry.sourceType}{entry.reference ? ` · pièce ${entry.reference}` : ""} · {entry.creeParNom}</small>
              </div>
              <span className="action-group">
                {entry.statut === "BROUILLON" ? <Badge tone="wait">Brouillon</Badge> : entry.extourneParId ? <Badge tone="off">Extournée</Badge> : <Badge tone="ok">Validée</Badge>}
                {canEdit && entry.statut === "BROUILLON" && <button className="row-action" onClick={() => void validate(entry)}>Valider</button>}
                {canEdit && entry.statut === "BROUILLON" && <button className="row-action danger-row-action" onClick={() => act(() => send(`/comptabilite/ecritures/${entry.id}`, "DELETE"))}>Supprimer</button>}
                {canEdit && entry.statut === "VALIDEE" && entry.sourceType === "MANUELLE" && !entry.extourneParId && <button className="row-action" onClick={() => void reverse(entry)}>Extourner</button>}
              </span>
            </header>
            <table>
              <tbody>
                {entry.lignes.map((line) => (
                  <tr key={line.id}>
                    <td className={Number(line.credit) > 0 ? "entry-credit" : ""}>{line.compte.numero} · {line.compte.libelle}</td>
                    <td>{Number(line.debit) > 0 ? formatMoney(line.debit) : ""}</td>
                    <td>{Number(line.credit) > 0 ? formatMoney(line.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
        {entries.data && !entries.data.data.length && <p className="empty-state">Aucune écriture sur cette sélection.</p>}
        {!entries.data && !entries.error && <p className="empty-state">Mise à jour des écritures...</p>}
      </div>
      {meta && meta.totalPages > 1 && (
        <div className="pagination-bar">
          <span>Page {meta.page} sur {meta.totalPages} · {meta.total} écriture(s)</span>
          <div className="pagination-actions">
            <button className="outline-button small" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>Précédente</button>
            <button className="outline-button small" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>Suivante</button>
          </div>
        </div>
      )}
      {creating && <EntryForm onClose={() => setCreating(false)} onSaved={entries.reload} />}
    </>
  );
}

function BalanceTab({ signal, onOpenAccount }: { signal: number; onOpenAccount: (numero: string) => void }) {
  const period = usePeriod(signal);
  const balance = useLoad<Balance>(`/comptabilite/balance${period.query ? `?${period.query}` : ""}`, signal);
  const data = balance.data;
  return (
    <>
      <div className="finance-inline-form">
        {period.controls}
        <button className="outline-button small" onClick={() => data && downloadPdf("balance.pdf", "Balance des comptes", period.label, [["Compte", "Libellé", "Débit", "Crédit", "Solde débiteur", "Solde créditeur"], ...data.lignes.map((line) => [line.numero, line.libelle, line.debit, line.credit, line.soldeDebiteur, line.soldeCrediteur]), ["", "TOTAL", data.totaux.debit, data.totaux.credit, data.totaux.soldeDebiteur, data.totaux.soldeCrediteur]])}>Exporter en PDF</button>
      </div>
      {balance.error && <p className="form-error">{balance.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Compte</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Solde débiteur</th><th>Solde créditeur</th></tr></thead>
          <tbody>
            {(data?.lignes ?? []).map((line) => (
              <tr key={line.compteId}>
                <td><button className="dossier-open-button" onClick={() => onOpenAccount(line.numero)}>{line.numero}</button></td>
                <td>{line.libelle}</td>
                <td>{formatMoney(line.debit)}</td>
                <td>{formatMoney(line.credit)}</td>
                <td>{line.soldeDebiteur ? formatMoney(line.soldeDebiteur) : ""}</td>
                <td>{line.soldeCrediteur ? formatMoney(line.soldeCrediteur) : ""}</td>
              </tr>
            ))}
            {data && data.lignes.length > 0 && (
              <tr className="total-row"><td /><td className="strong-cell">Totaux</td><td className="strong-cell">{formatMoney(data.totaux.debit)}</td><td className="strong-cell">{formatMoney(data.totaux.credit)}</td><td className="strong-cell">{formatMoney(data.totaux.soldeDebiteur)}</td><td className="strong-cell">{formatMoney(data.totaux.soldeCrediteur)}</td></tr>
            )}
            {!data?.lignes.length && <Empty columns={6}>{data ? "Aucun mouvement sur cette période." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LedgerTab({ signal, account, onAccount }: { signal: number; account: string; onAccount: (numero: string) => void }) {
  const accounts = useLoad<Account[]>("/comptabilite/comptes", signal);
  const period = usePeriod(signal);
  const selected = account || "571";
  const ledger = useLoad<Ledger>(`/comptabilite/grand-livre?compte=${selected}${period.query ? `&${period.query}` : ""}`, signal);
  const data = ledger.data;
  return (
    <>
      <div className="finance-inline-form">
        <select className="expense-select" aria-label="Compte" value={selected} onChange={(event) => onAccount(event.target.value)}>
          {(accounts.data ?? []).map((item) => <option key={item.id} value={item.numero}>{item.numero} · {item.libelle}</option>)}
        </select>
        {period.controls}
        <button className="outline-button small" onClick={() => data && downloadPdf(`grand-livre-${data.compte.numero}.pdf`, `Grand livre · compte ${data.compte.numero}`, period.label, [["Date", "Écriture", "Journal", "Libellé", "Pièce", "Débit", "Crédit", "Solde"], ...data.lignes.map((line) => [line.date.slice(0, 10), line.numero, line.journal, line.libelle, line.reference, line.debit, line.credit, line.solde])])}>Exporter en PDF</button>
      </div>
      {ledger.error && <p className="form-error">{ledger.error}</p>}
      {data && <p className="panel-subtitle">{data.compte.numero} · {data.compte.libelle} — solde à l&apos;ouverture : {formatMoney(data.report)} · solde à la clôture : <strong>{formatMoney(data.solde)}</strong> ({data.solde >= 0 ? "débiteur" : "créditeur"})</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Écriture</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Solde</th></tr></thead>
          <tbody>
            {(data?.lignes ?? []).map((line) => (
              <tr key={line.id}>
                <td>{formatDate(line.date)}</td>
                <td className="strong-cell">{line.numero}</td>
                <td>{line.libelle}{line.reference && <small className="cell-detail">Pièce {line.reference}</small>}</td>
                <td>{line.debit ? formatMoney(line.debit) : ""}</td>
                <td>{line.credit ? formatMoney(line.credit) : ""}</td>
                <td>{formatMoney(line.solde)}</td>
              </tr>
            ))}
            {!data?.lignes.length && <Empty columns={6}>{data ? "Aucun mouvement sur ce compte." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AmountList({ title, items, total, totalLabel }: { title: string; items: Amount[]; total: number; totalLabel: string }) {
  return (
    <div className="statement">
      <h4>{title}</h4>
      <table>
        <tbody>
          {items.map((item) => <tr key={item.numero}><td>{item.numero} · {item.libelle}</td><td>{formatMoney(item.montant)}</td></tr>)}
          {!items.length && <tr><td colSpan={2} className="cell-detail">Aucun montant</td></tr>}
          <tr className="total-row"><td className="strong-cell">{totalLabel}</td><td className="strong-cell">{formatMoney(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function StatementsTab({ signal }: { signal: number }) {
  const period = usePeriod(signal);
  const statements = useLoad<Statements>(`/comptabilite/etats${period.query ? `?${period.query}` : ""}`, signal);
  const data = statements.data;
  return (
    <>
      <div className="finance-inline-form">{period.controls}</div>
      {statements.error && <p className="form-error">{statements.error}</p>}
      {!data && !statements.error && <p className="empty-state">Chargement...</p>}
      {data && (
        <>
          <div className="stats-grid">
            <article className={`stat-card ${data.resultat.resultat >= 0 ? "mint" : "orange"}`}><span>Résultat de la période</span><strong>{formatMoney(data.resultat.resultat)}</strong><p>{data.resultat.resultat >= 0 ? "Excédent" : "Déficit"} : produits moins charges</p></article>
            <article className="stat-card blue"><span>Trésorerie disponible</span><strong>{formatMoney(data.tresorerie.caisse + data.tresorerie.banque + data.tresorerie.mobileMoney)}</strong><p>Caisse {formatMoney(data.tresorerie.caisse)} · banque {formatMoney(data.tresorerie.banque)} · mobile money {formatMoney(data.tresorerie.mobileMoney)}</p></article>
            <article className="stat-card violet"><span>Dettes à régler</span><strong>{formatMoney(data.tresorerie.dettesFournisseurs + data.tresorerie.dettesPersonnel + data.tresorerie.dettesSociales)}</strong><p>Fournisseurs {formatMoney(data.tresorerie.dettesFournisseurs)} · personnel {formatMoney(data.tresorerie.dettesPersonnel)} · cotisations et impôts {formatMoney(data.tresorerie.dettesSociales)}</p></article>
          </div>
          <h3 className="statement-title">Compte de résultat</h3>
          <div className="statement-grid">
            <AmountList title="Charges" items={data.resultat.charges} total={data.resultat.totalCharges} totalLabel="Total des charges" />
            <AmountList title="Produits" items={data.resultat.produits} total={data.resultat.totalProduits} totalLabel="Total des produits" />
          </div>
          <h3 className="statement-title">Bilan simplifié</h3>
          <div className="statement-grid">
            <AmountList title="Actif (ce que l'établissement possède)" items={data.bilan.actif} total={data.bilan.totalActif} totalLabel="Total de l'actif" />
            <AmountList title="Passif (ce qu'il doit, et son résultat)" items={[...data.bilan.passif, { numero: "13", libelle: "Résultat de la période", montant: data.bilan.resultat }]} total={data.bilan.totalPassif} totalLabel="Total du passif" />
          </div>
        </>
      )}
    </>
  );
}

function ChartTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const accounts = useLoad<Account[]>("/comptabilite/comptes", signal);
  const form = useForm({ numero: "", libelle: "" });
  const action = useAction();
  const call = (work: () => Promise<unknown>) => void action.run(async () => { await work(); accounts.reload(); });
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send("/comptabilite/comptes", "POST", form.values); form.setValues({ numero: "", libelle: "" }); }); }}>
          <input required pattern="[1-8][0-9]{1,9}" placeholder="Numéro (ex. 6058)" aria-label="Numéro de compte" {...form.bind("numero")} />
          <input required minLength={2} placeholder="Libellé du compte" aria-label="Libellé du compte" {...form.bind("libelle")} />
          <button className="outline-button small" disabled={action.busy}>Ajouter le compte</button>
        </form>
      )}
      {(action.error || accounts.error) && <p className="form-error">{action.error || accounts.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Compte</th><th>Libellé</th><th>Classe</th><th>État</th><th /></tr></thead>
          <tbody>
            {(accounts.data ?? []).map((account) => (
              <tr key={account.id}>
                <td className="strong-cell">{account.numero}</td>
                <td>{account.libelle}</td>
                <td>{account.classe} · {CLASSES[account.classe]}</td>
                <td><Badge tone={account.actif ? "ok" : "off"}>{account.actif ? "Utilisable" : "Désactivé"}</Badge></td>
                <td>{canEdit && <button className="row-action" onClick={() => call(() => send(`/comptabilite/comptes/${account.id}`, "PATCH", { actif: !account.actif }))}>{account.actif ? "Désactiver" : "Réactiver"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AccountingPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  type Tab = "journal" | "balance" | "livre" | "etats" | "plan";
  const canEdit = hasAccess(user, "accounting", "edit");
  const [tab, setTab] = useState<Tab | null>(null);
  const [account, setAccount] = useState("");
  // Chiffres clés des cartes ; lire le journal passe aussi les écritures en attente.
  const journal = useLoad<Journal>("/comptabilite/journal?page=1&limit=1", refreshSignal);
  const balance = useLoad<Balance>(tab ? null : "/comptabilite/balance", refreshSignal);
  const statements = useLoad<Statements>(tab ? null : "/comptabilite/etats", refreshSignal);
  const accounts = useLoad<Account[]>(tab ? null : "/comptabilite/comptes", refreshSignal);
  const titles: Record<Tab, [string, string]> = {
    journal: ["Journal", "Toutes les écritures, dans l'ordre. Celles de la gestion arrivent toutes seules."],
    balance: ["Balance", "Le total des mouvements et le solde de chaque compte."],
    livre: ["Grand livre", "Le détail des mouvements d'un compte, avec son solde progressif."],
    etats: ["États financiers", "Résultat, trésorerie et bilan simplifié de la période."],
    plan: ["Plan comptable", "Les comptes utilisables, inspirés du SYSCOHADA."],
  };
  const treasury = statements.data ? statements.data.tresorerie.caisse + statements.data.tresorerie.banque + statements.data.tresorerie.mobileMoney : null;
  const result = statements.data?.resultat.resultat;
  const unbalanced = balance.data ? Math.abs(balance.data.totaux.debit - balance.data.totaux.credit) >= 0.01 : false;
  const cards: HubCard<Tab>[] = [
    { key: "journal", icon: BookOpenText, title: "Journal", value: journal.data ? `${journal.data.meta.total}` : "…", detail: "écriture(s) enregistrée(s)", info: "Toutes les écritures, de la plus récente à la plus ancienne. Celles des encaissements, factures, paiements et paies arrivent toutes seules ; vous n'y saisissez à la main que les opérations exceptionnelles, que vous pouvez ensuite valider ou extourner." },
    { key: "balance", icon: Scale, title: "Balance", value: balance.data ? formatMoney(balance.data.totaux.debit) : "…", detail: unbalanced ? "Débits et crédits ne sont pas égaux" : "de mouvements · débits = crédits", tone: unbalanced ? "alert" : undefined, info: "Pour chaque compte, le total de ses débits, de ses crédits et son solde, sur l'exercice ou la période choisie. Le total des débits doit toujours égaler celui des crédits : c'est le premier contrôle à faire." },
    { key: "livre", icon: NotebookText, title: "Grand livre", value: treasury === null ? "…" : formatMoney(treasury), detail: "en trésorerie (caisse, banque, mobile money)", info: "Le détail des mouvements d'un compte, ligne par ligne, avec son solde qui évolue. Choisissez un compte, par exemple la caisse, pour voir d'où vient chaque montant et retrouver une opération." },
    { key: "etats", icon: ChartNoAxesCombined, title: "États financiers", value: result === undefined ? "…" : formatMoney(result), detail: result === undefined ? "résultat" : result < 0 ? "de déficit : charges supérieures aux produits" : "d'excédent : produits moins charges", tone: result !== undefined && result < 0 ? "alert" : undefined, info: "La synthèse : le résultat (produits moins charges), la trésorerie disponible par compte, les dettes en cours et un bilan simplifié. C'est l'écran à montrer à la direction." },
    { key: "plan", icon: ListTree, title: "Plan comptable", value: accounts.data ? `${accounts.data.filter((item) => item.actif).length}` : "…", detail: "compte(s) actif(s)", info: "La liste des comptes utilisables, inspirée du SYSCOHADA et classée par nature (trésorerie, charges, produits…). Ajoutez un compte ou désactivez-en un qui ne sert plus." },
  ];
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Finances" title="Comptabilité" text="Chaque encaissement, facture, paiement et paie validée génère automatiquement son écriture. Vous ne saisissez à la main que les opérations exceptionnelles." />
      {!tab && <HubCards cards={cards} onOpen={setTab} />}
      {tab && (
        <>
          <HubBack label="Comptabilité" onBack={() => setTab(null)} />
          <Panel eyebrow={titles[tab][0]} title={titles[tab][1]}>
            {tab === "journal" && <JournalTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "balance" && <BalanceTab signal={refreshSignal} onOpenAccount={(numero) => { setAccount(numero); setTab("livre"); }} />}
            {tab === "livre" && <LedgerTab signal={refreshSignal} account={account} onAccount={setAccount} />}
            {tab === "etats" && <StatementsTab signal={refreshSignal} />}
            {tab === "plan" && <ChartTab canEdit={canEdit} signal={refreshSignal} />}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------- Sauvegardes ----------

type Backup = { id: string; fichier: string; taille: number; tables: number; lignes: number; dureeMs: number; declenchement: string; statut: string; erreur?: string | null; dateTest?: string | null; resultatTest?: string | null; creeParNom: string; date: string; disponible: boolean; copieExterneLe?: string | null; copieExterneErreur?: string | null };
type Backups = { reglages: { dossier: string; automatique: boolean; heure: number; retention: number; copieExterne: boolean }; derniereReussie: string | null; enRetard: boolean; dernierTest: { date: string; resultat: string } | null; sauvegardes: Backup[] };

const size = (bytes: number) => (bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

export function BackupsPage({ refreshSignal }: { refreshSignal: number }) {
  const backups = useLoad<Backups>("/sauvegardes", refreshSignal);
  const [working, setWorking] = useState("");
  const action = useAction();
  const data = backups.data;
  const create = () =>
    void action.run(async () => {
      setWorking("Sauvegarde en cours...");
      try {
        await send("/sauvegardes", "POST", undefined, true);
        toast("Sauvegarde créée.");
        backups.reload();
      } finally {
        setWorking("");
      }
    });
  const test = async (backup: Backup) => {
    if (!(await askConfirm({ title: "Tester la restauration de cette sauvegarde ?", message: "Le serveur la restaure dans une base temporaire, compare chaque table, puis supprime cette base. Vos données réelles ne sont pas touchées.", confirmLabel: "Lancer le test" }))) return;
    void action.run(async () => {
      setWorking("Test de restauration en cours (cela peut prendre une minute)...");
      try {
        const result = await send<{ reussi: boolean; resultat: string }>(`/sauvegardes/${backup.id}/test`, "POST", undefined, true);
        toast(result.resultat, result.reussi ? "success" : "error");
        backups.reload();
      } finally {
        setWorking("");
      }
    });
  };
  // Le fichier contient toutes les données : il est téléchargé avec la session de l'administrateur.
  const download = (backup: Backup) =>
    void action.run(async () => {
      const response = await fetch(`${API_URL}/sauvegardes/${backup.id}/fichier`, { headers: { Authorization: `Bearer ${window.sessionStorage.getItem("ipaim-token") ?? ""}` } });
      if (!response.ok) throw new Error(messageOf(await response.json().catch(() => null), "Téléchargement impossible."));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = backup.fichier;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Administration" title="Sauvegardes" text="Une copie complète de la base est faite chaque jour. Testez régulièrement qu'elle se restaure : une sauvegarde jamais testée n'est pas une garantie.">
        <button className="primary-button compact" disabled={action.busy} onClick={create}>Sauvegarder maintenant</button>
      </PageIntro>
      {(backups.error || action.error) && <p className="form-error">{backups.error || action.error}</p>}
      {working && <p className="expense-purpose"><span>En cours</span>{working}</p>}
      {data && (
        <>
          <div className="stats-grid">
            <article className={`stat-card ${data.enRetard ? "orange" : "mint"}`}><span>Dernière sauvegarde réussie</span><strong>{data.derniereReussie ? formatDate(data.derniereReussie) : "Aucune"}</strong><p>{data.enRetard ? "Plus de 36 heures sans sauvegarde : lancez-en une maintenant." : data.derniereReussie ? dateTime(data.derniereReussie) : ""}</p></article>
            <article className={`stat-card ${data.dernierTest?.resultat.startsWith("Restauration réussie") ? "mint" : "orange"}`}><span>Dernier test de restauration</span><strong>{data.dernierTest ? formatDate(data.dernierTest.date) : "Jamais testé"}</strong><p>{data.dernierTest?.resultat ?? "Lancez un test sur la dernière sauvegarde."}</p></article>
            <article className="stat-card blue"><span>Planification</span><strong>{data.reglages.automatique ? `Chaque jour après ${data.reglages.heure} h` : "Désactivée"}</strong><p>{data.reglages.retention} fichiers conservés · {data.reglages.dossier}</p></article>
            <article className={`stat-card ${data.reglages.copieExterne ? "mint" : "orange"}`}><span>Copie hors du serveur</span><strong>{data.reglages.copieExterne ? "Activée" : "Non configurée"}</strong><p>{data.reglages.copieExterne ? "Chaque sauvegarde est chiffrée puis déposée chez l'hébergeur de fichiers." : "Définissez BACKUP_ENCRYPTION_KEY sur le serveur (16 caractères au moins) pour l'activer."}</p></article>
          </div>
          <Panel eyebrow="Historique" title={`${data.sauvegardes.length} sauvegarde(s)`} subtitle="Si le serveur est perdu, ses sauvegardes le sont aussi : la copie hors du serveur, chiffrée, est la seule qui survit. Conservez la phrase secrète ailleurs que sur le serveur.">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Origine</th><th>Contenu</th><th>État</th><th>Copie externe</th><th>Test de restauration</th><th /></tr></thead>
                <tbody>
                  {data.sauvegardes.map((backup) => (
                    <tr key={backup.id}>
                      <td className="strong-cell">{dateTime(backup.date)}<small className="cell-detail">{backup.creeParNom}</small></td>
                      <td>{backup.declenchement === "AUTO" ? "Automatique" : "Manuelle"}</td>
                      <td>{backup.statut === "REUSSIE" ? <>{backup.lignes.toLocaleString("fr-FR")} lignes · {backup.tables} tables<small className="cell-detail">{size(backup.taille)} · {(backup.dureeMs / 1000).toFixed(1)} s</small></> : "—"}</td>
                      <td>{backup.statut === "REUSSIE" ? <Badge tone={backup.disponible ? "ok" : "off"}>{backup.disponible ? "Disponible" : "Fichier retiré"}</Badge> : <><Badge tone="bad">Échec</Badge><small className="cell-detail">{backup.erreur}</small></>}</td>
                      <td>{backup.copieExterneLe ? <><Badge tone="ok">Déposée</Badge><small className="cell-detail">{dateTime(backup.copieExterneLe)}</small></> : backup.copieExterneErreur ? <><Badge tone="bad">Échec</Badge><small className="cell-detail">{backup.copieExterneErreur}</small></> : <small className="cell-detail">Aucune</small>}</td>
                      <td>{backup.dateTest ? <><Badge tone={backup.resultatTest?.startsWith("Restauration réussie") ? "ok" : "bad"}>{backup.resultatTest?.startsWith("Restauration réussie") ? "Réussi" : "Échec"}</Badge><small className="cell-detail">{dateTime(backup.dateTest)} · {backup.resultatTest}</small></> : <small className="cell-detail">Non testée</small>}</td>
                      <td className="action-group">
                        {backup.disponible && <button className="row-action" disabled={action.busy} onClick={() => void test(backup)}>Tester</button>}
                        {backup.disponible && <button className="row-action" disabled={action.busy} onClick={() => download(backup)}>Télécharger</button>}
                        {backup.disponible && data.reglages.copieExterne && !backup.copieExterneLe && <button className="row-action" disabled={action.busy} onClick={() => void action.run(async () => { await send(`/sauvegardes/${backup.id}/copie-externe`, "POST", undefined, true); backups.reload(); })}>Copier hors serveur</button>}
                      </td>
                    </tr>
                  ))}
                  {!data.sauvegardes.length && <Empty columns={7}>Aucune sauvegarde pour l&apos;instant.</Empty>}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel eyebrow="En cas de sinistre" title="Restaurer une sauvegarde">
            <ol className="finance-fixed-rules">
              <li>Préparez une base vide et appliquez-y les migrations de l&apos;application.</li>
              <li>Sur le serveur, lancez : <code>npm run sauvegarde:restaurer -- chemin/du/fichier.sauvegarde.gz --confirmer --ecraser</code></li>
              <li>La commande refuse de s&apos;exécuter sans <code>--confirmer</code>, et de remplacer des données existantes sans <code>--ecraser</code>.</li>
              <li>Elle contrôle ensuite, table par table, que tout a été restauré.</li>
              <li>Pour repartir d&apos;une copie externe, déchiffrez-la d&apos;abord : <code>npm run sauvegarde:dechiffrer -- fichier.sauvegarde.gz.chiffre</code> (la phrase secrète est demandée par <code>BACKUP_ENCRYPTION_KEY</code> ou <code>--cle</code>).</li>
            </ol>
          </Panel>
        </>
      )}
    </div>
  );
}
