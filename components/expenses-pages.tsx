"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ActionIcon } from "@/components/action-icon";
import { askConfirm, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { logPrint } from "@/lib/print-log";
import {
  BudgetReport,
  ExpenseCategory,
  ExpenseDetail,
  ExpensePage,
  ExpenseSummary,
  FinanceRules,
  FiscalYear,
  Supplier,
  User,
  formatDate,
  formatMoney,
  pdfSafe,
} from "@/lib/types";

// ---------- Libellés ----------

const STATUS: Record<string, { label: string; tone: string }> = {
  BROUILLON: { label: "Brouillon", tone: "neutre" },
  SOUMISE: { label: "En attente de validation", tone: "en_attente" },
  VALIDATION_FINALE: { label: "En attente de validation finale", tone: "en_attente" },
  VALIDEE: { label: "Validée", tone: "en_cours" },
  RECEPTIONNEE: { label: "Livrée · à facturer", tone: "en_cours" },
  FACTUREE: { label: "Facturée · à payer", tone: "en_cours" },
  PAYEE_PARTIELLEMENT: { label: "Payée en partie", tone: "en_cours" },
  PAYEE: { label: "Payée", tone: "complete" },
  REJETEE: { label: "Rejetée", tone: "refusee" },
  ANNULEE: { label: "Annulée", tone: "neutre" },
};

const PIECE_LABELS: Record<string, string> = {
  LETTRE_DEMANDE: "Lettre de demande d'achat",
  DEVIS: "Devis",
  BON_LIVRAISON: "Bon de livraison",
  FACTURE: "Facture",
  PREUVE_PAIEMENT: "Preuve de paiement",
  AUTRE: "Autre pièce",
};

const MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile money",
  VIREMENT: "Virement bancaire",
  CHEQUE: "Chèque",
};

const FILE_TYPES = "application/pdf,image/jpeg,image/png,image/webp";

function statusLabel(expense: Pick<ExpenseSummary, "statut" | "categorie">) {
  if (expense.statut === "VALIDEE")
    return expense.categorie.livraisonRequise ? "Validée · à réceptionner" : "Validée · à facturer";
  return STATUS[expense.statut]?.label ?? expense.statut;
}

function StatusBadge({ expense }: { expense: Pick<ExpenseSummary, "statut" | "categorie"> }) {
  return <span className={`status status-${STATUS[expense.statut]?.tone ?? "neutre"}`}>{statusLabel(expense)}</span>;
}

const message = (failure: unknown, fallback: string) => (failure instanceof Error ? failure.message : fallback);
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function multipart(fields: Record<string, string>, file?: File | null) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (file) form.append("fichier", file);
  return form;
}

// Lecture d'une ressource, rechargée à la demande ou quand l'en-tête demande une actualisation.
function useLoad<T>(path: string | null, signal = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    void apiFetch<T>(path)
      .then((value) => {
        if (!active) return;
        setData(value);
        setError("");
      })
      .catch((failure) => {
        if (active) setError(message(failure, "Données indisponibles."));
      });
    return () => {
      active = false;
    };
  }, [path, signal, version]);
  return { data, error, reload: () => setVersion((current) => current + 1) };
}

