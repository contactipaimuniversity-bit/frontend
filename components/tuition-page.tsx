"use client";

import { FormEvent, useMemo, useState } from "react";
import { CalendarDays, Coins, GraduationCap, Shirt, UserCheck } from "lucide-react";
import { askConfirm, askReason, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { TuitionAnnex, TuitionScholarship, TuitionSettings, User, formatDate, formatMoney } from "@/lib/types";
import { Badge, Empty, FormActions, HubBack, HubCard, HubCards, Modal, PageIntro, Panel, messageOf, send, useAction, useHubSection, useLoad } from "@/components/ui-kit";

type Section = "calendrier" | "tarifs" | "bourses" | "annexes" | "confirmer";
const SECTIONS: Section[] = ["calendrier", "tarifs", "bourses", "annexes", "confirmer"];
type MonthRow = { libelle: string; dateLimite: string };
type Pending = { inscriptionId: string; deliberationId: string; personne: { nom: string; prenom: string; matricule?: string | null }; bourse: string; moyenne: number; moyenneMinimale: number; periode: string; classe: string };

const dayOf = (value?: string | null) => (value ? value.slice(0, 10) : "");
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const isoDay = (year: number, month: number, day: number) => {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, last))).toISOString().slice(0, 10);
};

// Les mois d'une période, avec le même jour limite chaque mois.
function monthsFrom(start: string, count: number, day: number): MonthRow[] {
  const [year, month] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    return {
      libelle: capitalized(new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)),
      dateLimite: isoDay(date.getUTCFullYear(), date.getUTCMonth(), day),
    };
  });
}

function CalendarPanel({ settings, canEdit, onSaved }: { settings: TuitionSettings; canEdit: boolean; onSaved: () => void }) {
  const year = settings.annees.find((item) => item.libelle === settings.annee);
  const [rows, setRows] = useState<MonthRow[]>(() => settings.mois.map((item) => ({ libelle: item.libelle, dateLimite: dayOf(item.dateLimite) })));
  const [start, setStart] = useState(() => dayOf(year?.dateDebut).slice(0, 7));
  const [count, setCount] = useState("9");
  const [day, setDay] = useState("5");
  const action = useAction();
  const update = (index: number, patch: Partial<MonthRow>) => setRows(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  const generate = () => {
    if (start && Number(count) > 0) setRows(monthsFrom(start, Number(count), Number(day) || 5));
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/frais-scolarite/calendrier", "PUT", { anneeScolaire: settings.annee, mois: rows });
      onSaved();
    });
  };
  return (
    <Panel eyebrow="Année scolaire" title={`Mois à payer · ${settings.annee || "aucune année"}`} subtitle="Les mois que paient les étudiants au tarif normal, et leur date limite.">
      {canEdit && (
        <div className="tuition-generator">
          <label>Premier mois<input type="month" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>Nombre de mois<input type="number" min="1" max="24" value={count} onChange={(event) => setCount(event.target.value)} /></label>
          <label>Jour limite<input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} /></label>
          <button type="button" className="outline-button small" onClick={generate}>Préparer les mois</button>
        </div>
      )}
      <form className="entity-form" onSubmit={save}>
        <div className="table-wrap"><table>
          <thead><tr><th>Mois</th><th>Date limite</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>{canEdit ? <input required aria-label="Nom du mois" value={row.libelle} onChange={(event) => update(index, { libelle: event.target.value })} /> : row.libelle}</td>
                <td>{canEdit ? <input required type="date" aria-label="Date limite" value={row.dateLimite} onChange={(event) => update(index, { dateLimite: event.target.value })} /> : formatDate(row.dateLimite)}</td>
                {canEdit && <td><button type="button" className="row-action danger-row-action" onClick={() => setRows(rows.filter((_, position) => position !== index))}>Retirer</button></td>}
              </tr>
            ))}
            {!rows.length && <Empty columns={canEdit ? 3 : 2}>Aucun mois : indiquez le premier mois et le nombre de mois, puis « Préparer les mois ».</Empty>}
          </tbody>
        </table></div>
        {action.error && <p className="form-error">{action.error}</p>}
        {canEdit && <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => setRows([...rows, { libelle: "", dateLimite: "" }])}>+ Ajouter un mois</button>
          <button className="primary-button compact" disabled={action.busy}>{action.busy ? "Enregistrement..." : "Enregistrer le calendrier"}</button>
        </div>}
      </form>
    </Panel>
  );
}

