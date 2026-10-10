"use client";

import { FormEvent, useState } from "react";
import { askConfirm, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { User, formatDate } from "@/lib/types";
import { Badge, Empty, FormActions, Modal, PageIntro, Panel, Tabs, send, useAction, useForm, useLoad } from "@/components/ui-kit";

export const NIVEAUX = ["L1", "L2"];
export type AcademicYear = { id: string; libelle: string; dateDebut: string; dateFin: string; statut: string; _count?: { classes: number } };
export type Program = { id: string; code: string; nom: string; actif: boolean };
export type Room = { id: string; nom: string; capacite?: number | null; actif: boolean };
type Subject = { id: string; code: string; nom: string; coefficient: string; volumeHoraire: number; actif: boolean };
type Unit = { id: string; semestre: number; code: string; nom: string; credits: number; matieres: Subject[] };
type Curriculum = { unites: Unit[]; credits: Array<{ semestre: number; total: number }> };
type Rules = { poidsControleContinu: string; moyenneValidation: string; noteEliminatoire: string | null; compensationSemestre: boolean; compensationAnnuelle: boolean; creditsPassage: number; seuilAbsences: string; blocageImpayes: boolean };

const YEAR_STATUS: Record<string, { label: string; tone: "ok" | "wait" | "off" }> = {
  PREPARATION: { label: "En préparation", tone: "wait" },
  EN_COURS: { label: "En cours", tone: "ok" },
  CLOTUREE: { label: "Clôturée", tone: "off" },
};

function YearsTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const years = useLoad<AcademicYear[]>("/academique/annees", signal);
  const form = useForm({ libelle: "", dateDebut: "", dateFin: "" });
  const action = useAction();
  const create = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/academique/annees", "POST", form.values);
      form.setValues({ libelle: "", dateDebut: "", dateFin: "" });
      years.reload();
    });
  };
  const setStatus = async (year: AcademicYear, statut: string) => {
    if (statut === "CLOTUREE" && !(await askConfirm({ title: `Clôturer l'année ${year.libelle} ?`, message: "Plus aucune séance, note ni délibération ne pourra y être modifiée.", confirmLabel: "Clôturer", danger: true }))) return;
    void action.run(async () => {
      await send(`/academique/annees/${year.id}`, "PATCH", { statut });
      years.reload();
    });
  };
  const importExisting = () =>
    void action.run(async () => {
      const result = await send<{ anneesCreees: number; filieresCreees: number }>("/academique/importer", "POST", undefined, true);
      toast(`${result.anneesCreees} année(s) et ${result.filieresCreees} filière(s) reprises des inscriptions.`);
      years.reload();
    });
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={create}>
          <input required placeholder="Libellé (ex. 2026-2027)" aria-label="Libellé de l'année" pattern="\d{4}-\d{4}" {...form.bind("libelle")} />
          <label>Rentrée<input required type="date" {...form.bind("dateDebut")} /></label>
          <label>Fin<input required type="date" min={form.values.dateDebut} {...form.bind("dateFin")} /></label>
          <button className="outline-button small" disabled={action.busy}>Ouvrir l&apos;année</button>
          <button type="button" className="row-action" disabled={action.busy} onClick={importExisting}>Reprendre les années et filières des inscriptions existantes</button>
        </form>
      )}
      {(action.error || years.error) && <p className="form-error">{action.error || years.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Année</th><th>Période</th><th>Classes</th><th>État</th><th /></tr></thead>
          <tbody>
            {(years.data ?? []).map((year) => (
              <tr key={year.id}>
                <td className="strong-cell">{year.libelle}</td>
                <td>{formatDate(year.dateDebut)} → {formatDate(year.dateFin)}</td>
                <td>{year._count?.classes ?? 0}</td>
                <td><Badge tone={YEAR_STATUS[year.statut]?.tone ?? "off"}>{YEAR_STATUS[year.statut]?.label ?? year.statut}</Badge></td>
                <td className="action-group">
                  {canEdit && year.statut !== "CLOTUREE" && <button className="row-action" onClick={() => void setStatus(year, "CLOTUREE")}>Clôturer</button>}
                  {canEdit && year.statut === "CLOTUREE" && <button className="row-action" onClick={() => void setStatus(year, "EN_COURS")}>Rouvrir</button>}
                </td>
              </tr>
            ))}
            {!years.data?.length && <Empty columns={5}>{years.data ? "Aucune année académique : ouvrez-en une pour créer des classes." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProgramsTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const programs = useLoad<Program[]>("/academique/filieres", signal);
  const form = useForm({ code: "", nom: "" });
  const action = useAction();
  const call = (work: () => Promise<unknown>) => void action.run(async () => { await work(); programs.reload(); });
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send("/academique/filieres", "POST", form.values); form.setValues({ code: "", nom: "" }); }); }}>
          <input required minLength={2} maxLength={12} placeholder="Code (ex. INFO)" aria-label="Code" {...form.bind("code")} />
          <input required minLength={2} placeholder="Nom de la filière" aria-label="Nom de la filière" {...form.bind("nom")} />
          <button className="outline-button small" disabled={action.busy}>Ajouter</button>
        </form>
      )}
      {(action.error || programs.error) && <p className="form-error">{action.error || programs.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Filière</th><th>État</th><th /></tr></thead>
          <tbody>
            {(programs.data ?? []).map((program) => (
              <tr key={program.id}>
                <td className="strong-cell">{program.code}</td>
                <td>{program.nom}</td>
                <td><Badge tone={program.actif ? "ok" : "off"}>{program.actif ? "Active" : "Désactivée"}</Badge></td>
                <td>{canEdit && <button className="row-action" onClick={() => call(() => send(`/academique/filieres/${program.id}`, "PATCH", { actif: !program.actif }))}>{program.actif ? "Désactiver" : "Réactiver"}</button>}</td>
              </tr>
            ))}
            {!programs.data?.length && <Empty columns={4}>{programs.data ? "Aucune filière." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RoomsTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const rooms = useLoad<Room[]>("/academique/salles", signal);
  const form = useForm({ nom: "", capacite: "" });
  const action = useAction();
  const call = (work: () => Promise<unknown>) => void action.run(async () => { await work(); rooms.reload(); });
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send("/academique/salles", "POST", form.values); form.setValues({ nom: "", capacite: "" }); }); }}>
          <input required placeholder="Nom de la salle" aria-label="Nom de la salle" {...form.bind("nom")} />
          <input type="number" min="1" placeholder="Capacité" aria-label="Capacité" {...form.bind("capacite")} />
          <button className="outline-button small" disabled={action.busy}>Ajouter</button>
        </form>
      )}
      {(action.error || rooms.error) && <p className="form-error">{action.error || rooms.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Salle</th><th>Capacité</th><th>État</th><th /></tr></thead>
          <tbody>
            {(rooms.data ?? []).map((room) => (
              <tr key={room.id}>
                <td className="strong-cell">{room.nom}</td>
                <td>{room.capacite ?? "—"}</td>
                <td><Badge tone={room.actif ? "ok" : "off"}>{room.actif ? "Disponible" : "Hors service"}</Badge></td>
                <td>{canEdit && <button className="row-action" onClick={() => call(() => send(`/academique/salles/${room.id}`, "PATCH", { actif: !room.actif }))}>{room.actif ? "Mettre hors service" : "Remettre en service"}</button>}</td>
              </tr>
            ))}
            {!rooms.data?.length && <Empty columns={4}>{rooms.data ? "Aucune salle." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
    </>
  );
}

type CurriculumEdit = { kind: "unit"; unit?: Unit; semestre: number } | { kind: "subject"; unit: Unit; subject?: Subject };

function CurriculumTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const programs = useLoad<Program[]>("/academique/filieres", signal);
  const [programId, setProgramId] = useState("");
  const [level, setLevel] = useState("L1");
  const selected = programId || programs.data?.find((program) => program.actif)?.id || "";
  const curriculum = useLoad<Curriculum>(selected ? `/academique/maquette?filiereId=${selected}&niveau=${level}` : null, signal);
  const [editing, setEditing] = useState<CurriculumEdit | null>(null);
  const form = useForm({ code: "", nom: "", credits: "", coefficient: "1", volumeHoraire: "0" });
  const action = useAction();
  const open = (target: CurriculumEdit) => {
    action.setError("");
    setEditing(target);
    form.setValues(
      target.kind === "unit"
        ? { code: target.unit?.code ?? "", nom: target.unit?.nom ?? "", credits: String(target.unit?.credits ?? ""), coefficient: "1", volumeHoraire: "0" }
        : { code: target.subject?.code ?? "", nom: target.subject?.nom ?? "", credits: "", coefficient: String(Number(target.subject?.coefficient ?? 1)), volumeHoraire: String(target.subject?.volumeHoraire ?? 0) },
    );
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const { code, nom, credits, coefficient, volumeHoraire } = form.values;
    void action.run(async () => {
      if (editing.kind === "unit") {
        if (editing.unit) await send(`/academique/unites/${editing.unit.id}`, "PATCH", { code, nom, credits });
        else await send("/academique/unites", "POST", { filiereId: selected, niveau: level, semestre: editing.semestre, code, nom, credits });
      } else if (editing.subject) await send(`/academique/matieres/${editing.subject.id}`, "PATCH", { code, nom, coefficient, volumeHoraire });
      else await send("/academique/matieres", "POST", { ueId: editing.unit.id, code, nom, coefficient, volumeHoraire });
      setEditing(null);
      curriculum.reload();
    });
  };
  const remove = async (path: string, label: string) => {
    if (!(await askConfirm({ title: `Retirer ${label} ?`, confirmLabel: "Retirer", danger: true }))) return;
    void action.run(async () => { await send(path, "DELETE"); curriculum.reload(); });
  };
  return (
    <>
      <div className="finance-inline-form">
        <label>Filière
          <select className="expense-select" value={selected} onChange={(event) => setProgramId(event.target.value)}>
            {(programs.data ?? []).map((program) => <option key={program.id} value={program.id}>{program.nom}</option>)}
          </select>
        </label>
        <label>Niveau
          <select className="expense-select" value={level} onChange={(event) => setLevel(event.target.value)}>
            {NIVEAUX.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {action.error && !editing && <p className="form-error">{action.error}</p>}
      {!selected && <p className="empty-state">Créez d&apos;abord une filière.</p>}
      {selected && [1, 2].map((semestre) => {
        const units = (curriculum.data?.unites ?? []).filter((unit) => unit.semestre === semestre);
        const total = curriculum.data?.credits.find((item) => item.semestre === semestre)?.total ?? 0;
        return (
          <div className="curriculum-semester" key={semestre}>
            <div className="curriculum-head">
              <h4>Semestre {semestre}</h4>
              <Badge tone={total === 30 ? "ok" : "wait"}>{total} crédit(s){total !== 30 ? " · 30 attendus" : ""}</Badge>
              {canEdit && <button className="row-action" onClick={() => open({ kind: "unit", semestre })}>+ Unité d&apos;enseignement</button>}
            </div>
            {units.map((unit) => (
              <div className="curriculum-unit" key={unit.id}>
                <div className="curriculum-unit-head">
                  <strong>{unit.code} · {unit.nom}</strong>
                  <span>{unit.credits} crédit(s)</span>
                  {canEdit && <span className="action-group">
                    <button className="row-action" onClick={() => open({ kind: "subject", unit })}>+ Matière</button>
                    <button className="row-action" onClick={() => open({ kind: "unit", unit, semestre })}>Modifier</button>
                    <button className="row-action danger-row-action" onClick={() => void remove(`/academique/unites/${unit.id}`, `l'unité ${unit.code}`)}>Retirer</button>
                  </span>}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Code</th><th>Matière</th><th>Coefficient</th><th>Volume horaire</th><th /></tr></thead>
                    <tbody>
                      {unit.matieres.map((subject) => (
                        <tr key={subject.id}>
                          <td className="strong-cell">{subject.code}</td>
                          <td>{subject.nom}{!subject.actif && <small className="cell-detail">Désactivée</small>}</td>
                          <td>{Number(subject.coefficient)}</td>
                          <td>{subject.volumeHoraire} h</td>
                          <td className="action-group">
                            {canEdit && <button className="row-action" onClick={() => open({ kind: "subject", unit, subject })}>Modifier</button>}
                            {canEdit && <button className="row-action" onClick={() => void action.run(async () => { await send(`/academique/matieres/${subject.id}`, "PATCH", { actif: !subject.actif }); curriculum.reload(); })}>{subject.actif ? "Désactiver" : "Réactiver"}</button>}
                            {canEdit && <button className="row-action danger-row-action" onClick={() => void remove(`/academique/matieres/${subject.id}`, `la matière ${subject.code}`)}>Retirer</button>}
                          </td>
                        </tr>
                      ))}
                      {!unit.matieres.length && <Empty columns={5}>Aucune matière dans cette unité.</Empty>}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {!units.length && <p className="panel-subtitle">Aucune unité d&apos;enseignement pour ce semestre.</p>}
          </div>
        );
      })}
      {editing && (
        <Modal title={editing.kind === "unit" ? (editing.unit ? "Modifier l'unité" : `Nouvelle unité · semestre ${editing.semestre}`) : editing.subject ? "Modifier la matière" : `Nouvelle matière · ${editing.unit.code}`} onClose={() => setEditing(null)}>
          <form className="entity-form" onSubmit={save}>
            <div className="form-grid">
              <label>Code<input required maxLength={20} {...form.bind("code")} /></label>
              {editing.kind === "unit" ? <label>Crédits<input required type="number" min="1" max="60" {...form.bind("credits")} /></label> : <label>Coefficient<input required type="number" min="0.25" max="20" step="0.25" {...form.bind("coefficient")} /></label>}
            </div>
            <label>{editing.kind === "unit" ? "Nom de l'unité" : "Nom de la matière"}<input required minLength={2} {...form.bind("nom")} /></label>
            {editing.kind === "subject" && <label>Volume horaire prévu (heures)<input type="number" min="0" max="1000" {...form.bind("volumeHoraire")} /></label>}
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} onCancel={() => setEditing(null)} />
          </form>
        </Modal>
      )}
    </>
  );
}

function RulesTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const rules = useLoad<Rules>("/academique/parametres", signal);
  const [draft, setDraft] = useState<Rules | null>(null);
  const action = useAction();
  const current = draft ?? rules.data;
  if (!current) return <p className="empty-state">{rules.error || "Chargement..."}</p>;
  const set = (patch: Partial<Rules>) => setDraft({ ...current, ...patch });
  const save = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/academique/parametres", "PATCH", { ...current, noteEliminatoire: current.noteEliminatoire === "" ? null : current.noteEliminatoire });
      setDraft(null);
      rules.reload();
    });
  };
  const cc = Number(current.poidsControleContinu);
  return (
    <div className="finance-rules">
      <form className="entity-form" onSubmit={save}>
        <p className="form-section-label">Calcul des moyennes</p>
        <label>
          Part du contrôle continu (%)
          <input required type="number" min="0" max="100" disabled={!canEdit} value={Number(current.poidsControleContinu)} onChange={(event) => set({ poidsControleContinu: event.target.value })} />
          <small className="cell-detail">Moyenne d&apos;une matière = contrôle continu × {cc} % + examen × {100 - cc} %.</small>
        </label>
        <div className="form-grid">
          <label>Moyenne de validation (/20)<input required type="number" min="1" max="20" step="0.5" disabled={!canEdit} value={Number(current.moyenneValidation)} onChange={(event) => set({ moyenneValidation: event.target.value })} /></label>
          <label>Note éliminatoire (vide : aucune)<input type="number" min="0" max="20" step="0.5" disabled={!canEdit} value={current.noteEliminatoire === null ? "" : current.noteEliminatoire === "" ? "" : Number(current.noteEliminatoire)} onChange={(event) => set({ noteEliminatoire: event.target.value })} /></label>
        </div>
        <label className="check-row"><input type="checkbox" disabled={!canEdit} checked={current.compensationSemestre} onChange={(event) => set({ compensationSemestre: event.target.checked })} /><span>Compensation entre les unités d&apos;un semestre<small>Une moyenne générale suffisante valide tout le semestre, sauf note éliminatoire.</small></span></label>
        <label className="check-row"><input type="checkbox" disabled={!canEdit} checked={current.compensationAnnuelle} onChange={(event) => set({ compensationAnnuelle: event.target.checked })} /><span>Compensation entre les deux semestres<small>Une moyenne annuelle suffisante valide toute l&apos;année.</small></span></label>
        <p className="form-section-label">Passage et contrôles</p>
        <div className="form-grid">
          <label>Crédits pour passer avec des dettes<input required type="number" min="0" max="60" disabled={!canEdit} value={current.creditsPassage} onChange={(event) => set({ creditsPassage: Number(event.target.value) })} /></label>
          <label>Seuil d&apos;alerte d&apos;absences (%)<input required type="number" min="0" max="100" disabled={!canEdit} value={Number(current.seuilAbsences)} onChange={(event) => set({ seuilAbsences: event.target.value })} /></label>
        </div>
        <label className="check-row"><input type="checkbox" disabled={!canEdit} checked={current.blocageImpayes} onChange={(event) => set({ blocageImpayes: event.target.checked })} /><span>Retenir les bulletins des étudiants qui n&apos;ont pas soldé leur scolarité<small>Le bulletin redevient disponible dès que le reste à payer est nul.</small></span></label>
        {action.error && <p className="form-error">{action.error}</p>}
        {canEdit && <div className="form-actions"><button className="primary-button compact" disabled={!draft || action.busy}>Enregistrer les règles</button></div>}
      </form>
      <div>
        <p className="form-section-label">Règles toujours appliquées</p>
        <ul className="finance-fixed-rules">
          <li>Une absence à une évaluation vaut zéro ; toutes les notes sont ramenées sur 20.</li>
          <li>Le rattrapage remplace la note d&apos;examen seulement s&apos;il est meilleur.</li>
          <li>L&apos;enseignant saisit les notes de ses matières ; seule la scolarité les valide.</li>
          <li>Des notes validées sont verrouillées ; leur réouverture est motivée et tracée.</li>
          <li>Pas de délibération tant qu&apos;une note manque ou qu&apos;une évaluation n&apos;est pas validée.</li>
          <li>Les résultats délibérés sont figés : une modification de maquette ne les change pas.</li>
          <li>En dernière année, tous les crédits sont exigés : pas de passage avec dettes.</li>
          <li>Pas de séance sans contenu au cahier de textes ; ses heures servent à la paie des vacataires.</li>
          <li>Une classe, un enseignant et une salle ne peuvent être qu&apos;à un endroit à la fois.</li>
          <li>Un étudiant affecté à une classe ne se supprime plus : son inscription se marque abandonnée.</li>
          <li>Une année clôturée est définitive.</li>
        </ul>
      </div>
    </div>
  );
}