function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <section className={`modal ${wide ? "expense-modal" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FileField({ label, required, file, existing, onChange }: { label: string; required?: boolean; file: File | null; existing?: { nom: string; url: string } | null; onChange: (file: File | null) => void }) {
  return (
    <label>
      {label}
      <input type="file" accept={FILE_TYPES} required={required && !existing} onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      {existing && !file && (
        <small className="file-current">
          Fichier actuel :{" "}
          <a href={existing.url} target="_blank" rel="noreferrer">
            {existing.nom}
          </a>
        </small>
      )}
    </label>
  );
}

// ---------- Demande : création et correction ----------

type LineDraft = { designation: string; quantite: string; prixUnitaire: string };
const emptyLine = (): LineDraft => ({ designation: "", quantite: "1", prixUnitaire: "" });
const lineTotal = (line: LineDraft) => (Number(line.quantite) || 0) * (Number(line.prixUnitaire) || 0);

function ExpenseForm({ expense, onClose, onSaved }: { expense?: ExpenseDetail; onClose: () => void; onSaved: () => void }) {
  const [saved, setSaved] = useState<ExpenseDetail | undefined>(expense);
  const [form, setForm] = useState({
    objet: expense?.objet ?? "",
    justification: expense?.justification ?? "",
    categorieId: expense?.categorieId ?? "",
    fournisseurId: expense?.fournisseurId ?? "",
  });
  const [lines, setLines] = useState<LineDraft[]>(
    expense?.lignes.length
      ? expense.lignes.map((line) => ({ designation: line.designation, quantite: String(Number(line.quantite)), prixUnitaire: String(Number(line.prixUnitaire)) }))
      : [emptyLine()],
  );
  const [letter, setLetter] = useState<File | null>(null);
  const [quote, setQuote] = useState<File | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([apiFetch<ExpenseCategory[]>("/finances/categories"), apiFetch<Supplier[]>("/finances/fournisseurs")])
      .then(([loadedCategories, loadedSuppliers]) => {
        setCategories(loadedCategories);
        setSuppliers(loadedSuppliers);
      })
      .catch((failure) => setError(message(failure, "Référentiels indisponibles.")));
  }, []);

  const piece = (type: string) => saved?.pieces.find((item) => item.type === type) ?? null;
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const updateLine = (index: number, patch: Partial<LineDraft>) => setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));

  const addSupplier = async () => {
    if (!newSupplier?.trim()) return;
    try {
      const created = await apiFetch<Supplier>("/finances/fournisseurs", { method: "POST", body: JSON.stringify({ nom: newSupplier }), silent: true });
      setSuppliers((current) => [...current, created].sort((a, b) => a.nom.localeCompare(b.nom)));
      setForm((current) => ({ ...current, fournisseurId: created.id }));
      setNewSupplier(null);
    } catch (failure) {
      setError(message(failure, "Fournisseur non enregistré."));
    }
  };

  const save = async (submit: boolean) => {
    if (submit && !form.fournisseurId) return setError("Indiquez le fournisseur ou le bénéficiaire avant de soumettre.");
    if (submit && !(letter || piece("LETTRE_DEMANDE"))) return setError("Joignez la lettre de demande d'achat avant de soumettre.");
    if (submit && !(quote || piece("DEVIS"))) return setError("Joignez le devis avant de soumettre.");
    setBusy(true);
    setError("");
    try {
      const body = JSON.stringify({ ...form, fournisseurId: form.fournisseurId || null, lignes: lines });
      let current = saved
        ? await apiFetch<ExpenseDetail>(`/depenses/${saved.id}`, { method: "PATCH", body, silent: true })
        : await apiFetch<ExpenseDetail>("/depenses", { method: "POST", body, silent: true });
      setSaved(current);
      // Les pièces partent une à une : en cas d'échec, ce qui est déjà envoyé est conservé.
      if (letter) {
        current = await apiFetch<ExpenseDetail>(`/depenses/${current.id}/pieces`, { method: "POST", body: multipart({ type: "LETTRE_DEMANDE" }, letter), silent: true });
        setSaved(current);
        setLetter(null);
      }
      if (quote) {
        current = await apiFetch<ExpenseDetail>(`/depenses/${current.id}/pieces`, { method: "POST", body: multipart({ type: "DEVIS" }, quote), silent: true });
        setSaved(current);
        setQuote(null);
      }
      if (submit) await apiFetch(`/depenses/${current.id}/soumettre`, { method: "POST", silent: true });
      toast(submit ? `Demande ${current.numero} soumise pour validation.` : `Brouillon ${current.numero} enregistré.`);
      onSaved();
      onClose();
    } catch (failure) {
      setError(message(failure, "Enregistrement impossible."));
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title={saved ? `Demande ${saved.numero}` : "Nouvelle demande de dépense"} onClose={onClose}>
      <form
        className="entity-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void save(true);
        }}
      >
        <label>
          Objet de la dépense
          <input required minLength={3} maxLength={200} placeholder="Ex. Achat de 20 chaises pour la salle B" value={form.objet} onChange={(event) => setForm({ ...form, objet: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            Catégorie budgétaire
            <select required value={form.categorieId} onChange={(event) => setForm({ ...form, categorieId: event.target.value })}>
              <option value="">Sélectionner une catégorie</option>
              {categories
                .filter((category) => category.actif || category.id === form.categorieId)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nom}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Fournisseur / bénéficiaire
            {newSupplier === null ? (
              <select
                value={form.fournisseurId}
                onChange={(event) => {
                  if (event.target.value === "__new") setNewSupplier("");
                  else setForm({ ...form, fournisseurId: event.target.value });
                }}
              >
                <option value="">Sélectionner un fournisseur</option>
                {suppliers
                  .filter((supplier) => supplier.actif || supplier.id === form.fournisseurId)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.nom}
                    </option>
                  ))}
                <option value="__new">+ Nouveau fournisseur…</option>
              </select>
            ) : (
              <span className="inline-field">
                <input autoFocus placeholder="Nom du fournisseur" value={newSupplier} onChange={(event) => setNewSupplier(event.target.value)} />
                <button type="button" className="outline-button small" onClick={() => void addSupplier()}>
                  Ajouter
                </button>
                <button type="button" className="row-action" onClick={() => setNewSupplier(null)}>
                  Annuler
                </button>
              </span>
            )}
          </label>
        </div>
        <label>
          À quoi va servir cette dépense ?
          <textarea required minLength={10} maxLength={1000} rows={3} placeholder="Expliquez brièvement le besoin et l'usage prévu." value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} />
        </label>

        <p className="form-section-label">Détail de la demande</p>
        <div className="expense-lines">
          <div className="expense-line expense-line-head">
            <span>Désignation</span>
            <span>Quantité</span>
            <span>Prix unitaire</span>
            <span>Total</span>
            <span />
          </div>
          {lines.map((line, index) => (
            <div className="expense-line" key={index}>
              <input required aria-label={`Désignation ligne ${index + 1}`} placeholder="Article ou prestation" value={line.designation} onChange={(event) => updateLine(index, { designation: event.target.value })} />
              <input required type="number" min="0.01" step="0.01" aria-label={`Quantité ligne ${index + 1}`} value={line.quantite} onChange={(event) => updateLine(index, { quantite: event.target.value })} />
              <input required type="number" min="0.01" step="0.01" aria-label={`Prix unitaire ligne ${index + 1}`} value={line.prixUnitaire} onChange={(event) => updateLine(index, { prixUnitaire: event.target.value })} />
              <strong>{formatMoney(lineTotal(line))}</strong>
              <button type="button" className="row-action danger-row-action" disabled={lines.length === 1} aria-label={`Retirer la ligne ${index + 1}`} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>
                ×
              </button>
            </div>
          ))}
          <div className="expense-line-foot">
            <button type="button" className="row-action" onClick={() => setLines((current) => [...current, emptyLine()])}>
              + Ajouter une ligne
            </button>
            <span>
              Montant total <strong>{formatMoney(total)}</strong>
            </span>
          </div>
        </div>

        <p className="form-section-label">Pièces obligatoires à la soumission</p>
        <div className="form-grid">
          <FileField label="Lettre de demande d'achat" file={letter} existing={piece("LETTRE_DEMANDE")} onChange={setLetter} />
          <FileField label="Devis du fournisseur" file={quote} existing={piece("DEVIS")} onChange={setQuote} />
        </div>
        <p className="panel-subtitle">PDF ou image, 10 Mo maximum. Une fois soumise, la demande n&apos;est plus modifiable.</p>

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="secondary-button" disabled={busy} onClick={(event) => (event.currentTarget.form?.reportValidity() ? void save(false) : undefined)}>
            Enregistrer le brouillon
          </button>
          <button className="primary-button compact" disabled={busy}>
            {busy ? "Envoi..." : "Soumettre pour validation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Bon de commande imprimable ----------

async function printPurchaseOrder(expense: ExpenseDetail) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const text = (value: string, x: number, y: number, options?: { align?: "right" | "center" }) => pdf.text(pdfSafe(value), x, y, options);
  pdf.setFont("helvetica", "bold").setFontSize(16);
  text("IPAIM", 15, 20);
  text("BON DE COMMANDE", 195, 20, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(10);
  text(`N° ${expense.numeroBonCommande ?? "-"}`, 195, 27, { align: "right" });
  text(`Date : ${formatDate(expense.dateBonCommande ?? undefined)}`, 195, 32, { align: "right" });
  text(`Demande : ${expense.numero}`, 15, 27);
  text(`Catégorie : ${expense.categorie.nom}`, 15, 32);
  pdf.setFont("helvetica", "bold");
  text("Fournisseur", 15, 44);
  pdf.setFont("helvetica", "normal");
  text(expense.fournisseur?.nom ?? "-", 15, 49);
  text([expense.fournisseur?.telephone, expense.fournisseur?.adresse].filter(Boolean).join(" · "), 15, 54);
  pdf.setFont("helvetica", "bold");
  text("Objet", 15, 64);
  pdf.setFont("helvetica", "normal");
  pdf.text(pdf.splitTextToSize(pdfSafe(expense.objet), 180) as string[], 15, 69);

  let y = 84;
  pdf.setFont("helvetica", "bold");
  text("Désignation", 15, y);
  text("Qté", 130, y, { align: "right" });
  text("Prix unitaire", 162, y, { align: "right" });
  text("Total", 195, y, { align: "right" });
  pdf.line(15, y + 2, 195, y + 2);
  pdf.setFont("helvetica", "normal");
  for (const line of expense.lignes) {
    y += 8;
    if (y > 250) {
      pdf.addPage();
      y = 20;
    }
    text(line.designation.slice(0, 60), 15, y);
    text(Number(line.quantite).toLocaleString("fr-FR"), 130, y, { align: "right" });
    text(formatMoney(line.prixUnitaire), 162, y, { align: "right" });
    text(formatMoney(Number(line.quantite) * Number(line.prixUnitaire)), 195, y, { align: "right" });
  }
  pdf.line(15, y + 3, 195, y + 3);
  pdf.setFont("helvetica", "bold");
  text("Montant total", 162, y + 10, { align: "right" });
  text(formatMoney(expense.montant), 195, y + 10, { align: "right" });

  y += 26;
  pdf.setFont("helvetica", "normal").setFontSize(9);
  text(`Demandé par : ${expense.initiateurNom} · ${formatDate(expense.dateSoumission ?? undefined)}`, 15, y);
  if (expense.validation1ParNom) text(`Validé par : ${expense.validation1ParNom} · ${formatDate(expense.dateValidation1 ?? undefined)}`, 15, y + 5);
  if (expense.validation2ParNom) text(`Validation finale : ${expense.validation2ParNom} · ${formatDate(expense.dateValidation2 ?? undefined)}`, 15, y + 10);
  text("Signature et cachet", 195, y + 22, { align: "right" });
  pdf.save(`bon-de-commande-${expense.numeroBonCommande ?? expense.numero}.pdf`);
  logPrint({ typeDocument: "BON_COMMANDE", mode: "PDF", dossierType: "depense", dossierId: expense.id, libelle: `${expense.numero} · ${expense.objet}`, reference: expense.numeroBonCommande });
}

// ---------- Fiche d'une dépense ----------

type Panel = "valider" | "rejeter" | "annuler" | "reception" | "facture" | "paiement" | null;

function ExpenseDetailModal({ id, onClose, onChanged, onEdit }: { id: string; onClose: () => void; onChanged: () => void; onEdit: (expense: ExpenseDetail) => void }) {
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    void apiFetch<ExpenseDetail>(`/depenses/${id}`)
      .then(setExpense)
      .catch((failure) => setError(message(failure, "Dépense indisponible.")));
  }, [id]);

  const open = (next: Panel, defaults: Record<string, string> = {}) => {
    setPanel(next);
    setText("");
    setFile(null);
    setFields(defaults);
    setError("");
  };
  const field = (name: string) => ({
    value: fields[name] ?? "",
    onChange: (event: { target: { value: string } }) => setFields((current) => ({ ...current, [name]: event.target.value })),
  });
  const run = async (path: string, body: BodyInit | undefined, done: string) => {
    setBusy(true);
    setError("");
    try {
      setExpense(await apiFetch<ExpenseDetail>(`/depenses/${id}/${path}`, { method: "POST", body, silent: true }));
      setPanel(null);
      toast(done);
      onChanged();
    } catch (failure) {
      setError(message(failure, "Action impossible."));
    } finally {
      setBusy(false);
    }
  };
  const submitPanel = (event: FormEvent) => {
    event.preventDefault();
    if (panel === "valider") void run("valider", JSON.stringify({ commentaire: text }), "Dépense validée.");
    if (panel === "rejeter") void run("rejeter", JSON.stringify({ motif: text }), "Dépense rejetée.");
    if (panel === "annuler") void run("annuler", JSON.stringify({ motif: text }), "Dépense annulée.");
    if (panel === "reception") void run("reception", multipart({ ...fields, commentaire: text }, file), fields.conforme === "true" ? "Livraison réceptionnée." : "Livraison non conforme consignée.");
    if (panel === "facture") void run("facture", multipart(fields, file), "Facture enregistrée.");
    if (panel === "paiement") void run("decaissements", multipart(fields, file), "Paiement enregistré.");
  };

  if (!expense)
    return (
      <Modal wide title="Dépense" onClose={onClose}>
        {error ? <p className="form-error">{error}</p> : <p className="empty-state">Chargement...</p>}
      </Modal>
    );

  const { actions } = expense;
  const validating = ["SOUMISE", "VALIDATION_FINALE"].includes(expense.statut);
  const amountDue = expense.montantFacture ?? expense.montant;
  return (
    <Modal wide title={`${expense.numero} · ${expense.objet}`} onClose={onClose}>
      <div className="expense-detail">
        <div className="expense-detail-head">
          <StatusBadge expense={expense} />
          {expense.niveauxRequis === 2 && <span className="status status-neutre">Double validation</span>}
          {expense.horsBudget && <span className="status status-refusee">Hors budget</span>}
          <strong className="expense-amount">{formatMoney(expense.montant)}</strong>
        </div>

        <dl className="expense-facts">
          <div><dt>Demandeur</dt><dd>{expense.initiateurNom}</dd></div>
          <div><dt>Catégorie</dt><dd>{expense.categorie.nom}</dd></div>
          <div><dt>Fournisseur</dt><dd>{expense.fournisseur?.nom ?? "Non renseigné"}</dd></div>
          <div><dt>Exercice</dt><dd>{expense.exercice?.libelle ?? "À la soumission"}</dd></div>
          {expense.numeroBonCommande && <div><dt>Bon de commande</dt><dd>{expense.numeroBonCommande} · {formatDate(expense.dateBonCommande ?? undefined)}</dd></div>}
          {expense.numeroBonLivraison && <div><dt>Bon de livraison</dt><dd>{expense.numeroBonLivraison} · {formatDate(expense.dateReception ?? undefined)}</dd></div>}
          {expense.numeroFacture && <div><dt>Facture</dt><dd>{expense.numeroFacture} · {formatMoney(amountDue)}</dd></div>}
          {expense.numeroFacture && <div><dt>Payé / reste</dt><dd>{formatMoney(expense.totalPaye)} / {formatMoney(expense.resteAPayer)}</dd></div>}
        </dl>

        <p className="expense-purpose"><span>Utilité</span>{expense.justification}</p>
        {expense.motifRejet && expense.statut === "REJETEE" && <p className="expense-alert"><span>Motif du rejet</span>{expense.motifRejet}</p>}
        {expense.motifAnnulation && <p className="expense-alert"><span>Motif de l&apos;annulation</span>{expense.motifAnnulation}</p>}
        {expense.receptionConforme === false && expense.statut === "VALIDEE" && <p className="expense-alert"><span>Dernière livraison refusée</span>{expense.receptionCommentaire}</p>}
        {validating && expense.budget && (
          <p className="panel-subtitle">
            Budget « {expense.categorie.nom} » : {formatMoney(expense.budget.budget)} · disponible avant cette demande : {formatMoney(expense.budget.disponibleAvant)}
          </p>
        )}

        <div className="table-wrap">
          <table>
            <thead><tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr></thead>
            <tbody>
              {expense.lignes.map((line) => (
                <tr key={line.id}>
                  <td className="strong-cell">{line.designation}</td>
                  <td>{Number(line.quantite).toLocaleString("fr-FR")}</td>
                  <td>{formatMoney(line.prixUnitaire)}</td>
                  <td>{formatMoney(Number(line.quantite) * Number(line.prixUnitaire))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="expense-columns">
          <section>
            <h4>Pièces justificatives</h4>
            {expense.pieces.length ? (
              <ul className="expense-pieces">
                {expense.pieces.map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noreferrer">{PIECE_LABELS[item.type] ?? item.type}</a>
                    <small>{item.nom} · {item.ajouteParNom} · {formatDate(item.date)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-subtitle">Aucune pièce jointe.</p>
            )}
            {expense.decaissements.length > 0 && (
              <>
                <h4>Paiements</h4>
                <ul className="expense-pieces">
                  {expense.decaissements.map((payment) => (
                    <li key={payment.id}>
                      <strong>{formatMoney(payment.montant)} · {MODE_LABELS[payment.mode] ?? payment.mode}</strong>
                      <small>{payment.numero} · {formatDate(payment.datePaiement)} · {payment.payeParNom}{payment.reference ? ` · réf. ${payment.reference}` : ""}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section>
            <h4>Circuit de la dépense</h4>
            <ol className="expense-timeline">
              {expense.historique.map((step) => (
                <li key={step.id}>
                  <strong>{step.action}</strong>
                  <small>{step.utilisateurNom} · {dateTime(step.date)}</small>
                  {step.commentaire && <p>{step.commentaire}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {validating && actions.blocageValidation && !actions.valider && <p className="panel-subtitle">Validation : {actions.blocageValidation}.</p>}
        {actions.blocagePaiement && <p className="panel-subtitle">Paiement : {actions.blocagePaiement}.</p>}
        {error && !panel && <p className="form-error">{error}</p>}

        {!panel && (
          <div className="form-actions expense-actions">
            {expense.numeroBonCommande && expense.statut !== "ANNULEE" && <button className="secondary-button" onClick={() => void printPurchaseOrder(expense)}>Imprimer le bon de commande</button>}
            {actions.annuler && <button className="danger-button" onClick={() => open("annuler")}>Annuler la dépense</button>}
            {actions.modifier && <button className="secondary-button" onClick={() => onEdit(expense)}>Modifier / joindre les pièces</button>}
            {actions.reprendre && <button className="primary-button compact" disabled={busy} onClick={() => void run("reprendre", undefined, "Demande rouverte : corrigez-la puis soumettez-la de nouveau.")}>Reprendre pour correction</button>}
            {actions.soumettre && (
              <button
                className="primary-button compact"
                disabled={busy}
                onClick={async () => {
                  if (await askConfirm({ title: "Soumettre cette demande ?", message: "Elle ne sera plus modifiable et partira en validation.", confirmLabel: "Soumettre" }))
                    void run("soumettre", undefined, "Demande soumise pour validation.");
                }}
              >
                Soumettre pour validation
              </button>
            )}
            {actions.valider && <button className="secondary-button" onClick={() => open("rejeter")}>Rejeter</button>}
            {actions.valider && <button className="primary-button compact" onClick={() => open("valider")}>{expense.statut === "VALIDATION_FINALE" ? "Validation finale" : "Valider"}</button>}
            {actions.receptionner && <button className="primary-button compact" onClick={() => open("reception", { dateReception: today(), conforme: "true" })}>Réceptionner la livraison</button>}
            {actions.facturer && <button className="primary-button compact" onClick={() => open("facture", { dateFacture: today(), montantFacture: String(Number(expense.montant)) })}>Enregistrer la facture</button>}
            {actions.payer && <button className="primary-button compact" onClick={() => open("paiement", { datePaiement: today(), montant: String(Number(expense.resteAPayer)), mode: "ESPECES" })}>Enregistrer un paiement</button>}
          </div>
        )}

        {panel && (
          <form className="entity-form expense-panel" onSubmit={submitPanel}>
            {panel === "valider" && (
              <>
                <p className="form-section-label">{expense.statut === "VALIDATION_FINALE" || expense.niveauxRequis === 1 ? "Valider et émettre le bon de commande" : "Première validation (une validation finale suivra)"}</p>
                <label>Commentaire (facultatif)<textarea rows={2} maxLength={500} value={text} onChange={(event) => setText(event.target.value)} /></label>
              </>
            )}
            {(panel === "rejeter" || panel === "annuler") && (
              <label>
                {panel === "rejeter" ? "Motif du rejet" : "Motif de l'annulation"}
                <textarea required autoFocus minLength={10} maxLength={500} rows={3} value={text} onChange={(event) => setText(event.target.value)} />
              </label>
            )}
            {panel === "reception" && (
              <>
                <p className="form-section-label">Réception de la livraison</p>
                <div className="form-grid">
                  <label>N° du bon de livraison<input required maxLength={80} {...field("numeroBonLivraison")} /></label>
                  <label>Date de réception<input required type="date" max={today()} {...field("dateReception")} /></label>
                </div>
                <label>
                  Livraison conforme à la commande ?
                  <select {...field("conforme")}>
                    <option value="true">Oui, conforme</option>
                    <option value="false">Non, livraison refusée</option>
                  </select>
                </label>
                <label>
                  {fields.conforme === "false" ? "Réserves (obligatoire)" : "Observations (facultatif)"}
                  <textarea rows={2} maxLength={500} required={fields.conforme === "false"} minLength={fields.conforme === "false" ? 10 : undefined} value={text} onChange={(event) => setText(event.target.value)} />
                </label>
                <FileField required label="Bon de livraison signé" file={file} onChange={setFile} />
              </>
            )}
            {panel === "facture" && (
              <>
                <p className="form-section-label">Facture du fournisseur</p>
                <div className="form-grid">
                  <label>N° de facture<input required maxLength={80} {...field("numeroFacture")} /></label>
                  <label>Date de facture<input required type="date" max={today()} {...field("dateFacture")} /></label>
                </div>
                <label>Montant de la facture<input required type="number" min="0.01" step="0.01" max={Number(expense.montant)} {...field("montantFacture")} /></label>
                <p className="panel-subtitle">Maximum : {formatMoney(expense.montant)} (montant validé).</p>
                <FileField required label="Facture" file={file} onChange={setFile} />
              </>
            )}
            {panel === "paiement" && (
              <>
                <p className="form-section-label">Paiement · reste {formatMoney(expense.resteAPayer)}</p>
                <div className="form-grid">
                  <label>Montant payé<input required type="number" min="0.01" step="0.01" max={Number(expense.resteAPayer)} {...field("montant")} /></label>
                  <label>Date du paiement<input required type="date" max={today()} {...field("datePaiement")} /></label>
                </div>
                <div className="form-grid">
                  <label>
                    Mode de paiement
                    <select {...field("mode")}>
                      {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>Référence{fields.mode === "ESPECES" ? " (facultatif)" : ""}<input required={fields.mode !== "ESPECES"} maxLength={120} placeholder="N° de transaction, virement ou chèque" {...field("reference")} /></label>
                </div>
                <FileField label="Preuve de paiement (facultatif)" file={file} onChange={setFile} />
              </>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setPanel(null)}>Retour</button>
              <button className={panel === "rejeter" || panel === "annuler" ? "danger-solid-button" : "primary-button compact"} disabled={busy}>{busy ? "Enregistrement..." : "Confirmer"}</button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

// ---------- Listes ----------

function ExpenseTable({ expenses, empty, extra, onOpen }: { expenses: ExpenseSummary[]; empty: string; extra?: { title: string; render: (expense: ExpenseSummary) => ReactNode }; onOpen: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Objet</th>
            <th>Demandeur</th>
            <th>Fournisseur</th>
            <th>Montant</th>
            <th>{extra?.title ?? "Statut"}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td className="strong-cell">{expense.numero}</td>
              <td>
                <button className="dossier-open-button" onClick={() => onOpen(expense.id)}>{expense.objet}</button>
                <small className="cell-detail">{expense.categorie.nom} · {formatDate(expense.dateSoumission ?? expense.dateCreation)}</small>
              </td>
              <td>{expense.initiateurNom}</td>
              <td>{expense.fournisseur?.nom ?? "—"}</td>
              <td>{formatMoney(expense.montantFacture ?? expense.montant)}</td>
              <td>{extra ? extra.render(expense) : <StatusBadge expense={expense} />}</td>
              <td>
                <button className="row-action icon-action" onClick={() => onOpen(expense.id)} aria-label="Ouvrir la dépense"><ActionIcon name="open" /></button>
              </td>
            </tr>
          ))}
          {!expenses.length && (
            <tr><td colSpan={7} className="empty-state">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Fiche et formulaire partagés par les trois pages du circuit.
function ExpenseModals({ openId, editing, setOpenId, setEditing, onChanged }: { openId: string | null; editing: ExpenseDetail | "new" | null; setOpenId: (id: string | null) => void; setEditing: (value: ExpenseDetail | "new" | null) => void; onChanged: () => void }) {
  return (
    <>
      {openId && (
        <ExpenseDetailModal
          key={openId}
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={onChanged}
          onEdit={(expense) => {
            setOpenId(null);
            setEditing(expense);
          }}
        />
      )}
      {editing && <ExpenseForm expense={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </>
  );
}

export function ExpensesPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const seesAll = (["expense-approval", "expense-final-approval", "expense-payment", "finance-settings"] as const).some((area) => hasAccess(user, area));
  const canCreate = hasAccess(user, "expenses", "edit");
  const [scope, setScope] = useState<"mes" | "toutes">("mes");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseDetail | "new" | null>(null);
  const list = useLoad<ExpensePage>(`/depenses?vue=${scope}&page=${page}&limit=20${status ? `&statut=${status}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`, refreshSignal);
  const counters = useLoad<{ brouillons: number; rejetees: number }>("/depenses/compteurs", refreshSignal);
  const reload = () => {
    list.reload();
    counters.reload();
  };
  const meta = list.data?.meta;
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Finances</p>
          <h2>Demandes de dépense</h2>
          <p>Initiez une dépense, joignez la lettre de demande et le devis, puis suivez son circuit jusqu&apos;au paiement.</p>
        </div>
        {canCreate && <button className="primary-button compact" onClick={() => setEditing("new")}>+ Nouvelle demande</button>}
      </div>
      {counters.data && (counters.data.brouillons > 0 || counters.data.rejetees > 0) && (
        <div className="expense-reminders">
          {counters.data.brouillons > 0 && <button className="row-action" onClick={() => { setScope("mes"); setStatus("BROUILLON"); setPage(1); }}>{counters.data.brouillons} brouillon(s) à soumettre</button>}
          {counters.data.rejetees > 0 && <button className="row-action debt-action" onClick={() => { setScope("mes"); setStatus("REJETEE"); setPage(1); }}>{counters.data.rejetees} demande(s) rejetée(s) à reprendre</button>}
        </div>
      )}
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{scope === "mes" ? "Mes demandes" : "Toutes les dépenses"}</p>
            <h3>{meta?.total ?? "--"} dépense(s)</h3>
          </div>
          <div className="toolbar">
            <form className="search-form" onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
              <input aria-label="Rechercher une dépense" placeholder="N°, objet, fournisseur..." value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button className="outline-button small">Rechercher</button>
            </form>
            {seesAll && (
              <select aria-label="Périmètre" value={scope} onChange={(event) => { setScope(event.target.value as "mes" | "toutes"); setPage(1); }}>
                <option value="mes">Mes demandes</option>
                <option value="toutes">Toutes les dépenses</option>
              </select>
            )}
            <select aria-label="Statut" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </div>
        </div>
        {list.error && <p className="form-error">{list.error}</p>}
        <ExpenseTable expenses={list.data?.data ?? []} empty={list.data ? "Aucune dépense." : "Chargement..."} onOpen={setOpenId} />
        {meta && meta.totalPages > 1 && (
          <div className="pagination-bar">
            <span>Page {meta.page} sur {meta.totalPages} · {meta.total} dépense(s)</span>
            <div className="pagination-actions">
              <button className="outline-button small" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>Précédente</button>
              <button className="outline-button small" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>Suivante</button>
            </div>
          </div>
        )}
      </section>
      <ExpenseModals openId={openId} editing={editing} setOpenId={setOpenId} setEditing={setEditing} onChanged={reload} />
    </div>
  );
}