const tariffKey = (niveau: string, filiereId: string | null) => `${filiereId ?? ""}|${niveau}`;

function TariffPanel({ settings, canEdit, onSaved }: { settings: TuitionSettings; canEdit: boolean; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(settings.tarifs.map((tarif) => [tariffKey(tarif.niveau, tarif.filiereId), String(Number(tarif.montantMensuel))])));
  const action = useAction();
  const cell = (niveau: string, filiereId: string | null) => {
    const key = tariffKey(niveau, filiereId);
    return canEdit ? (
      <input className="tuition-price" type="number" min="0" step="500" aria-label={`Prix ${niveau}`} placeholder={filiereId ? (values[tariffKey(niveau, null)] ?? "—") : "Prix"} value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
    ) : (values[key] ? formatMoney(values[key]) : <span className="muted-action">{filiereId ? "Prix du niveau" : "—"}</span>);
  };
  const save = () =>
    void action.run(async () => {
      await send("/frais-scolarite/tarifs", "PUT", {
        tarifs: Object.entries(values).filter(([, value]) => value !== "").map(([key, montantMensuel]) => {
          const [filiereId, niveau] = key.split("|");
          return { niveau, filiereId: filiereId || null, montantMensuel };
        }),
      });
      onSaved();
    });
  return (
    <Panel eyebrow="Prix d'un mois" title="Tarifs par niveau et par filière" subtitle="Remplissez la première ligne. Pour une filière, ne saisissez un prix que s'il est différent : une case vide reprend le prix du niveau.">
      <div className="table-wrap"><table>
        <thead><tr><th>Filière</th>{settings.niveaux.map((niveau) => <th key={niveau.code}>{niveau.code}</th>)}</tr></thead>
        <tbody>
          <tr><td className="strong-cell">Prix du niveau</td>{settings.niveaux.map((niveau) => <td key={niveau.code}>{cell(niveau.code, null)}</td>)}</tr>
          {settings.filieres.map((filiere) => (
            <tr key={filiere.id}><td>{filiere.nom}</td>{settings.niveaux.map((niveau) => <td key={niveau.code}>{cell(niveau.code, filiere.id)}</td>)}</tr>
          ))}
        </tbody>
      </table></div>
      {action.error && <p className="form-error">{action.error}</p>}
      {canEdit && <div className="form-actions"><button className="primary-button compact" disabled={action.busy} onClick={save}>{action.busy ? "Enregistrement..." : "Enregistrer les tarifs"}</button></div>}
    </Panel>
  );
}

type ScholarshipDraft = { nom: string; modeScolarite: string; tauxReduction: string; reductionSurInscription: boolean; moyenneMinimale: string; verificationMoyenne: string; echeances: Array<{ libelle: string; dateEcheance: string; montantAttendu: string }> };