export function AcademicStructurePage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "academics", "edit");
  type Tab = "annees" | "filieres" | "maquettes" | "salles" | "regles";
  const [tab, setTab] = useState<Tab>("annees");
  const tabs: Array<[Tab, string, string]> = [
    ["annees", "Années", "Chaque année porte ses classes, ses notes et ses délibérations."],
    ["filieres", "Filières", "Les parcours proposés par l'établissement."],
    ["maquettes", "Maquettes", "Unités d'enseignement, matières, coefficients et crédits par filière et par niveau."],
    ["salles", "Salles", "Les salles utilisées par l'emploi du temps et les examens."],
    ["regles", "Règles", "Les règles de calcul et de passage, appliquées à tous les résultats."],
  ];
  const active = tabs.find(([key]) => key === tab)!;
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Structure académique" text="Posez une fois le cadre : années, filières, maquettes et règles. Tout le reste s'appuie dessus." />
      <Tabs label="Rubrique" tabs={tabs.map(([key, label]) => [key, label])} value={tab} onChange={setTab} />
      <Panel eyebrow={active[1]} title={active[2]}>
        {tab === "annees" && <YearsTab canEdit={canEdit} signal={refreshSignal} />}
        {tab === "filieres" && <ProgramsTab canEdit={canEdit} signal={refreshSignal} />}
        {tab === "maquettes" && <CurriculumTab canEdit={canEdit} signal={refreshSignal} />}
        {tab === "salles" && <RoomsTab canEdit={canEdit} signal={refreshSignal} />}
        {tab === "regles" && <RulesTab canEdit={canEdit} signal={refreshSignal} />}
      </Panel>
    </div>
  );
}