export function ExpenseApprovalPage({ refreshSignal }: { refreshSignal: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseDetail | "new" | null>(null);
  const queue = useLoad<ExpenseSummary[]>("/depenses/a-valider", refreshSignal);
  const expenses = queue.data ?? [];
  const total = expenses.reduce((sum, expense) => sum + Number(expense.montant), 0);
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Finances</p>
          <h2>Validation des dépenses</h2>
          <p>Contrôlez chaque demande, ses pièces et le budget disponible avant d&apos;engager l&apos;établissement.</p>
        </div>
      </div>
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">En attente</p>
            <h3>{queue.data ? expenses.length : "--"} dépense(s) · {formatMoney(total)}</h3>
          </div>
          <button className="outline-button small" onClick={queue.reload}>Actualiser</button>
        </div>
        {queue.error && <p className="form-error">{queue.error}</p>}
        <ExpenseTable
          expenses={expenses}
          empty={queue.data ? "Aucune dépense en attente de validation." : "Chargement..."}
          onOpen={setOpenId}
          extra={{
            title: "Étape",
            render: (expense) => (
              <>
                <span className="status status-en_attente">{expense.statut === "VALIDATION_FINALE" ? "Validation finale" : expense.niveauxRequis === 2 ? "1re validation sur 2" : "Validation"}</span>
                {expense.horsBudget && <small className="cell-detail debt-action">Hors budget</small>}
                {!expense.actions.valider && expense.actions.blocageValidation && <small className="cell-detail">{expense.actions.blocageValidation}</small>}
              </>
            ),
          }}
        />
      </section>
      <ExpenseModals openId={openId} editing={editing} setOpenId={setOpenId} setEditing={setEditing} onChanged={queue.reload} />
    </div>
  );
}