function ScholarshipForm({ settings, bourse, onClose, onSaved }: { settings: TuitionSettings; bourse: TuitionScholarship | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ScholarshipDraft>({
    nom: bourse?.nom ?? "",
    modeScolarite: bourse?.modeScolarite ?? "REDUCTION",
    tauxReduction: bourse?.tauxReduction === null || bourse?.tauxReduction === undefined ? "" : String(Number(bourse.tauxReduction)),
    reductionSurInscription: bourse?.reductionSurInscription ?? false,
    moyenneMinimale: bourse ? (bourse.moyenneMinimale === null ? "" : String(Number(bourse.moyenneMinimale))) : "12",
    verificationMoyenne: bourse?.verificationMoyenne ?? "SEMESTRE",
    echeances: (bourse?.echeances ?? []).map((item) => ({ libelle: item.libelle, dateEcheance: dayOf(item.dateEcheance), montantAttendu: item.montantAttendu === null || item.montantAttendu === undefined ? "" : String(Number(item.montantAttendu)) })),
  });
  const [count, setCount] = useState(String(bourse?.echeances?.length || 4));
  const action = useAction();
  const fixed = form.modeScolarite === "MOIS_FIXES";
  const reference = settings.tarifs.find((tarif) => tarif.filiereId === null);
  const price = reference ? Number(reference.montantMensuel) : null;
  const setInstalment = (index: number, patch: Partial<ScholarshipDraft["echeances"][number]>) => setForm({ ...form, echeances: form.echeances.map((item, position) => (position === index ? { ...item, ...patch } : item)) });
  const fromCalendar = () => setForm({ ...form, echeances: Array.from({ length: Number(count) || 0 }, (_, index) => {
    const month = settings.mois[index];
    return { libelle: month?.libelle ?? `Échéance ${index + 1}`, dateEcheance: dayOf(month?.dateLimite), montantAttendu: "" };
  }) });
  // Aperçu immédiat de ce que paiera l'étudiant.
  const preview = useMemo(() => {
    if (price === null) return "Renseignez d'abord les tarifs pour voir un aperçu.";
    if (fixed) {
      const total = form.echeances.reduce((sum, item) => sum + (item.montantAttendu === "" ? price : Number(item.montantAttendu)), 0);
      return `Exemple ${reference?.niveau} : ${form.echeances.length} échéance(s), ${formatMoney(total)} sur l'année.`;
    }
    const monthly = price * (1 - Number(form.tauxReduction || 0) / 100);
    return `Exemple ${reference?.niveau} : ${settings.mois.length} mois à ${formatMoney(monthly)} (au lieu de ${formatMoney(price)}), soit ${formatMoney(monthly * settings.mois.length)} sur l'année.`;
  }, [fixed, form.echeances, form.tauxReduction, price, reference, settings.mois.length]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const body = { ...form, echeances: fixed ? form.echeances : [] };
      await send(bourse ? `/frais-scolarite/bourses/${bourse.id}` : "/frais-scolarite/bourses", bourse ? "PUT" : "POST", body);
      onSaved();
      onClose();
    });
  };
  return (
    <Modal wide title={bourse ? `Modifier · ${bourse.nom}` : "Nouvelle bourse"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>Nom de la bourse<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} placeholder="Ex. Bourse excellence" /></label>
        <div className="tuition-choices" role="radiogroup" aria-label="Ce que paie le boursier">
          <button type="button" role="radio" aria-checked={!fixed} className={!fixed ? "active" : ""} onClick={() => setForm({ ...form, modeScolarite: "REDUCTION" })}><strong>Réduction en %</strong><small>Il paie tous les mois, à prix réduit.</small></button>
          <button type="button" role="radio" aria-checked={fixed} className={fixed ? "active" : ""} onClick={() => setForm({ ...form, modeScolarite: "MOIS_FIXES" })}><strong>Nombre de mois</strong><small>Il ne paie que certaines échéances, à des dates fixées.</small></button>
        </div>
        {!fixed && (
          <div className="form-grid">
            <label>Réduction sur les mois (%)<input required type="number" min="0" max="100" step="0.01" value={form.tauxReduction} onChange={(event) => setForm({ ...form, tauxReduction: event.target.value })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={form.reductionSurInscription} onChange={(event) => setForm({ ...form, reductionSurInscription: event.target.checked })} /> Réduire aussi les frais d&apos;inscription</label>
          </div>
        )}
        {fixed && (
          <>
            <div className="tuition-generator">
              <label>Nombre d&apos;échéances<input type="number" min="1" max="24" value={count} onChange={(event) => setCount(event.target.value)} /></label>
              <button type="button" className="outline-button small" onClick={fromCalendar}>Préparer depuis le calendrier</button>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>Échéance</th><th>Date limite</th><th>Montant</th><th /></tr></thead>
              <tbody>
                {form.echeances.map((item, index) => (
                  <tr key={index}>
                    <td><input required aria-label="Nom de l'échéance" value={item.libelle} onChange={(event) => setInstalment(index, { libelle: event.target.value })} /></td>
                    <td><input required type="date" aria-label="Date limite" value={item.dateEcheance} onChange={(event) => setInstalment(index, { dateEcheance: event.target.value })} /></td>
                    <td><input type="number" min="0" aria-label="Montant" placeholder="Prix du mois" value={item.montantAttendu} onChange={(event) => setInstalment(index, { montantAttendu: event.target.value })} /></td>
                    <td><button type="button" className="row-action danger-row-action" onClick={() => setForm({ ...form, echeances: form.echeances.filter((_, position) => position !== index) })}>Retirer</button></td>
                  </tr>
                ))}
                {!form.echeances.length && <Empty columns={4}>Aucune échéance.</Empty>}
              </tbody>
            </table></div>
            <p className="panel-subtitle">Sans montant, l&apos;échéance vaut le prix d&apos;un mois de l&apos;étudiant (selon son niveau et sa filière).</p>
            <button type="button" className="secondary-button" onClick={() => setForm({ ...form, echeances: [...form.echeances, { libelle: "", dateEcheance: "", montantAttendu: "" }] })}>+ Ajouter une échéance</button>
          </>
        )}
        <div className="form-grid">
          <label>Moyenne à conserver (sur 20)<input type="number" min="0" max="20" step="0.01" value={form.moyenneMinimale} onChange={(event) => setForm({ ...form, moyenneMinimale: event.target.value })} placeholder="Aucune condition" /></label>
          <label>Vérifiée<select value={form.verificationMoyenne} onChange={(event) => setForm({ ...form, verificationMoyenne: event.target.value })}><option value="SEMESTRE">À chaque semestre</option><option value="ANNEE">En fin d&apos;année</option></select></label>
        </div>
        <p className="tuition-preview">{preview}</p>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

const scholarshipSummary = (bourse: TuitionScholarship) => {
  const paid = bourse.modeScolarite === "MOIS_FIXES" ? `Ne paie que ${bourse.echeances.length} échéance(s)` : `${Number(bourse.tauxReduction ?? 0)} % de réduction sur les mois${bourse.reductionSurInscription ? " et l'inscription" : ""}`;
  const kept = bourse.moyenneMinimale === null ? "aucune moyenne exigée" : `conservée avec ${Number(bourse.moyenneMinimale)}/20 ${bourse.verificationMoyenne === "ANNEE" ? "en fin d'année" : "à chaque semestre"}`;
  return `${paid} · ${kept}`;
};

function ScholarshipPanel({ settings, canEdit, onSaved }: { settings: TuitionSettings; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState<TuitionScholarship | "new" | null>(null);
  const remove = async (bourse: TuitionScholarship) => {
    const motif = await askReason({ title: `Mettre « ${bourse.nom} » à la corbeille ?`, message: "Possible seulement si aucune demande n'utilise cette bourse.", confirmLabel: "Mettre à la corbeille", danger: true, reason: { label: "Motif", minLength: 3, placeholder: "Bourse créée par erreur..." } });
    if (!motif) return;
    try {
      await send(`/types-bourse/${bourse.id}`, "DELETE", { motif });
      onSaved();
    } catch (failure) {
      toast(messageOf(failure, "Suppression impossible."), "error");
    }
  };
  return (
    <Panel eyebrow="Bourses" title={`${settings.bourses.length} bourse(s)`} subtitle="Pour chaque bourse : ce que paie l'étudiant et la moyenne à conserver." actions={canEdit ? <button className="primary-button compact" onClick={() => setEditing("new")}>+ Nouvelle bourse</button> : undefined}>
      <div className="table-wrap"><table>
        <thead><tr><th>Bourse</th><th>Règle</th><th>Dossiers</th>{canEdit && <th />}</tr></thead>
        <tbody>
          {settings.bourses.map((bourse) => (
            <tr key={bourse.id}>
              <td className="strong-cell">{bourse.nom}</td>
              <td>{scholarshipSummary(bourse)}</td>
              <td>{bourse._count?.demandesBourse ?? 0}</td>
              {canEdit && <td className="action-group"><button className="row-action" onClick={() => setEditing(bourse)}>Modifier</button><button className="row-action danger-row-action" onClick={() => void remove(bourse)}>Retirer</button></td>}
            </tr>
          ))}
          {!settings.bourses.length && <Empty columns={canEdit ? 4 : 3}>Aucune bourse.</Empty>}
        </tbody>
      </table></div>
      {editing && <ScholarshipForm settings={settings} bourse={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </Panel>
  );
}

function AnnexForm({ settings, annexe, onClose, onSaved }: { settings: TuitionSettings; annexe: TuitionAnnex | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nom: annexe?.nom ?? "", montant: annexe ? String(Number(annexe.montant)) : "", cible: annexe?.cible ?? "GROUPE", niveau: annexe?.niveau ?? "", filiereId: annexe?.filiereId ?? "", dateLimite: dayOf(annexe?.dateLimite) });
  const action = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const saved = await send<{ etudiants?: number }>(annexe ? `/frais-scolarite/annexes/${annexe.id}` : "/frais-scolarite/annexes", annexe ? "PUT" : "POST", { ...form, anneeScolaire: settings.annee }, true);
      toast(form.cible === "GROUPE" ? `Frais enregistré : ${saved.etudiants ?? 0} étudiant(s) concerné(s).` : "Frais enregistré : ajoutez-le aux étudiants concernés depuis leur dossier ou la caisse.");
      onSaved();
      onClose();
    });
  };
  const group = form.cible === "GROUPE";
  return (
    <Modal title={annexe ? `Modifier · ${annexe.nom}` : "Nouveau frais annexe"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Nom<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} placeholder="Ex. Polo" /></label>
          <label>Montant<input required type="number" min="0" value={form.montant} onChange={(event) => setForm({ ...form, montant: event.target.value })} /></label>
        </div>
        <div className="tuition-choices" role="radiogroup" aria-label="Qui doit ce frais">
          <button type="button" role="radio" aria-checked={group} className={group ? "active" : ""} onClick={() => setForm({ ...form, cible: "GROUPE" })}><strong>Tout un groupe</strong><small>Ajouté d&apos;office aux étudiants choisis.</small></button>
          <button type="button" role="radio" aria-checked={!group} className={!group ? "active" : ""} onClick={() => setForm({ ...form, cible: "A_LA_DEMANDE" })}><strong>À la demande</strong><small>Ajouté étudiant par étudiant, s&apos;il en prend.</small></button>
        </div>
        {group && (
          <div className="form-grid">
            <label>Niveau<select value={form.niveau} onChange={(event) => setForm({ ...form, niveau: event.target.value })}><option value="">Tous les niveaux</option>{settings.niveaux.map((niveau) => <option key={niveau.code} value={niveau.code}>{niveau.code}</option>)}</select></label>
            <label>Filière<select value={form.filiereId} onChange={(event) => setForm({ ...form, filiereId: event.target.value })}><option value="">Toutes les filières</option>{settings.filieres.map((filiere) => <option key={filiere.id} value={filiere.id}>{filiere.nom}</option>)}</select></label>
          </div>
        )}
        <label>Date limite (facultatif)<input type="date" value={form.dateLimite} onChange={(event) => setForm({ ...form, dateLimite: event.target.value })} /></label>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function AnnexPanel({ settings, canEdit, onSaved }: { settings: TuitionSettings; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState<TuitionAnnex | "new" | null>(null);
  const toggle = async (annexe: TuitionAnnex) => {
    if (annexe.actif && !(await askConfirm({ title: `Retirer « ${annexe.nom} » ?`, message: "Plus personne ne le devra, sauf ceux qui ont déjà commencé à le payer.", confirmLabel: "Retirer", danger: true }))) return;
    try {
      await send(`/frais-scolarite/annexes/${annexe.id}/actif`, "PATCH", { actif: !annexe.actif });
      onSaved();
    } catch (failure) {
      toast(messageOf(failure, "Modification impossible."), "error");
    }
  };
  const audience = (annexe: TuitionAnnex) => (annexe.cible === "A_LA_DEMANDE" ? "À la demande" : [annexe.niveau ?? "Tous les niveaux", annexe.filiere?.nom ?? "toutes les filières"].join(" · "));
  return (
    <Panel eyebrow={`Année ${settings.annee}`} title="Frais annexes" subtitle="Polos, badges, sorties... : tout ce qui se paie en plus de la scolarité." actions={canEdit ? <button className="primary-button compact" onClick={() => setEditing("new")}>+ Nouveau frais</button> : undefined}>
      <div className="table-wrap"><table>
        <thead><tr><th>Frais</th><th>Montant</th><th>Concerne</th><th>Date limite</th><th>État</th>{canEdit && <th />}</tr></thead>
        <tbody>
          {settings.annexes.map((annexe) => (
            <tr key={annexe.id}>
              <td className="strong-cell">{annexe.nom}</td>
              <td>{formatMoney(annexe.montant)}</td>
              <td>{audience(annexe)}</td>
              <td>{annexe.dateLimite ? formatDate(annexe.dateLimite) : "—"}</td>
              <td>{annexe.actif ? <Badge tone="ok">Actif</Badge> : <Badge tone="off">Retiré</Badge>}</td>
              {canEdit && <td className="action-group"><button className="row-action" onClick={() => setEditing(annexe)}>Modifier</button><button className={`row-action ${annexe.actif ? "danger-row-action" : ""}`} onClick={() => void toggle(annexe)}>{annexe.actif ? "Retirer" : "Réactiver"}</button></td>}
            </tr>
          ))}
          {!settings.annexes.length && <Empty columns={canEdit ? 6 : 5}>Aucun frais annexe pour cette année.</Empty>}
        </tbody>
      </table></div>
      {editing && <AnnexForm settings={settings} annexe={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </Panel>
  );
}

function ConfirmPanel({ canEdit, signal, onChanged }: { canEdit: boolean; signal: number; onChanged: () => void }) {
  const pending = useLoad<Pending[]>("/frais-scolarite/bourses/a-confirmer", signal);
  const decide = async (item: Pending, decision: "RETIREE" | "MAINTENUE") => {
    const withdraw = decision === "RETIREE";
    const confirmed = await askConfirm({
      title: withdraw ? `Retirer la bourse de ${item.personne.prenom} ${item.personne.nom} ?` : `Maintenir la bourse de ${item.personne.prenom} ${item.personne.nom} ?`,
      message: withdraw ? "Les mois à venir passent au tarif normal. Ce qui est déjà payé et les mois déjà échus ne changent pas." : "La bourse continue malgré la moyenne. La décision reste tracée.",
      confirmLabel: withdraw ? "Retirer la bourse" : "Maintenir la bourse",
      danger: withdraw,
    });
    if (!confirmed) return;
    try {
      await send("/frais-scolarite/bourses/decision", "POST", { inscriptionId: item.inscriptionId, deliberationId: item.deliberationId, decision });
      onChanged();
    } catch (failure) {
      toast(messageOf(failure, "Décision impossible."), "error");
    }
  };
  return (
    <Panel eyebrow="Après les délibérations" title="Bourses à confirmer" subtitle="Les boursiers passés sous la moyenne à conserver. Rien ne change tant que vous n'avez pas décidé.">
      {pending.error && <p className="form-error">{pending.error}</p>}
      <div className="table-wrap"><table>
        <thead><tr><th>Étudiant</th><th>Bourse</th><th>Période</th><th>Moyenne</th><th>À conserver</th>{canEdit && <th />}</tr></thead>
        <tbody>
          {(pending.data ?? []).map((item) => (
            <tr key={`${item.inscriptionId}-${item.deliberationId}`}>
              <td className="strong-cell">{item.personne.prenom} {item.personne.nom}<small className="cell-detail">{item.classe}</small></td>
              <td>{item.bourse}</td>
              <td>{item.periode}</td>
              <td><Badge tone="bad">{item.moyenne}</Badge></td>
              <td>{item.moyenneMinimale}</td>
              {canEdit && <td className="action-group"><button className="row-action" onClick={() => void decide(item, "MAINTENUE")}>Maintenir</button><button className="row-action danger-row-action" onClick={() => void decide(item, "RETIREE")}>Retirer la bourse</button></td>}
            </tr>
          ))}
          {pending.data && !pending.data.length && <Empty columns={canEdit ? 6 : 5}>Aucune bourse à confirmer.</Empty>}
        </tbody>
      </table></div>
    </Panel>
  );
}

export function TuitionPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const [annee, setAnnee] = useState("");
  const [localSignal, setLocalSignal] = useState(0);
  const signal = refreshSignal + localSignal;
  const settings = useLoad<TuitionSettings>(`/frais-scolarite/parametres${annee ? `?annee=${encodeURIComponent(annee)}` : ""}`, signal);
  const [section, setSection] = useHubSection<Section>(SECTIONS);
  const canEdit = hasAccess(user, "tuition-settings", "edit");
  const saved = () => setLocalSignal((value) => value + 1);
  const data = settings.data;
  const applyToAll = async () => {
    if (!data) return;
    if (!(await askConfirm({ title: "Appliquer aux étudiants déjà inscrits ?", message: `Les mois non payés de ${data.annee} sont recalculés avec le paramétrage actuel. Ce qui est déjà payé ne change pas, et les échéanciers retouchés à la main sont conservés.`, confirmLabel: "Appliquer" }))) return;
    try {
      const result = await send<{ misAJour: number; personnalises: number }>("/frais-scolarite/appliquer", "POST", { anneeScolaire: data.annee }, true);
      toast(`${result.misAJour} échéancier(s) mis à jour${result.personnalises ? `, ${result.personnalises} personnalisé(s) conservé(s)` : ""}.`);
    } catch (failure) {
      toast(messageOf(failure, "Application impossible."), "error");
    }
  };
  const cards: HubCard<Section>[] = data ? [
    { key: "calendrier", icon: CalendarDays, title: "Mois à payer", value: `${data.mois.length}`, detail: data.mois.length ? `mois en ${data.annee}` : "À renseigner", tone: data.mois.length ? undefined : "warn", info: "Les mois de l'année scolaire et leur date limite." },
    { key: "tarifs", icon: Coins, title: "Tarifs", value: `${data.tarifs.length}`, detail: "prix par niveau et par filière", tone: data.tarifs.length ? undefined : "warn", info: "Le prix d'un mois pour chaque niveau, et pour les filières qui ont un prix différent." },
    { key: "bourses", icon: GraduationCap, title: "Bourses", value: `${data.bourses.length}`, detail: "réduction ou nombre de mois", info: "Ce que paie chaque boursier et la moyenne à conserver pour garder sa bourse." },
    { key: "annexes", icon: Shirt, title: "Frais annexes", value: `${data.annexes.filter((item) => item.actif).length}`, detail: "polos, badges, sorties...", info: "Les frais en plus de la scolarité, dus par un groupe ou à la demande." },
    { key: "confirmer", icon: UserCheck, title: "Bourses à confirmer", value: `${data.aConfirmer}`, detail: data.aConfirmer ? "moyenne insuffisante" : "Rien à décider", tone: data.aConfirmer ? "alert" : undefined, info: "Les boursiers passés sous la moyenne à conserver, à confirmer ou maintenir." },
  ] : [];
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Finances" title="Frais de scolarité" text="Ce que doit chaque étudiant : ses mois, sa bourse et ses frais annexes.">
        {data && data.annees.length > 0 && <select aria-label="Année scolaire" value={data.annee} onChange={(event) => setAnnee(event.target.value)}>{data.annees.map((item) => <option key={item.libelle} value={item.libelle}>{item.libelle}</option>)}</select>}
        {canEdit && data && <button className="outline-button small" onClick={() => void applyToAll()}>Appliquer aux étudiants déjà inscrits</button>}
      </PageIntro>
      {settings.error && <p className="form-error">{settings.error}</p>}
      {!settings.data && !settings.error && <p className="empty-state">Chargement...</p>}
      {data && !data.annees.length && <p className="empty-state">Créez d&apos;abord une année scolaire dans Structure académique.</p>}
      {data && data.annees.length > 0 && !section && <HubCards cards={cards} onOpen={setSection} />}
      {data && section && <HubBack label="Frais de scolarité" onBack={() => setSection(null)} />}
      {data && section === "calendrier" && <CalendarPanel key={`${data.annee}-${signal}`} settings={data} canEdit={canEdit} onSaved={saved} />}
      {data && section === "tarifs" && <TariffPanel key={signal} settings={data} canEdit={canEdit} onSaved={saved} />}
      {data && section === "bourses" && <ScholarshipPanel settings={data} canEdit={canEdit} onSaved={saved} />}
      {data && section === "annexes" && <AnnexPanel settings={data} canEdit={canEdit} onSaved={saved} />}
      {data && section === "confirmer" && <ConfirmPanel canEdit={canEdit} signal={signal} onChanged={saved} />}
    </div>
  );
}
