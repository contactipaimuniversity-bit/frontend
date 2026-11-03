"use client";

import { FormEvent, useState } from "react";
import { askConfirm, toast } from "@/components/feedback";
import { PaymentModeSelect } from "@/components/payment-mode";
import { hasAccess } from "@/lib/access";
import { TuitionException, TuitionLine, TuitionPlan, User, formatDate, formatMoney, tuitionExceptionLabel } from "@/lib/types";
import { Badge, FormActions, Modal, messageOf, send, useAction, useLoad, LoadingBlock } from "@/components/ui-kit";

// Ce qu'on encaisse : la scolarité (du plus ancien mois au plus récent), un frais
// annexe ou un frais d'inscription.
type CollectTarget = { kind: "mois"; ligne?: TuitionLine } | { kind: "annexe"; ligne: TuitionLine } | { kind: "inscription"; ligne: TuitionLine };
type ExceptionTarget = { kind: "mois" | "inscription"; ligne: TuitionLine };

type Dialog =
  | { kind: "collect"; target: CollectTarget }
  | { kind: "exception"; target: ExceptionTarget }
  | { kind: "reduction" }
  | { kind: "months" }
  | { kind: "line"; ligne?: TuitionLine }
  | null;

const lineStatus = (ligne: TuitionLine) => {
  if (ligne.reste <= 0) return ligne.montant <= 0 && ligne.exception ? <Badge tone="off">Rien à payer</Badge> : <Badge tone="ok">Soldé</Badge>;
  if (ligne.dateLimite && new Date(ligne.dateLimite) < new Date()) return <Badge tone="bad">{ligne.paye > 0 ? "En retard · en partie" : "En retard"}</Badge>;
  return ligne.paye > 0 ? <Badge tone="run">En partie</Badge> : <Badge tone="wait">À payer</Badge>;
};

