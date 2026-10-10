"use client";

import { FormEvent, useState } from "react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { Payslip, monthLabel, payslipsPdf } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";
import { ExpenseCategory, User, formatDate, formatMoney } from "@/lib/types";
import { PAYMENT_MODES } from "@/components/hr-page";
import { CalendarCheck, ListChecks, SlidersHorizontal } from "lucide-react";
import { Badge, Empty, FormActions, HubBack, HubCard, HubCards, Modal, PageIntro, Panel, downloadPdf, number, personName, send, today, useAction, useForm, useLoad } from "@/components/ui-kit";

type PeriodRow = { id: string; annee: number; mois: number; statut: string; prepareParNom: string; valideParNom?: string | null; _count: { bulletins: number }; bulletins: Array<{ brut: string; net: string; chargesPatronales: string }> };
type Slip = Payslip & { id: string; employeId: string; heuresVacation: string; tauxHoraire: string; joursAbsence: string; ajustements: Record<string, number> };
type Period = {
  id: string;
  annee: number;
  mois: number;
  statut: string;
  prepareParNom: string;
  valideParNom?: string | null;
  dateValidation?: string | null;
  payeParNom?: string | null;
  datePaiement?: string | null;
  modePaiement?: string | null;
  bulletins: Slip[];
  totaux: { brut: number; retenues: number; net: number; chargesPatronales: number; coutTotal: number };
  anomalies: string[];
};
type Rubric = { id: string; code: string; libelle: string; type: string; mode: string; valeur: string; plafond?: string | null; appliqueATous: boolean; compteNumero?: string | null; ordre: number; actif: boolean };
type HrSettings = { joursCongeAnnuel: number; joursOuvresMois: number; categoriePaieId?: string | null };

const PERIOD_STATUS: Record<string, { label: string; tone: "wait" | "run" | "ok" }> = {
  OUVERTE: { label: "En préparation", tone: "wait" },
  VALIDEE: { label: "Validée · à verser", tone: "run" },
  PAYEE: { label: "Versée", tone: "ok" },
};
const RUBRIC_TYPES: Record<string, string> = { GAIN: "Gain", RETENUE: "Retenue salariale", PATRONALE: "Charge patronale" };
const RUBRIC_MODES: Record<string, string> = { FIXE: "Montant fixe", POURCENTAGE_BASE: "% du salaire de base", POURCENTAGE_BRUT: "% du salaire brut", VARIABLE: "Saisi chaque mois" };

