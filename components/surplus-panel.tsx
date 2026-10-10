"use client";

import { FormEvent, useState } from "react";
import { toast } from "@/components/feedback";
import { RefundReceipt } from "@/components/refund-receipt";
import { apiFetch } from "@/lib/api";
import { ApplicationFinance, PaymentTransaction, formatMoney } from "@/lib/types";

type Obligation = ApplicationFinance["obligations"][number];

// Ce qui a été payé en plus du montant dû sur une obligation.
export const surplusOf = (item: Obligation) => Math.max(0, Math.round((Number(item.montantPaye) - Number(item.montantAttendu)) * 100) / 100);

const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : "L'opération n'a pas pu être enregistrée.");
const amountOf = (value: string) => Number(value.replace(",", "."));

function CarryOverForm({ source, targets, onCancel, onDone }: { source: Obligation; targets: Obligation[]; onCancel: () => void; onDone: () => void }) {
  const surplus = surplusOf(source);
  const [targetId, setTargetId] = useState(targets[0].id);
  const target = targets.find((item) => item.id === targetId) ?? targets[0];
  const maximum = Math.min(surplus, Number(target.resteAPayer));
  const [amount, setAmount] = useState(String(Math.min(surplus, Number(targets[0].resteAPayer))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choose = (id: string) => {
    setTargetId(id);
    const next = targets.find((item) => item.id === id);
    if (next) setAmount(String(Math.min(surplus, Number(next.resteAPayer))));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = amountOf(amount);
    if (!(value > 0) || value > maximum) {
      setError(`Saisissez un montant entre 1 F et ${formatMoney(maximum)}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch("/paiements/reports", { method: "POST", silent: true, body: JSON.stringify({ elementDossierId: source.id, cibleElementDossierId: target.id, montant: String(value) }) });
      toast(`${formatMoney(value)} reportés sur « ${target.nom} ». Aucun argent n'est sorti de la caisse.`);
      onDone();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="entity-form surplus-form" onSubmit={submit}>
      <p className="eyebrow">Reporter sur une autre obligation</p>
      <p className="panel-subtitle">L&apos;argent reste dans la caisse : il sert à payer une autre obligation du même dossier.</p>
      <div className="surplus-targets" role="radiogroup" aria-label="Obligation qui reçoit le report">
        {targets.map((item) => (
          <button type="button" role="radio" aria-checked={item.id === target.id} key={item.id} className="surplus-target" onClick={() => choose(item.id)}>
            <strong>{item.nom}</strong>
            <small>Reste à payer : {formatMoney(item.resteAPayer)}</small>
          </button>
        ))}
      </div>
      <label>
        Montant à reporter
        <input required type="number" min="1" max={maximum} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <p className="panel-subtitle">Maximum : {formatMoney(maximum)}{maximum < surplus ? ` (« ${target.nom} » n'attend pas plus). Le reste du trop-perçu pourra être reporté ailleurs ou remboursé.` : "."}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
        <button className="primary-button compact" disabled={busy}>{busy ? "Enregistrement..." : "Reporter"}</button>
      </div>
    </form>
  );
}

function RefundForm({ source, onCancel, onDone }: { source: Obligation; onCancel: () => void; onDone: (refund: PaymentTransaction) => void }) {
  const surplus = surplusOf(source);
  const [amount, setAmount] = useState(String(surplus));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = amountOf(amount);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!(value > 0) || value > surplus) {
      setError(`Saisissez un montant entre 1 F et ${formatMoney(surplus)}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const refund = await apiFetch<PaymentTransaction>("/paiements/remboursements", { method: "POST", silent: true, body: JSON.stringify({ elementDossierId: source.id, montant: String(value), motif: reason.trim() }) });
      toast(`Remboursement de ${formatMoney(value)} enregistré. Faites signer le reçu.`);
      onDone(refund);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="entity-form surplus-form" onSubmit={submit}>
      <p className="eyebrow">Rembourser l&apos;étudiant</p>
      <p className="panel-subtitle">Cette somme sort de la caisse. Remettez l&apos;argent à l&apos;étudiant ou à son parent, puis faites-lui signer le reçu qui s&apos;affichera.</p>
      <label>
        Montant à rembourser
        <input required type="number" min="1" max={surplus} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <p className="panel-subtitle">Maximum : {formatMoney(surplus)} (trop-perçu sur « {source.nom} »).</p>
      <label className="deletion-reason-label">
        Motif du remboursement
        <textarea className="deletion-reason-input" required minLength={5} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex. : inscrit par erreur en L2, repassé en L1 (5 caractères minimum)" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
        <button className="danger-solid-button" disabled={busy || reason.trim().length < 5}>{busy ? "Enregistrement..." : `Rembourser ${value > 0 && value <= surplus ? formatMoney(value) : ""} et afficher le reçu`}</button>
      </div>
    </form>
  );
}

// Signale chaque trop-perçu du dossier et propose les deux façons de le régulariser.
export function SurplusPanel({ obligations, onChanged }: { obligations: Obligation[]; onChanged: () => void }) {
  const [action, setAction] = useState<{ kind: "report" | "refund"; id: string } | null>(null);
  const [receipt, setReceipt] = useState<PaymentTransaction | null>(null);
  const sources = obligations.filter((item) => surplusOf(item) > 0);
  const finish = () => { setAction(null); onChanged(); };
  return (
    <>
      {sources.map((source) => {
        const targets = obligations.filter((item) => item.id !== source.id && Number(item.resteAPayer) > 0);
        const current = action?.id === source.id ? action.kind : null;
        return (
          <section className="surplus-notice" key={source.id} role="status">
            <strong>Trop-perçu de {formatMoney(surplusOf(source))} sur « {source.nom} »</strong>
            <p>L&apos;étudiant a payé {formatMoney(source.montantPaye)} alors que cette obligation est de {formatMoney(source.montantAttendu)}. Choisissez avec lui ou son parent ce que devient la différence.</p>
            {!current && (
              <div className="surplus-actions">
                <button type="button" className="outline-button small" disabled={!targets.length} onClick={() => setAction({ kind: "report", id: source.id })}>Reporter sur une autre obligation</button>
                <button type="button" className="outline-button small" onClick={() => setAction({ kind: "refund", id: source.id })}>Rembourser l&apos;étudiant</button>
              </div>
            )}
            {!current && !targets.length && <p className="surplus-hint">Aucune autre obligation de ce dossier n&apos;a de reste à payer : seul le remboursement est possible.</p>}
            {current === "report" && targets.length > 0 && <CarryOverForm source={source} targets={targets} onCancel={() => setAction(null)} onDone={finish} />}
            {current === "refund" && <RefundForm source={source} onCancel={() => setAction(null)} onDone={(refund) => { setReceipt(refund); finish(); }} />}
          </section>
        );
      })}
      {receipt && <RefundReceipt refund={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