export function ExpenseExecutionPage({ refreshSignal }: { refreshSignal: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseDetail | "new" | null>(null);
  const queue = useLoad<ExpenseSummary[]>("/depenses/a-executer", refreshSignal);
  const expenses = queue.data ?? [];
  const groups = [
    { title: "À réceptionner", hint: "Bon de commande émis : constatez la livraison avec le bon de livraison.", items: expenses.filter((expense) => expense.statut === "VALIDEE" && expense.categorie.livraisonRequise) },
    { title: "À facturer", hint: "Enregistrez la facture du fournisseur et joignez-la.", items: expenses.filter((expense) => expense.statut === "RECEPTIONNEE" || (expense.statut === "VALIDEE" && !expense.categorie.livraisonRequise)) },
    { title: "À payer", hint: "Dépenses facturées : enregistrez chaque décaissement.", items: expenses.filter((expense) => ["FACTUREE", "PAYEE_PARTIELLEMENT"].includes(expense.statut)) },
  ];
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Finances</p>
          <h2>Exécution des dépenses</h2>
          <p>Commande, livraison, facture puis paiement : une dépense n&apos;est payée que si les trois pièces concordent.</p>
        </div>
        <button className="outline-button small" onClick={queue.reload}>Actualiser</button>
      </div>
      {queue.error && <p className="form-error">{queue.error}</p>}
      {groups.map((group) => (
        <section className="panel full-panel expense-group" key={group.title}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{group.title}</p>
              <h3>{queue.data ? group.items.length : "--"} dépense(s) · {formatMoney(group.items.reduce((sum, expense) => sum + Number(group.title === "À payer" ? expense.resteAPayer : expense.montant), 0))}</h3>
              <p className="panel-subtitle">{group.hint}</p>
            </div>
          </div>
          <ExpenseTable
            expenses={group.items}
            empty={queue.data ? "Rien à traiter." : "Chargement..."}
            onOpen={setOpenId}
            extra={group.title === "À payer" ? { title: "Reste à payer", render: (expense) => <span className="status status-refusee">{formatMoney(expense.resteAPayer)}</span> } : { title: "Bon de commande", render: (expense) => expense.numeroBonCommande ?? "—" }}
          />
        </section>
      ))}
      <ExpenseModals openId={openId} editing={editing} setOpenId={setOpenId} setEditing={setEditing} onChanged={queue.reload} />
    </div>
  );
}