function AdjustModal({ slip, onClose, onSaved }: { slip: Slip; onClose: () => void; onSaved: (period: Period) => void }) {
  const rubrics = useLoad<Rubric[]>("/paie/rubriques");
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(Object.entries(slip.ajustements ?? {}).map(([code, amount]) => [code, String(amount)])));
  const action = useAction();
  const variables = (rubrics.data ?? []).filter((rubric) => rubric.actif && rubric.mode === "VARIABLE");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      onSaved(await send<Period>(`/paie/bulletins/${slip.id}`, "PATCH", { ajustements: values }, true));
      onClose();
    });
  };
  return (
    <Modal title={`Éléments variables · ${personName(slip.employe)}`} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Montants propres à ce mois : primes, heures supplémentaires, avances, impôt retenu. Laissez vide ce qui ne s&apos;applique pas.</p>
        {variables.map((rubric) => (
          <label key={rubric.id}>
            {rubric.libelle} · {RUBRIC_TYPES[rubric.type].toLowerCase()}
            <input type="number" min="0" step="1" value={values[rubric.code] ?? ""} onChange={(event) => setValues({ ...values, [rubric.code]: event.target.value })} />
          </label>
        ))}
        {rubrics.data && !variables.length && <p className="empty-state">Aucune rubrique à saisir chaque mois.</p>}
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} label="Recalculer le bulletin" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function PeriodModal({ id, canEdit, canApprove, onClose, onChanged }: { id: string; canEdit: boolean; canApprove: boolean; onClose: () => void; onChanged: () => void }) {
  const period = useLoad<Period>(`/paie/periodes/${id}`);
  const [adjusting, setAdjusting] = useState<Slip | null>(null);
  const [detail, setDetail] = useState<Slip | null>(null);
  const [paying, setPaying] = useState(false);
  const pay = useForm({ datePaiement: today(), modePaiement: "VIREMENT" });
  const action = useAction();
  const data = period.data;
  const apply = (next: Period) => { period.setData(next); onChanged(); };
  const post = (path: string, body?: unknown, done?: string) =>
    action.run(async () => {
      apply(await send<Period>(`/paie/periodes/${id}/${path}`, "POST", body, true));
      if (done) toast(done);
    });
  const validate = async () => {
    if (await askConfirm({ title: "Valider cette paie ?", message: "Les bulletins seront figés, ainsi que les heures de cours et les absences du mois. L'écriture comptable sera générée.", confirmLabel: "Valider" })) void post("valider", undefined, "Paie validée.");
  };
  const reopen = async () => {
    const motif = await askReason({ title: "Rouvrir cette paie", message: "L'écriture comptable sera contre-passée.", confirmLabel: "Rouvrir", danger: true, reason: { label: "Motif de la réouverture", minLength: 10 } });
    if (motif) void post("rouvrir", { motif });
  };
  const print = (slips: Slip[]) =>
    action.run(async () => {
      if (!data) return;
      await payslipsPdf(slips, data, slips.length === 1 ? `bulletin-${slips[0].numero}.pdf` : `bulletins-paie-${data.annee}-${String(data.mois).padStart(2, "0")}.pdf`);
      for (const slip of slips) logPrint({ typeDocument: "BULLETIN_PAIE", mode: "PDF", libelle: `${personName(slip.employe)} · ${monthLabel(data.annee, data.mois)}`, reference: slip.numero });
    });
  const exportCsv = () =>
    data &&
    downloadPdf(`livre-de-paie-${data.annee}-${String(data.mois).padStart(2, "0")}.pdf`, "Livre de paie", monthLabel(data.annee, data.mois), [
      ["Matricule", "Nom", "Prénom", "Fonction", "Salaire de base", "Heures de cours", "Jours d'absence", "Brut", "Retenues", "Net à payer", "Charges patronales", "Mode de paiement"],
      ...data.bulletins.map((slip) => [slip.employe.matricule, slip.employe.nom, slip.employe.prenom, slip.fonction, Number(slip.salaireBase), Number(slip.heuresVacation), Number(slip.joursAbsence), Number(slip.brut), Number(slip.totalRetenues), Number(slip.net), Number(slip.chargesPatronales), PAYMENT_MODES[slip.employe.modePaiement ?? ""] ?? ""]),
      ["", "", "", "TOTAL", "", "", "", data.totaux.brut, data.totaux.retenues, data.totaux.net, data.totaux.chargesPatronales, ""],
    ]);
  const open = data?.statut === "OUVERTE";
  return (
    <Modal wide title={data ? `Paie de ${monthLabel(data.annee, data.mois)}` : "Paie"} onClose={onClose}>
      {!data && <p className="empty-state">{period.error || "Chargement..."}</p>}
      {data && (
        <div className="expense-detail">
          <div className="expense-detail-head">
            <Badge tone={PERIOD_STATUS[data.statut].tone}>{PERIOD_STATUS[data.statut].label}</Badge>
            <span className="panel-subtitle">
              Préparée par {data.prepareParNom}
              {data.valideParNom ? ` · validée par ${data.valideParNom}` : ""}
              {data.payeParNom ? ` · versée le ${formatDate(data.datePaiement ?? undefined)} (${PAYMENT_MODES[data.modePaiement ?? ""] ?? ""})` : ""}
            </span>
            <strong className="expense-amount">{formatMoney(data.totaux.net)}</strong>
          </div>
          <dl className="expense-facts">
            <div><dt>Salaires bruts</dt><dd>{formatMoney(data.totaux.brut)}</dd></div>
            <div><dt>Retenues</dt><dd>{formatMoney(data.totaux.retenues)}</dd></div>
            <div><dt>Charges patronales</dt><dd>{formatMoney(data.totaux.chargesPatronales)}</dd></div>
            <div><dt>Coût total</dt><dd>{formatMoney(data.totaux.coutTotal)}</dd></div>
          </dl>
          {data.anomalies.length > 0 && (
            <div className="expense-alert">
              <span>Points à vérifier</span>
              <ul>{data.anomalies.map((anomaly) => <li key={anomaly}>{anomaly}</li>)}</ul>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employé</th><th>Base</th><th>Cours</th><th>Absences</th><th>Brut</th><th>Retenues</th><th>Net à payer</th><th /></tr></thead>
              <tbody>
                {data.bulletins.map((slip) => (
                  <tr key={slip.id}>
                    <td className="strong-cell"><button className="dossier-open-button" onClick={() => setDetail(slip)}>{personName(slip.employe)}</button><small className="cell-detail">{slip.employe.matricule} · {slip.fonction}</small></td>
                    <td>{formatMoney(slip.salaireBase)}</td>
                    <td>{Number(slip.heuresVacation) ? `${number(slip.heuresVacation)} h` : "—"}</td>
                    <td>{Number(slip.joursAbsence) ? `${number(slip.joursAbsence)} j` : "—"}</td>
                    <td>{formatMoney(slip.brut)}</td>
                    <td>{formatMoney(slip.totalRetenues)}</td>
                    <td className="strong-cell">{formatMoney(slip.net)}</td>
                    <td className="action-group">
                      {open && canEdit && <button className="row-action" onClick={() => setAdjusting(slip)}>Variables</button>}
                      <button className="row-action" disabled={action.busy} onClick={() => void print([slip])}>PDF</button>
                    </td>
                  </tr>
                ))}
                {!data.bulletins.length && <Empty columns={8}>Aucun bulletin : aucun employé n&apos;a de contrat sur ce mois.</Empty>}
              </tbody>
            </table>
          </div>
          {action.error && !paying && <p className="form-error">{action.error}</p>}
          {!paying && (
            <div className="form-actions expense-actions">
              <button className="secondary-button" onClick={() => exportCsv()}>Livre de paie (PDF)</button>
              <button className="secondary-button" disabled={action.busy || !data.bulletins.length} onClick={() => void print(data.bulletins)}>Tous les bulletins (PDF)</button>
              {open && canEdit && <button className="secondary-button" disabled={action.busy} onClick={() => void post("recalculer", undefined, "Paie recalculée.")}>Recalculer</button>}
              {data.statut === "VALIDEE" && canApprove && <button className="danger-button" onClick={() => void reopen()}>Rouvrir</button>}
              {open && canApprove && <button className="primary-button compact" disabled={action.busy} onClick={() => void validate()}>Valider la paie</button>}
              {data.statut === "VALIDEE" && canEdit && <button className="primary-button compact" onClick={() => { action.setError(""); setPaying(true); }}>Enregistrer le versement</button>}
            </div>
          )}
          {open && <p className="panel-subtitle">La paie est validée par une autre personne que celle qui l&apos;a préparée.</p>}
          {paying && (
            <form className="entity-form expense-panel" onSubmit={(event) => { event.preventDefault(); void post("payer", pay.values, "Versement enregistré.").then(() => setPaying(false)); }}>
              <p className="form-section-label">Versement des salaires · {formatMoney(data.totaux.net)}</p>
              <div className="form-grid">
                <label>Date du versement<input required type="date" max={today()} {...pay.bind("datePaiement")} /></label>
                <label>Mode de versement<select {...pay.bind("modePaiement")}>{Object.entries(PAYMENT_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              {action.error && <p className="form-error">{action.error}</p>}
              <FormActions busy={action.busy} label="Confirmer le versement" onCancel={() => setPaying(false)} />
            </form>
          )}
        </div>
      )}
      {adjusting && <AdjustModal slip={adjusting} onClose={() => setAdjusting(null)} onSaved={apply} />}
      {detail && (
        <Modal title={`${personName(detail.employe)} · ${detail.numero}`} onClose={() => setDetail(null)}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rubrique</th><th>Base</th><th>Taux</th><th>Montant</th></tr></thead>
              <tbody>
                {detail.lignes.map((line) => (
                  <tr key={line.code}>
                    <td className="strong-cell">{line.libelle}<small className="cell-detail">{RUBRIC_TYPES[line.type]}</small></td>
                    <td>{line.base === null ? "—" : number(line.base)}</td>
                    <td>{line.taux === null ? "—" : number(line.taux)}</td>
                    <td>{formatMoney(line.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="payment-summary"><strong>{formatMoney(detail.brut)}</strong><span>brut</span><strong>{formatMoney(detail.totalRetenues)}</strong><span>retenues</span><strong>{formatMoney(detail.net)}</strong><span>net</span></p>
        </Modal>
      )}
    </Modal>
  );
}

function PeriodsTab({ canEdit, canApprove, signal }: { canEdit: boolean; canApprove: boolean; signal: number }) {
  const periods = useLoad<PeriodRow[]>("/paie/periodes", signal);
  const now = new Date();
  const form = useForm({ mois: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` });
  const [openId, setOpenId] = useState<string | null>(null);
  const action = useAction();
  const create = (event: FormEvent) => {
    event.preventDefault();
    const [annee, mois] = form.values.mois.split("-").map(Number);
    void action.run(async () => {
      const created = await send<Period>("/paie/periodes", "POST", { annee, mois }, true);
      toast(`Paie de ${monthLabel(annee, mois)} préparée : ${created.bulletins.length} bulletin(s).`);
      periods.reload();
      setOpenId(created.id);
    });
  };
  const sum = (row: PeriodRow, key: "brut" | "net" | "chargesPatronales") => row.bulletins.reduce((total, slip) => total + Number(slip[key]), 0);
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={create}>
          <label>Mois<input required type="month" {...form.bind("mois")} /></label>
          <button className="outline-button small" disabled={action.busy}>{action.busy ? "Calcul..." : "Préparer la paie du mois"}</button>
        </form>
      )}
      {(action.error || periods.error) && <p className="form-error">{action.error || periods.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mois</th><th>État</th><th>Bulletins</th><th>Brut</th><th>Net à payer</th><th>Coût total</th><th /></tr></thead>
          <tbody>
            {(periods.data ?? []).map((row) => (
              <tr key={row.id}>
                <td><button className="dossier-open-button" onClick={() => setOpenId(row.id)}>{monthLabel(row.annee, row.mois)}</button></td>
                <td><Badge tone={PERIOD_STATUS[row.statut].tone}>{PERIOD_STATUS[row.statut].label}</Badge></td>
                <td>{row._count.bulletins}</td>
                <td>{formatMoney(sum(row, "brut"))}</td>
                <td>{formatMoney(sum(row, "net"))}</td>
                <td>{formatMoney(sum(row, "brut") + sum(row, "chargesPatronales"))}</td>
                <td><button className="row-action" onClick={() => setOpenId(row.id)}>Ouvrir</button></td>
              </tr>
            ))}
            {!periods.data?.length && <Empty columns={7}>{periods.data ? "Aucune paie préparée." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
      {openId && <PeriodModal key={openId} id={openId} canEdit={canEdit} canApprove={canApprove} onClose={() => setOpenId(null)} onChanged={periods.reload} />}
    </>
  );
}

const emptyRubric = { code: "", libelle: "", type: "GAIN", mode: "FIXE", valeur: "0", plafond: "", compteNumero: "", ordre: "100", appliqueATous: false as boolean };

function RubricsTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const rubrics = useLoad<Rubric[]>("/paie/rubriques", signal);
  const [editing, setEditing] = useState<Rubric | "new" | null>(null);
  const form = useForm(emptyRubric);
  const action = useAction();
  const open = (rubric: Rubric | "new") => {
    action.setError("");
    setEditing(rubric);
    form.setValues(rubric === "new" ? emptyRubric : { code: rubric.code, libelle: rubric.libelle, type: rubric.type, mode: rubric.mode, valeur: String(Number(rubric.valeur)), plafond: rubric.plafond ? String(Number(rubric.plafond)) : "", compteNumero: rubric.compteNumero ?? "", ordre: String(rubric.ordre), appliqueATous: rubric.appliqueATous });
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const body = { ...form.values, plafond: form.values.plafond || null };
      if (editing === "new") await send("/paie/rubriques", "POST", body);
      else if (editing) await send(`/paie/rubriques/${editing.id}`, "PATCH", body);
      setEditing(null);
      rubrics.reload();
    });
  };
  const percent = form.values.mode.startsWith("POURCENTAGE");
  return (
    <>
      <p className="expense-alert"><span>Taux à confirmer</span>Les cotisations CNSS proposées suivent le barème publié pour 2023 : pensions 4 % (salarié) et 8 % (employeur) jusqu&apos;à 1 200 000 F, prestations familiales 10,03 % et accidents du travail 2,25 % jusqu&apos;à 600 000 F. L&apos;assurance maladie et les autres prélèvements patronaux ne sont pas inclus. Faites confirmer le barème en vigueur par votre comptable ou la CNSS avant la première paie réelle.</p>
      {canEdit && <div className="finance-inline-form"><button className="outline-button small" onClick={() => open("new")}>+ Nouvelle rubrique</button></div>}
      {rubrics.error && <p className="form-error">{rubrics.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Rubrique</th><th>Nature</th><th>Calcul</th><th>Application</th><th>Compte</th><th /></tr></thead>
          <tbody>
            {(rubrics.data ?? []).map((rubric) => (
              <tr key={rubric.id}>
                <td className="strong-cell">{rubric.libelle}<small className="cell-detail">{rubric.code}{rubric.actif ? "" : " · désactivée"}</small></td>
                <td>{RUBRIC_TYPES[rubric.type]}</td>
                <td>{rubric.mode === "VARIABLE" ? RUBRIC_MODES.VARIABLE : rubric.mode === "FIXE" ? formatMoney(rubric.valeur) : `${Number(rubric.valeur)} ${RUBRIC_MODES[rubric.mode]}`}{rubric.plafond && <small className="cell-detail">Assiette plafonnée à {formatMoney(rubric.plafond)}</small>}</td>
                <td>{rubric.appliqueATous ? "Tous les employés" : "Sur attribution"}</td>
                <td>{rubric.compteNumero ?? "—"}</td>
                <td className="action-group">
                  {canEdit && <button className="row-action" onClick={() => open(rubric)}>Modifier</button>}
                  {canEdit && <button className="row-action" onClick={() => void action.run(async () => { await send(`/paie/rubriques/${rubric.id}`, "PATCH", { actif: !rubric.actif }); rubrics.reload(); })}>{rubric.actif ? "Désactiver" : "Réactiver"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={editing === "new" ? "Nouvelle rubrique de paie" : `Modifier · ${editing.libelle}`} onClose={() => setEditing(null)}>
          <form className="entity-form" onSubmit={save}>
            <div className="form-grid">
              <label>Code<input required disabled={editing !== "new"} minLength={2} maxLength={24} {...form.bind("code")} /></label>
              <label>Ordre d&apos;affichage<input type="number" min="0" max="999" {...form.bind("ordre")} /></label>
            </div>
            <label>Libellé<input required minLength={2} {...form.bind("libelle")} /></label>
            <div className="form-grid">
              <label>Nature<select {...form.bind("type")}>{Object.entries(RUBRIC_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Mode de calcul<select {...form.bind("mode")}>{Object.entries(RUBRIC_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            {form.values.mode !== "VARIABLE" && (
              <div className="form-grid">
                <label>{percent ? "Taux (%)" : "Montant (F)"}<input required type="number" min="0" step="0.01" {...form.bind("valeur")} /></label>
                {percent && <label>Plafond de l&apos;assiette (facultatif)<input type="number" min="1" {...form.bind("plafond")} /></label>}
              </div>
            )}
            <label>Compte comptable (retenues et charges)<input maxLength={12} placeholder="Ex. 431" {...form.bind("compteNumero")} /></label>
            <label className="check-row"><input type="checkbox" {...form.check("appliqueATous")} /><span>S&apos;applique à tous les employés<small>Sinon, seulement à ceux à qui une valeur est attribuée dans leur fiche.</small></span></label>
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} onCancel={() => setEditing(null)} />
          </form>
        </Modal>
      )}
    </>
  );
}

function SettingsTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const settings = useLoad<HrSettings>("/rh/parametres", signal);
  const categories = useLoad<ExpenseCategory[]>("/finances/categories", signal);
  const [draft, setDraft] = useState<HrSettings | null>(null);
  const action = useAction();
  const current = draft ?? settings.data;
  if (!current) return <p className="empty-state">{settings.error || "Chargement..."}</p>;
  const save = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/rh/parametres", "PATCH", { ...current, categoriePaieId: current.categoriePaieId || null });
      setDraft(null);
      settings.reload();
    });
  };
  return (
    <form className="entity-form finance-settings-form" onSubmit={save}>
      <div className="form-grid">
        <label>Jours de congé annuel<input required type="number" min="0" max="60" disabled={!canEdit} value={current.joursCongeAnnuel} onChange={(event) => setDraft({ ...current, joursCongeAnnuel: Number(event.target.value) })} /><small className="cell-detail">Acquis par douzième chaque mois travaillé.</small></label>
        <label>Jours ouvrés par mois<input required type="number" min="20" max="31" disabled={!canEdit} value={current.joursOuvresMois} onChange={(event) => setDraft({ ...current, joursOuvresMois: Number(event.target.value) })} /><small className="cell-detail">Une journée d&apos;absence vaut le salaire mensuel divisé par ce nombre.</small></label>
      </div>
      <label>
        Catégorie budgétaire de la paie
        <select disabled={!canEdit} value={current.categoriePaieId ?? ""} onChange={(event) => setDraft({ ...current, categoriePaieId: event.target.value })}>
          <option value="">Ne pas imputer la paie sur le budget</option>
          {(categories.data ?? []).filter((category) => category.actif).map((category) => <option key={category.id} value={category.id}>{category.nom}</option>)}
        </select>
        <small className="cell-detail">Le coût de chaque paie validée (brut et charges patronales) consomme le budget de cette catégorie.</small>
      </label>
      {action.error && <p className="form-error">{action.error}</p>}
      {canEdit && <div className="form-actions"><button className="primary-button compact" disabled={!draft || action.busy}>Enregistrer</button></div>}
    </form>
  );
}

export function PayrollPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  type Tab = "periodes" | "rubriques" | "reglages";
  const [tab, setTab] = useState<Tab | null>(null);
  const canEdit = hasAccess(user, "payroll", "edit");
  const canApprove = hasAccess(user, "payroll-approval", "edit");
  const canSettings = hasAccess(user, "hr", "edit");
  // Chiffres clés des cartes.
  const periods = useLoad<PeriodRow[]>(tab ? null : "/paie/periodes", refreshSignal);
  const rubrics = useLoad<Rubric[]>(tab ? null : "/paie/rubriques", refreshSignal);
  const settings = useLoad<HrSettings>(tab ? null : "/rh/parametres", refreshSignal);
  const pending = (periods.data ?? []).filter((period) => period.statut !== "PAYEE");
  const next = pending[0];
  const titles: Record<Tab, [string, string]> = {
    periodes: ["Paies", "Une paie par mois : préparation, validation, versement"],
    rubriques: ["Rubriques", "Primes, retenues et cotisations appliquées aux bulletins"],
    reglages: ["Réglages", "Règles de congé et lien avec le budget"],
  };
  const cards: HubCard<Tab>[] = [
    { key: "periodes", icon: CalendarCheck, title: "Paies mensuelles", value: periods.data ? `${periods.data.length}` : "…", detail: !periods.data ? "paie(s) mensuelle(s)" : next ? `paie(s) · ${monthLabel(next.annee, next.mois)} : ${PERIOD_STATUS[next.statut]?.label.toLowerCase() ?? next.statut}` : periods.data.length ? "Toutes les paies sont versées" : "Aucune paie ouverte pour l'instant", tone: next ? "warn" : undefined, info: "Une paie par mois. Ouvrez le mois : les bulletins se calculent seuls à partir des contrats, des heures de cours et des absences. Vous vérifiez, une autre personne valide, puis vous enregistrez le versement et éditez les bulletins." },
    { key: "rubriques", icon: ListChecks, title: "Rubriques de paie", value: rubrics.data ? `${rubrics.data.filter((item) => item.actif).length}` : "…", detail: "rubrique(s) active(s)", info: "Les lignes qui composent un bulletin : primes et indemnités, retenues, cotisations salariales et charges patronales. Pour chacune, réglez son mode de calcul (montant fixe ou pourcentage), son plafond et si elle s'applique à tous." },
    { key: "reglages", icon: SlidersHorizontal, title: "Réglages", value: settings.data ? `${settings.data.joursCongeAnnuel} j` : "…", detail: settings.data ? `de congé par an · ${settings.data.joursOuvresMois} jours ouvrés par mois` : "de congé par an", info: "Les règles communes : le nombre de jours de congé annuel, le nombre de jours ouvrés d'un mois (qui sert à calculer la retenue d'une absence) et la catégorie budgétaire sur laquelle la paie est imputée." },
  ];
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Ressources humaines" title="Paie" text="La paie se calcule seule à partir des contrats, des heures de cours déclarées et des absences. Vous vérifiez, une autre personne valide, puis le versement est enregistré." />
      {!tab && <HubCards cards={cards} onOpen={setTab} />}
      {tab && (
        <>
          <HubBack label="Paie" onBack={() => setTab(null)} />
          <Panel eyebrow={titles[tab][0]} title={titles[tab][1]}>
            {tab === "periodes" && <PeriodsTab canEdit={canEdit} canApprove={canApprove} signal={refreshSignal} />}
            {tab === "rubriques" && <RubricsTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "reglages" && <SettingsTab canEdit={canSettings} signal={refreshSignal} />}
          </Panel>
        </>
      )}
    </div>
  );
}
