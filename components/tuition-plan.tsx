"use client";

import { FormEvent, useState } from "react";
import { askConfirm, toast } from "@/components/feedback";
import { PaymentModeSelect } from "@/components/payment-mode";
import { hasAccess } from "@/lib/access";
import { TuitionLine, TuitionPlan, User, formatDate, formatMoney } from "@/lib/types";
import { Badge, FormActions, Modal, messageOf, send, useAction, useLoad, LoadingBlock } from "@/components/ui-kit";

type Dialog =
  | { kind: "collect"; ligne?: TuitionLine; maximum: number }
  | { kind: "reduction" }
  | { kind: "months" }
  | { kind: "line"; ligne?: TuitionLine }
  | null;

const lineStatus = (ligne: TuitionLine) => {
  if (ligne.reste <= 0) return <Badge tone="ok">Soldé</Badge>;
  if (ligne.dateLimite && new Date(ligne.dateLimite) < new Date()) return <Badge tone="bad">En retard</Badge>;
  return ligne.paye > 0 ? <Badge tone="run">En partie</Badge> : <Badge tone="wait">À payer</Badge>;
};

// Échéancier d'un étudiant : suivi, encaissement et faveurs individuelles au même endroit.
export function TuitionPlanPanel({ inscriptionId, user, onChanged }: { inscriptionId: string; user: User | null; onChanged?: () => void }) {
  const [signal, setSignal] = useState(0);
  const plan = useLoad<TuitionPlan>(`/frais-scolarite/inscriptions/${inscriptionId}`, signal);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [annexId, setAnnexId] = useState("");
  const canCollect = hasAccess(user, "payments", "edit");
  const canAdjust = hasAccess(user, "tuition-adjustments", "edit");
  const base = `/frais-scolarite/inscriptions/${inscriptionId}`;
  const reload = () => { setSignal((value) => value + 1); onChanged?.(); };
  const act = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action();
      if (done) toast(done);
      reload();
    } catch (failure) {
      toast(messageOf(failure), "error");
    }
  };
  const removeLine = async (ligne: TuitionLine) => {
    if (await askConfirm({ title: `Retirer « ${ligne.libelle} » ?`, message: "Cette ligne ne sera plus due par cet étudiant.", confirmLabel: "Retirer", danger: true }))
      void act(() => send(`${base}/lignes/${ligne.id}`, "DELETE", undefined, true), "Ligne retirée.");
  };
  const reset = async () => {
    if (await askConfirm({ title: "Revenir au paramétrage général ?", message: "Les faveurs de cet étudiant sont retirées et ses mois non payés recalculés. Ce qui est déjà payé ne change pas.", confirmLabel: "Revenir au paramétrage" }))
      void act(() => send(`${base}/reinitialiser`, "POST", undefined, true), "Échéancier recalculé.");
  };
  const data = plan.data;
  if (plan.error) return <p className="form-error">{plan.error}</p>;
  if (!data) return <LoadingBlock />;
  const next = data.mensualites.find((ligne) => ligne.reste > 0);
  const empty = !data.mensualites.length;
  return (
    <div className="tuition-plan">
      <div className="tuition-plan-head">
        <span><strong>{data.regime}</strong>{data.resteTotal > 0 ? ` · reste ${formatMoney(data.resteTotal)}` : " · tout est soldé"}</span>
        <span className="action-group">
          {canCollect && next && <button className="primary-button compact" onClick={() => setDialog({ kind: "collect", maximum: data.resteMensualites })}>Encaisser un mois</button>}
          {canAdjust && <button className="outline-button small" onClick={() => setDialog({ kind: "reduction" })}>Réduction</button>}
          {canAdjust && !empty && <button className="outline-button small" onClick={() => setDialog({ kind: "months" })}>Nombre de mois</button>}
          {canAdjust && <button className="outline-button small" onClick={() => setDialog({ kind: "line" })}>+ Échéance</button>}
          {canAdjust && (data.personnalise || data.reductionIndividuelle !== null) && <button className="outline-button small" onClick={() => void reset()}>Revenir au paramétrage</button>}
          {canAdjust && data.bourseRetiree && <button className="outline-button small" onClick={() => void act(() => send(`${base}/retablir-bourse`, "POST", undefined, true), "Bourse rétablie.")}>Rétablir la bourse</button>}
        </span>
      </div>
      {empty && <p className="panel-subtitle">Aucun échéancier : le calendrier ou le tarif de cette année et de ce niveau n&apos;est pas encore renseigné dans Frais de scolarité.</p>}
      {!empty && (
        <div className="table-wrap"><table>
          <thead><tr><th>Mois / échéance</th><th>Date limite</th><th>Montant</th><th>Payé</th><th>Reste</th><th>État</th>{canAdjust && <th />}</tr></thead>
          <tbody>
            {data.mensualites.map((ligne) => (
              <tr key={ligne.id}>
                <td className="strong-cell">{ligne.libelle}</td>
                <td>{ligne.dateLimite ? formatDate(ligne.dateLimite) : "—"}</td>
                <td>{formatMoney(ligne.montant)}</td>
                <td>{formatMoney(ligne.paye)}</td>
                <td>{formatMoney(ligne.reste)}</td>
                <td>{lineStatus(ligne)}</td>
                {canAdjust && <td className="action-group"><button className="row-action" onClick={() => setDialog({ kind: "line", ligne })}>Modifier</button>{ligne.paye <= 0 && <button className="row-action danger-row-action" onClick={() => void removeLine(ligne)}>Retirer</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <h4 className="dossier-subheading">Frais annexes</h4>
      {data.annexes.length > 0 ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Frais</th><th>Date limite</th><th>Montant</th><th>Payé</th><th>Reste</th><th>État</th><th /></tr></thead>
          <tbody>
            {data.annexes.map((ligne) => (
              <tr key={ligne.id}>
                <td className="strong-cell">{ligne.libelle}</td>
                <td>{ligne.dateLimite ? formatDate(ligne.dateLimite) : "—"}</td>
                <td>{formatMoney(ligne.montant)}</td>
                <td>{formatMoney(ligne.paye)}</td>
                <td>{formatMoney(ligne.reste)}</td>
                <td>{lineStatus(ligne)}</td>
                <td className="action-group">
                  {canCollect && ligne.reste > 0 && <button className="row-action" onClick={() => setDialog({ kind: "collect", ligne, maximum: ligne.reste })}>Encaisser</button>}
                  {canAdjust && <button className="row-action" onClick={() => setDialog({ kind: "line", ligne })}>Modifier</button>}
                  {(canAdjust || canCollect) && ligne.paye <= 0 && <button className="row-action danger-row-action" onClick={() => void removeLine(ligne)}>Retirer</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : <p className="panel-subtitle">Aucun frais annexe sur ce dossier.</p>}
      {(canCollect || canAdjust) && data.annexesDisponibles.length > 0 && (
        <div className="tuition-generator">
          <label>Ajouter un frais<select value={annexId} onChange={(event) => setAnnexId(event.target.value)}><option value="">Choisir...</option>{data.annexesDisponibles.map((annexe) => <option key={annexe.id} value={annexe.id}>{annexe.nom} · {formatMoney(annexe.montant)}</option>)}</select></label>
          <button className="outline-button small" disabled={!annexId} onClick={() => { const fraisAnnexeId = annexId; setAnnexId(""); void act(() => send(`${base}/annexes`, "POST", { fraisAnnexeId }, true), "Frais ajouté."); }}>Ajouter</button>
        </div>
      )}
      {dialog?.kind === "collect" && <CollectDialog inscriptionId={inscriptionId} ligne={dialog.ligne} suggested={dialog.ligne ? dialog.ligne.reste : next?.reste ?? 0} maximum={dialog.maximum} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === "reduction" && <NumberDialog title="Réduction pour cet étudiant" label="Réduction sur les mois (%)" initial={data.reductionIndividuelle === null ? "" : String(data.reductionIndividuelle)} max={100} note="Elle remplace la réduction de sa bourse pour les mois non payés. Laissez vide pour la retirer." onClose={() => setDialog(null)} onSubmit={(value) => send(`${base}/reduction`, "POST", { taux: value }, true)} onSaved={reload} />}
      {dialog?.kind === "months" && <NumberDialog required title="Nombre de mois à payer" label="Cet étudiant ne paie que" initial={String(data.mensualites.length)} max={24} note="Les premiers mois sont gardés. Vous pouvez ensuite modifier leurs montants et leurs dates." onClose={() => setDialog(null)} onSubmit={(value) => send(`${base}/nombre-mois`, "POST", { nombre: Number(value) }, true)} onSaved={reload} />}
      {dialog?.kind === "line" && <LineDialog base={base} ligne={dialog.ligne} onClose={() => setDialog(null)} onSaved={reload} />}
    </div>
  );
}

function CollectDialog({ inscriptionId, ligne, suggested, maximum, onClose, onSaved }: { inscriptionId: string; ligne?: TuitionLine; suggested: number; maximum: number; onClose: () => void; onSaved: () => void }) {
  const [montant, setMontant] = useState(String(suggested));
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const action = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/paiements", "POST", ligne ? { inscriptionId, ligneScolariteId: ligne.id, montant, modePaiement, typePaiement: "FRAIS_ANNEXE" } : { inscriptionId, montant, modePaiement, typePaiement: "MENSUALITE" }, true);
      toast("Paiement enregistré. Le reçu se trouve dans le journal des encaissements.");
      onSaved();
      onClose();
    });
  };
  return (
    <Modal title={ligne ? `Encaisser · ${ligne.libelle}` : "Encaisser la scolarité"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>Montant<input required autoFocus type="number" min="1" max={maximum} step="0.01" value={montant} onChange={(event) => setMontant(event.target.value)} /></label>
        <p className="panel-subtitle">{ligne ? `Reste sur ce frais : ${formatMoney(maximum)}.` : `Le versement solde les mois du plus ancien au plus récent. Reste sur l'année : ${formatMoney(maximum)}.`}</p>
        <PaymentModeSelect value={modePaiement} onChange={setModePaiement} />
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function NumberDialog({ title, label, initial, max, note, required, onClose, onSubmit, onSaved }: { title: string; label: string; initial: string; max: number; note: string; required?: boolean; onClose: () => void; onSubmit: (value: string) => Promise<unknown>; onSaved: () => void }) {
  const [value, setValue] = useState(initial);
  const action = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await onSubmit(value);
      onSaved();
      onClose();
    });
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>{label}<input required={required} autoFocus type="number" min="0" max={max} step={required ? 1 : 0.01} value={value} onChange={(event) => setValue(event.target.value)} /></label>
        <p className="panel-subtitle">{note}</p>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function LineDialog({ base, ligne, onClose, onSaved }: { base: string; ligne?: TuitionLine; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ libelle: ligne?.libelle ?? "", montant: ligne ? String(ligne.montant) : "", dateLimite: ligne?.dateLimite ? ligne.dateLimite.slice(0, 10) : "" });
  const action = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send(ligne ? `${base}/lignes/${ligne.id}` : `${base}/lignes`, ligne ? "PUT" : "POST", form, true);
      onSaved();
      onClose();
    });
  };
  return (
    <Modal title={ligne ? `Modifier · ${ligne.libelle}` : "Nouvelle échéance pour cet étudiant"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>Nom<input required autoFocus value={form.libelle} onChange={(event) => setForm({ ...form, libelle: event.target.value })} /></label>
        <div className="form-grid">
          <label>Montant<input required type="number" min="0" step="0.01" value={form.montant} onChange={(event) => setForm({ ...form, montant: event.target.value })} /></label>
          <label>Date limite<input type="date" value={form.dateLimite} onChange={(event) => setForm({ ...form, dateLimite: event.target.value })} /></label>
        </div>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