// ---------- Budget ----------

export function BudgetPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "finance-settings", "edit");
  const [exerciceId, setExerciceId] = useState("");
  const [editing, setEditing] = useState<BudgetReport["lignes"][number] | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const report = useLoad<BudgetReport>(`/finances/budget${exerciceId ? `?exerciceId=${exerciceId}` : ""}`, refreshSignal);
  const data = report.data;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !data?.exercice) return;
    setError("");
    try {
      await apiFetch("/finances/budget", { method: "PUT", body: JSON.stringify({ exerciceId: data.exercice.id, categorieId: editing.categorieId, montant: amount }), silent: true });
      toast("Budget enregistré.");
      setEditing(null);
      report.reload();
    } catch (failure) {
      setError(message(failure, "Budget non enregistré."));
    }
  };
  const totals = data?.totaux;
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Finances</p>
          <h2>Budget et suivi</h2>
          <p>Comparez le budget voté, ce qui est engagé et ce qui est réellement payé, catégorie par catégorie.</p>
        </div>
        {data && data.exercices.length > 0 && (
          <select className="expense-select" aria-label="Exercice" value={data.exercice?.id ?? ""} onChange={(event) => setExerciceId(event.target.value)}>
            {data.exercices.map((item) => <option key={item.id} value={item.id}>{item.libelle}{item.cloture ? " (clôturé)" : ""}</option>)}
          </select>
        )}
      </div>
      {report.error && <p className="form-error">{report.error}</p>}
      {data && !data.exercice && <section className="panel full-panel"><p className="empty-state">Aucun exercice budgétaire n&apos;existe encore. Créez-en un dans « Paramètres finances » pour ouvrir le budget.</p></section>}
      {data?.exercice && totals && (
        <>
          <div className="stats-grid">
            <article className="stat-card blue"><span>Budget de l&apos;exercice</span><strong>{formatMoney(totals.budget)}</strong><p>{formatDate(data.exercice.dateDebut)} → {formatDate(data.exercice.dateFin)}</p></article>
            <article className="stat-card orange"><span>Réservé et engagé</span><strong>{formatMoney(Number(totals.reserve) + Number(totals.engage))}</strong><p>{formatMoney(totals.reserve)} en validation · {formatMoney(totals.engage)} commandé non payé</p></article>
            <article className="stat-card mint"><span>Disponible</span><strong>{formatMoney(totals.disponible)}</strong><p>Budget moins réservé, engagé et payé</p></article>
            <article className="stat-card violet"><span>Dépenses payées</span><strong>{formatMoney(totals.paye)}</strong><p>Décaissements de l&apos;exercice</p></article>
            <article className="stat-card blue"><span>Recettes encaissées</span><strong>{formatMoney(totals.recettes)}</strong><p>Paiements reçus sur la période</p></article>
            <article className={`stat-card ${Number(totals.solde) < 0 ? "orange" : "mint"}`}><span>Solde recettes − dépenses</span><strong>{formatMoney(totals.solde)}</strong><p>Encaissements moins décaissements</p></article>
          </div>
          <section className="panel full-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Exercice {data.exercice.libelle}{data.exercice.cloture ? " · clôturé" : ""}</p>
                <h3>Budget par catégorie</h3>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Catégorie</th><th>Budget</th><th>Réservé</th><th>Engagé</th><th>Payé</th><th>Disponible</th><th>Consommation</th><th /></tr></thead>
                <tbody>
                  {data.lignes.map((line) => (
                    <tr key={line.categorieId}>
                      <td className="strong-cell">{line.categorie}</td>
                      <td>{formatMoney(line.budget)}</td>
                      <td>{formatMoney(line.reserve)}</td>
                      <td>{formatMoney(line.engage)}</td>
                      <td>{formatMoney(line.paye)}</td>
                      <td><span className={`status ${Number(line.disponible) < 0 ? "status-refusee" : "status-complete"}`}>{formatMoney(line.disponible)}</span></td>
                      <td>
                        {line.taux === null ? <small className="cell-detail">Pas de budget</small> : (
                          <span className="budget-bar" title={`${line.taux} %`}><span className={line.taux > 100 ? "over" : line.taux >= 80 ? "warn" : ""} style={{ width: `${Math.min(100, line.taux)}%` }} /><small>{line.taux} %</small></span>
                        )}
                      </td>
                      <td>{canEdit && !data.exercice?.cloture && <button className="row-action icon-action" aria-label={`Modifier le budget ${line.categorie}`} onClick={() => { setEditing(line); setAmount(String(Number(line.budget))); setError(""); }}><ActionIcon name="edit" /></button>}</td>
                    </tr>
                  ))}
                  {!data.lignes.length && <tr><td colSpan={8} className="empty-state">Aucune catégorie de dépense.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {editing && (
        <Modal title={`Budget · ${editing.categorie}`} onClose={() => setEditing(null)}>
          <form className="entity-form" onSubmit={save}>
            <label>Montant du budget<input required autoFocus type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <p className="panel-subtitle">Déjà réservé, engagé ou payé : {formatMoney(Number(editing.reserve) + Number(editing.engage) + Number(editing.paye))}. Le budget ne peut pas descendre en dessous.</p>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Annuler</button>
              <button className="primary-button compact">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- Paramètres finances ----------

type SettingsTab = "regles" | "categories" | "fournisseurs" | "exercices";

function RulesSettings({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const rules = useLoad<FinanceRules>("/finances/parametres", signal);
  const [form, setForm] = useState<{ seuil: string; budgetBloquant: boolean; separationPaiement: boolean } | null>(null);
  const [error, setError] = useState("");
  const current = form ?? (rules.data ? { seuil: String(Number(rules.data.seuilDoubleValidation)), budgetBloquant: rules.data.budgetBloquant, separationPaiement: rules.data.separationPaiement } : null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!current) return;
    setError("");
    try {
      await apiFetch("/finances/parametres", { method: "PATCH", body: JSON.stringify({ seuilDoubleValidation: current.seuil, budgetBloquant: current.budgetBloquant, separationPaiement: current.separationPaiement }) });
      setForm(null);
      rules.reload();
    } catch (failure) {
      setError(message(failure, "Règles non enregistrées."));
    }
  };
  if (!current) return <p className="empty-state">{rules.error || "Chargement..."}</p>;
  return (
    <div className="finance-rules">
      <form className="entity-form" onSubmit={save}>
        <p className="form-section-label">Règles paramétrables</p>
        <label>
          Seuil de double validation (F)
          <input required type="number" min="0" step="1" disabled={!canEdit} value={current.seuil} onChange={(event) => setForm({ ...current, seuil: event.target.value })} />
          <small className="cell-detail">À partir de ce montant, une dépense exige deux validations par deux personnes différentes.</small>
        </label>
        <label className="check-row">
          <input type="checkbox" disabled={!canEdit} checked={current.budgetBloquant} onChange={(event) => setForm({ ...current, budgetBloquant: event.target.checked })} />
          <span>Bloquer les demandes qui dépassent le budget de leur catégorie<small>Si décoché, la demande reste possible mais elle est signalée « hors budget » et passe en double validation.</small></span>
        </label>
        <label className="check-row">
          <input type="checkbox" disabled={!canEdit} checked={current.separationPaiement} onChange={(event) => setForm({ ...current, separationPaiement: event.target.checked })} />
          <span>Celui qui paie ne peut pas avoir validé la dépense<small>Séparation entre l&apos;ordonnateur (qui décide) et le comptable (qui paie). À ne décocher que si l&apos;équipe est trop réduite.</small></span>
        </label>
        {error && <p className="form-error">{error}</p>}
        {canEdit && <div className="form-actions"><button className="primary-button compact" disabled={!form}>Enregistrer les règles</button></div>}
      </form>
      <div>
        <p className="form-section-label">Règles toujours appliquées</p>
        <ul className="finance-fixed-rules">
          <li>Personne ne valide ni ne paie une dépense qu&apos;il a lui-même initiée, administrateur compris.</li>
          <li>La seconde validation est toujours faite par une autre personne que la première.</li>
          <li>Une demande n&apos;est soumise qu&apos;avec sa lettre de demande d&apos;achat, son devis et son utilité.</li>
          <li>Une demande soumise n&apos;est plus modifiable ; rejetée, elle repart de zéro après correction.</li>
          <li>Le bon de commande est émis à la validation finale et réserve le budget.</li>
          <li>Pas de facture sans livraison constatée (catégories avec livraison), pas de paiement sans facture.</li>
          <li>La facture ne dépasse jamais le montant validé, les paiements ne dépassent jamais la facture.</li>
          <li>Une même facture d&apos;un fournisseur ne peut pas être enregistrée deux fois.</li>
          <li>Aucune dépense n&apos;est supprimée : elle est annulée avec un motif, tant que rien n&apos;est payé.</li>
          <li>Chaque étape est horodatée et signée du nom de son auteur.</li>
        </ul>
      </div>
    </div>
  );
}

function CategoriesSettings({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const categories = useLoad<ExpenseCategory[]>("/finances/categories", signal);
  const [name, setName] = useState("");
  const [delivery, setDelivery] = useState(true);
  const [error, setError] = useState("");
  const call = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
      categories.reload();
    } catch (failure) {
      setError(message(failure, "Modification impossible."));
    }
  };
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); void call(async () => { await apiFetch("/finances/categories", { method: "POST", body: JSON.stringify({ nom: name, livraisonRequise: delivery }) }); setName(""); }); }}>
          <input required minLength={2} placeholder="Nouvelle catégorie" aria-label="Nom de la catégorie" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="check-row"><input type="checkbox" checked={delivery} onChange={(event) => setDelivery(event.target.checked)} /><span>Avec livraison</span></label>
          <button className="outline-button small">Ajouter</button>
        </form>
      )}
      {(error || categories.error) && <p className="form-error">{error || categories.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Catégorie</th><th>Bon de livraison exigé</th><th>Compte de charge</th><th>État</th><th /></tr></thead>
          <tbody>
            {(categories.data ?? []).map((category) => (
              <tr key={category.id}>
                <td className="strong-cell">{category.nom}</td>
                <td>{category.livraisonRequise ? "Oui · achat de biens ou services" : "Non · charge sans livraison"}</td>
                <td><input className="expense-select account-input" aria-label={`Compte de charge de ${category.nom}`} placeholder="Automatique" disabled={!canEdit} defaultValue={category.compteNumero ?? ""} onBlur={(event) => { if (event.target.value.trim() !== (category.compteNumero ?? "")) void call(() => apiFetch(`/finances/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ compteNumero: event.target.value.trim() }) })); }} /></td>
                <td><span className={`status ${category.actif ? "status-complete" : "status-neutre"}`}>{category.actif ? "Active" : "Désactivée"}</span></td>
                <td className="action-group">
                  {canEdit && <button className="row-action" onClick={() => void call(() => apiFetch(`/finances/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ livraisonRequise: !category.livraisonRequise }) }))}>{category.livraisonRequise ? "Sans livraison" : "Avec livraison"}</button>}
                  {canEdit && <button className="row-action" onClick={() => void call(() => apiFetch(`/finances/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ actif: !category.actif }) }))}>{category.actif ? "Désactiver" : "Réactiver"}</button>}
                </td>
              </tr>
            ))}
            {!categories.data?.length && <tr><td colSpan={5} className="empty-state">{categories.data ? "Aucune catégorie." : "Chargement..."}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SuppliersSettings({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const suppliers = useLoad<Supplier[]>("/finances/fournisseurs", signal);
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [form, setForm] = useState({ nom: "", telephone: "", email: "", adresse: "", identifiantFiscal: "" });
  const [error, setError] = useState("");
  const open = (supplier: Supplier | "new") => {
    setEditing(supplier);
    setError("");
    setForm(supplier === "new" ? { nom: "", telephone: "", email: "", adresse: "", identifiantFiscal: "" } : { nom: supplier.nom, telephone: supplier.telephone ?? "", email: supplier.email ?? "", adresse: supplier.adresse ?? "", identifiantFiscal: supplier.identifiantFiscal ?? "" });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (editing === "new") await apiFetch("/finances/fournisseurs", { method: "POST", body: JSON.stringify(form) });
      else if (editing) await apiFetch(`/finances/fournisseurs/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      setEditing(null);
      suppliers.reload();
    } catch (failure) {
      setError(message(failure, "Fournisseur non enregistré."));
    }
  };
  const toggle = async (supplier: Supplier) => {
    try {
      await apiFetch(`/finances/fournisseurs/${supplier.id}`, { method: "PATCH", body: JSON.stringify({ actif: !supplier.actif }) });
      suppliers.reload();
    } catch (failure) {
      toast(message(failure, "Modification impossible."), "error");
    }
  };
  const input = (key: keyof typeof form) => ({ value: form[key], onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value }) });
  return (
    <>
      {canEdit && <div className="finance-inline-form"><button className="outline-button small" onClick={() => open("new")}>+ Nouveau fournisseur</button></div>}
      {suppliers.error && <p className="form-error">{suppliers.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fournisseur / bénéficiaire</th><th>Contact</th><th>Identifiant fiscal</th><th>État</th><th /></tr></thead>
          <tbody>
            {(suppliers.data ?? []).map((supplier) => (
              <tr key={supplier.id}>
                <td className="strong-cell">{supplier.nom}</td>
                <td>{[supplier.telephone, supplier.email].filter(Boolean).join(" · ") || "—"}</td>
                <td>{supplier.identifiantFiscal || "—"}</td>
                <td><span className={`status ${supplier.actif ? "status-complete" : "status-neutre"}`}>{supplier.actif ? "Actif" : "Désactivé"}</span></td>
                <td className="action-group">
                  {canEdit && <button className="row-action icon-action" aria-label="Modifier le fournisseur" onClick={() => open(supplier)}><ActionIcon name="edit" /></button>}
                  {canEdit && <button className="row-action" onClick={() => void toggle(supplier)}>{supplier.actif ? "Désactiver" : "Réactiver"}</button>}
                </td>
              </tr>
            ))}
            {!suppliers.data?.length && <tr><td colSpan={5} className="empty-state">{suppliers.data ? "Aucun fournisseur enregistré." : "Chargement..."}</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={editing === "new" ? "Nouveau fournisseur" : "Modifier le fournisseur"} onClose={() => setEditing(null)}>
          <form className="entity-form" onSubmit={save}>
            <label>Nom ou raison sociale<input required minLength={2} {...input("nom")} /></label>
            <div className="form-grid">
              <label>Téléphone<input {...input("telephone")} /></label>
              <label>E-mail<input type="email" {...input("email")} /></label>
            </div>
            <label>Adresse<input {...input("adresse")} /></label>
            <label>Identifiant fiscal / registre de commerce<input {...input("identifiantFiscal")} /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(null)}>Annuler</button>
              <button className="primary-button compact">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function FiscalYearsSettings({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const years = useLoad<FiscalYear[]>("/finances/exercices", signal);
  const [form, setForm] = useState({ libelle: "", dateDebut: "", dateFin: "" });
  const [error, setError] = useState("");
  const call = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
      years.reload();
    } catch (failure) {
      setError(message(failure, "Modification impossible."));
    }
  };
  const toggle = async (year: FiscalYear) => {
    if (!year.cloture && !(await askConfirm({ title: `Clôturer l'exercice ${year.libelle} ?`, message: "Plus aucune dépense ne pourra y être soumise et son budget sera figé.", confirmLabel: "Clôturer", danger: true }))) return;
    void call(() => apiFetch(`/finances/exercices/${year.id}`, { method: "PATCH", body: JSON.stringify({ cloture: !year.cloture }) }));
  };
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); void call(async () => { await apiFetch("/finances/exercices", { method: "POST", body: JSON.stringify({ libelle: form.libelle, dateDebut: new Date(`${form.dateDebut}T00:00:00`).toISOString(), dateFin: new Date(`${form.dateFin}T23:59:59.999`).toISOString() }) }); setForm({ libelle: "", dateDebut: "", dateFin: "" }); }); }}>
          <input required placeholder="Libellé (ex. 2026-2027)" aria-label="Libellé de l'exercice" value={form.libelle} onChange={(event) => setForm({ ...form, libelle: event.target.value })} />
          <label>Du<input required type="date" value={form.dateDebut} onChange={(event) => setForm({ ...form, dateDebut: event.target.value })} /></label>
          <label>au<input required type="date" min={form.dateDebut} value={form.dateFin} onChange={(event) => setForm({ ...form, dateFin: event.target.value })} /></label>
          <button className="outline-button small">Ouvrir l&apos;exercice</button>
        </form>
      )}
      {(error || years.error) && <p className="form-error">{error || years.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Exercice</th><th>Période</th><th>État</th><th /></tr></thead>
          <tbody>
            {(years.data ?? []).map((year) => (
              <tr key={year.id}>
                <td className="strong-cell">{year.libelle}</td>
                <td>{formatDate(year.dateDebut)} → {formatDate(year.dateFin)}</td>
                <td><span className={`status ${year.cloture ? "status-neutre" : "status-complete"}`}>{year.cloture ? "Clôturé" : "Ouvert"}</span></td>
                <td>{canEdit && <button className="row-action" onClick={() => void toggle(year)}>{year.cloture ? "Rouvrir" : "Clôturer"}</button>}</td>
              </tr>
            ))}
            {!years.data?.length && <tr><td colSpan={4} className="empty-state">{years.data ? "Aucun exercice : ouvrez-en un pour pouvoir soumettre des dépenses." : "Chargement..."}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function FinanceSettingsPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "finance-settings", "edit");
  const [tab, setTab] = useState<SettingsTab>("regles");
  const tabs: Array<[SettingsTab, string, string]> = [
    ["regles", "Règles", "Seuils et contrôles appliqués à chaque dépense."],
    ["categories", "Catégories", "Les lignes budgétaires sur lesquelles on impute les dépenses."],
    ["fournisseurs", "Fournisseurs", "Les fournisseurs et bénéficiaires que l'on peut payer."],
    ["exercices", "Exercices", "Les périodes budgétaires. Une dépense appartient à l'exercice ouvert le jour de sa soumission."],
  ];
  const active = tabs.find(([key]) => key === tab)!;
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Finances</p>
          <h2>Paramètres finances</h2>
          <p>Réglez une fois les règles du jeu : elles s&apos;appliquent ensuite à toutes les dépenses, sans exception.</p>
        </div>
      </div>
      <div className="report-toolbar">
        <div className="segmented compact">
          <div className="segmented-options" role="radiogroup" aria-label="Rubrique">
            {tabs.map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={tab === key} className="segmented-option" onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{active[1]}</p>
            <h3>{active[2]}</h3>
          </div>
        </div>
        {tab === "regles" && <RulesSettings canEdit={canEdit} signal={refreshSignal} />}
        {tab === "categories" && <CategoriesSettings canEdit={canEdit} signal={refreshSignal} />}
        {tab === "fournisseurs" && <SuppliersSettings canEdit={canEdit} signal={refreshSignal} />}
        {tab === "exercices" && <FiscalYearsSettings canEdit={canEdit} signal={refreshSignal} />}
      </section>
    </div>
  );
}