// Le nom de la ligne, avec son exception : badge, motif et qui l'a accordée. Le montant
// d'avant n'est rappelé que pour un frais fixe : celui d'un mois suit le paramétrage.
function LineName({ ligne, showInitial }: { ligne: TuitionLine; showInitial?: boolean }) {
  const exception = ligne.exception;
  return (
    <td className="strong-cell">
      {ligne.libelle}
      {exception && (
        <span className="tuition-exception">
          <Badge tone="run">Exception · {tuitionExceptionLabel(exception)}</Badge>
          <small>{exception.motif} — accordée par {exception.parNom} le {formatDate(exception.le)}{showInitial ? ` (au lieu de ${formatMoney(exception.montantInitial)})` : ""}</small>
        </span>
      )}
    </td>
  );
}

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
    if (await askConfirm({ title: "Revenir au paramétrage général ?", message: "Les faveurs de cet étudiant sont retirées et ses mois non payés recalculés. Ce qui est déjà payé ne change pas. Les exceptions accordées restent.", confirmLabel: "Revenir au paramétrage" }))
      void act(() => send(`${base}/reinitialiser`, "POST", undefined, true), "Échéancier recalculé.");
  };
  const removeException = async (ligne: TuitionLine, fixed = false) => {
    if (!ligne.exception) return;
    if (await askConfirm({ title: `Retirer l'exception sur « ${ligne.libelle} » ?`, message: fixed ? `La ligne revient à ${formatMoney(ligne.exception.montantInitial)}.` : "La ligne revient au montant prévu par le paramétrage.", confirmLabel: "Retirer l'exception", danger: true }))
      void act(() => send(`${base}/exceptions/${ligne.exception!.id}`, "DELETE", undefined, true), "Exception retirée.");
  };
  // Les boutons d'une ligne due : exception (ou son retrait) et encaissement.
  const exceptionButtons = (kind: ExceptionTarget["kind"], ligne: TuitionLine) => {
    if (!canAdjust) return null;
    if (ligne.exception) return ligne.paye <= 0 ? <button className="row-action" onClick={() => void removeException(ligne, kind === "inscription")}>Retirer l&apos;exception</button> : null;
    return ligne.reste > 0 ? <button className="row-action" onClick={() => setDialog({ kind: "exception", target: { kind, ligne } })}>Exception</button> : null;
  };
  const data = plan.data;
  if (plan.error) return <p className="form-error">{plan.error}</p>;
  if (!data) return <LoadingBlock />;
  // Les versements soldent les mois dans l'ordre : seul le plus ancien non soldé s'encaisse.
  const next = data.mensualites.find((ligne) => ligne.reste > 0);
  const empty = !data.mensualites.length;
  const fraisInscription = data.fraisInscription ?? [];
  return (
    <div className="tuition-plan">
      <div className="tuition-plan-head">
        <span><strong>{data.regime}</strong>{data.resteTotal > 0 ? ` · reste ${formatMoney(data.resteTotal)}` : " · tout est soldé"}</span>
        <span className="action-group">
          {canCollect && next && <button className="primary-button compact" onClick={() => setDialog({ kind: "collect", target: { kind: "mois" } })}>Encaisser la scolarité</button>}
          {canAdjust && <button className="outline-button small" onClick={() => setDialog({ kind: "reduction" })}>Réduction</button>}
          {canAdjust && !empty && <button className="outline-button small" onClick={() => setDialog({ kind: "months" })}>Nombre de mois</button>}
          {canAdjust && <button className="outline-button small" onClick={() => setDialog({ kind: "line" })}>+ Échéance</button>}
          {canAdjust && (data.personnalise || data.reductionIndividuelle !== null) && <button className="outline-button small" onClick={() => void reset()}>Revenir au paramétrage</button>}
          {canAdjust && data.bourseRetiree && <button className="outline-button small" onClick={() => void act(() => send(`${base}/retablir-bourse`, "POST", undefined, true), "Bourse rétablie.")}>Rétablir la bourse</button>}
        </span>
      </div>
      {data.personnalise && <p className="panel-subtitle">Échéancier retouché à la main : les changements du paramétrage (tarifs, mois, bourse) ne s&apos;y appliquent plus. « Revenir au paramétrage » le remet à jour.</p>}
      {data.tropPercu > 0 && <p className="form-error">{formatMoney(data.tropPercu)} ont été versés en plus de tous les mois dus (un mois retiré après paiement, par exemple) : à rembourser ou à réaffecter.</p>}
      {empty && <p className="panel-subtitle">Aucun échéancier : le calendrier ou le tarif de cette année et de ce niveau n&apos;est pas encore renseigné dans Frais de scolarité.</p>}
      {!empty && (
        <div className="table-wrap"><table>
          <thead><tr><th>Mois / échéance</th><th>Date limite</th><th>Montant</th><th>Payé</th><th>Reste</th><th>État</th>{(canAdjust || canCollect) && <th />}</tr></thead>
          <tbody>
            {data.mensualites.map((ligne) => (
              <tr key={ligne.id}>
                <LineName ligne={ligne} />
                <td>{ligne.dateLimite ? formatDate(ligne.dateLimite) : "—"}</td>
                <td>{formatMoney(ligne.montant)}</td>
                <td>{formatMoney(ligne.paye)}</td>
                <td>{formatMoney(ligne.reste)}</td>
                <td>{lineStatus(ligne)}</td>
                {(canAdjust || canCollect) && (
                  <td className="action-group">
                    {canCollect && ligne.id === next?.id && <button className="row-action" onClick={() => setDialog({ kind: "collect", target: { kind: "mois", ligne } })}>{ligne.paye > 0 ? "Compléter" : "Encaisser"}</button>}
                    {exceptionButtons("mois", ligne)}
                    {canAdjust && <button className="row-action" onClick={() => setDialog({ kind: "line", ligne })}>Modifier</button>}
                    {canAdjust && ligne.paye <= 0 && <button className="row-action danger-row-action" onClick={() => void removeLine(ligne)}>Retirer</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {fraisInscription.length > 0 && (
        <>
          <h4 className="dossier-subheading">Frais d&apos;inscription</h4>
          <div className="table-wrap"><table>
            <thead><tr><th>Frais</th><th>Montant</th><th>Payé</th><th>Reste</th><th>État</th>{(canAdjust || canCollect) && <th />}</tr></thead>
            <tbody>
              {fraisInscription.map((ligne) => (
                <tr key={ligne.id}>
                  <LineName ligne={ligne} showInitial />
                  <td>{formatMoney(ligne.montant)}</td>
                  <td>{formatMoney(ligne.paye)}</td>
                  <td>{formatMoney(ligne.reste)}</td>
                  <td>{lineStatus(ligne)}</td>
                  {(canAdjust || canCollect) && (
                    <td className="action-group">
                      {canCollect && ligne.reste > 0 && <button className="row-action" onClick={() => setDialog({ kind: "collect", target: { kind: "inscription", ligne } })}>{ligne.paye > 0 ? "Compléter" : "Encaisser"}</button>}
                      {exceptionButtons("inscription", ligne)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
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
                  {canCollect && ligne.reste > 0 && <button className="row-action" onClick={() => setDialog({ kind: "collect", target: { kind: "annexe", ligne } })}>{ligne.paye > 0 ? "Compléter" : "Encaisser"}</button>}
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
      {dialog?.kind === "collect" && <CollectDialog inscriptionId={inscriptionId} target={dialog.target} next={next} resteMensualites={data.resteMensualites} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === "exception" && <ExceptionDialog base={base} target={dialog.target} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === "reduction" && <NumberDialog title="Réduction pour cet étudiant" label="Réduction sur les mois (%)" initial={data.reductionIndividuelle === null ? "" : String(data.reductionIndividuelle)} max={100} note="Elle remplace la réduction de sa bourse pour les mois non payés. Laissez vide pour la retirer." onClose={() => setDialog(null)} onSubmit={(value) => send(`${base}/reduction`, "POST", { taux: value }, true)} onSaved={reload} />}
      {dialog?.kind === "months" && <NumberDialog required title="Nombre de mois à payer" label="Cet étudiant ne paie que" initial={String(data.mensualites.length)} max={24} note="Les premiers mois sont gardés. Vous pouvez ensuite modifier leurs montants et leurs dates." onClose={() => setDialog(null)} onSubmit={(value) => send(`${base}/nombre-mois`, "POST", { nombre: Number(value) }, true)} onSaved={reload} />}
      {dialog?.kind === "line" && <LineDialog base={base} ligne={dialog.ligne} onClose={() => setDialog(null)} onSaved={reload} />}
    </div>
  );
}

function CollectDialog({ inscriptionId, target, next, resteMensualites, onClose, onSaved }: { inscriptionId: string; target: CollectTarget; next?: TuitionLine; resteMensualites: number; onClose: () => void; onSaved: () => void }) {
  // Pour les mois, on propose le reste du plus ancien : un clic suffit à le compléter.
  const ligne = target.kind === "mois" ? target.ligne ?? next : target.ligne;
  const maximum = target.kind === "mois" ? resteMensualites : target.ligne.reste;
  const [montant, setMontant] = useState(String(ligne?.reste ?? 0));
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const action = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload =
      target.kind === "annexe" ? { inscriptionId, ligneScolariteId: target.ligne.id, montant, modePaiement, typePaiement: "FRAIS_ANNEXE" }
      : target.kind === "inscription" ? { inscriptionId, elementDossierId: target.ligne.id, montant, modePaiement, typePaiement: "FRAIS_INSCRIPTION" }
      : { inscriptionId, montant, modePaiement, typePaiement: "MENSUALITE" };
    void action.run(async () => {
      await send("/paiements", "POST", payload, true);
      toast("Paiement enregistré. Le reçu se trouve dans le journal des encaissements.");
      onSaved();
      onClose();
    });
  };
  const verb = ligne && ligne.paye > 0 ? "Compléter" : "Encaisser";
  return (
    <Modal title={ligne ? `${verb} · ${ligne.libelle}` : "Encaisser la scolarité"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        {ligne && ligne.paye > 0 && <p className="tuition-preview">Déjà versé : {formatMoney(ligne.paye)} sur {formatMoney(ligne.montant)}. Il reste {formatMoney(ligne.reste)} pour solder cette ligne.</p>}
        <label>Montant<input required autoFocus type="number" min="1" max={maximum} step="0.01" value={montant} onChange={(event) => setMontant(event.target.value)} /></label>
        <p className="panel-subtitle">{target.kind === "mois" ? `Le versement solde les mois du plus ancien au plus récent ; au-delà de ce mois, il passe au suivant. Reste sur l'année : ${formatMoney(maximum)}.` : `Reste sur ce frais : ${formatMoney(maximum)}.`}</p>
        <PaymentModeSelect value={modePaiement} onChange={setModePaiement} />
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

const EXCEPTION_MODES = [
  { mode: "EXONERATION", title: "Exonérer", detail: "Il ne paie pas cette ligne." },
  { mode: "POURCENTAGE", title: "Réduction en %", detail: "Par exemple −50 % sur cette ligne seulement." },
  { mode: "MONTANT", title: "Montant fixe", detail: "Il paie ce montant au lieu du montant prévu." },
] as const;

function ExceptionDialog({ base, target, onClose, onSaved }: { base: string; target: ExceptionTarget; onClose: () => void; onSaved: () => void }) {
  const { ligne } = target;
  const [mode, setMode] = useState<TuitionException["mode"]>("EXONERATION");
  const [valeur, setValeur] = useState("");
  const [motif, setMotif] = useState("");
  const action = useAction();
  const nombre = Number(valeur.replace(",", "."));
  const apres = mode === "EXONERATION" ? 0 : !valeur || !Number.isFinite(nombre) ? null : mode === "POURCENTAGE" ? Math.round(ligne.montant * (1 - nombre / 100) * 100) / 100 : nombre;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send(`${base}/exceptions`, "POST", { ...(target.kind === "mois" ? { mois: ligne.libelle } : { elementDossierId: ligne.id }), mode, valeur: mode === "EXONERATION" ? null : valeur, motif }, true);
      toast("Exception accordée.");
      onSaved();
      onClose();
    });
  };
  return (
    <Modal title={`Exception · ${ligne.libelle}`} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Montant prévu : {formatMoney(ligne.montant)}{ligne.paye > 0 ? `, dont ${formatMoney(ligne.paye)} déjà versés` : ""}.</p>
        <div className="tuition-choices">
          {EXCEPTION_MODES.map((item) => (
            <button key={item.mode} type="button" className={mode === item.mode ? "active" : ""} onClick={() => { setMode(item.mode); setValeur(""); }}>
              <strong>{item.title}</strong><small>{item.detail}</small>
            </button>
          ))}
        </div>
        {mode !== "EXONERATION" && <label>{mode === "POURCENTAGE" ? "Réduction (%)" : "Montant à payer"}<input required autoFocus type="number" min={mode === "POURCENTAGE" ? 1 : 0} max={mode === "POURCENTAGE" ? 100 : ligne.montant} step="0.01" value={valeur} onChange={(event) => setValeur(event.target.value)} /></label>}
        <label>Motif<textarea required maxLength={300} rows={2} placeholder="Pourquoi cette exception ? Il restera affiché sur la ligne." value={motif} onChange={(event) => setMotif(event.target.value)} /></label>
        {apres !== null && <p className="tuition-preview">Il paiera {formatMoney(apres)} pour « {ligne.libelle} » au lieu de {formatMoney(ligne.montant)}.</p>}
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
