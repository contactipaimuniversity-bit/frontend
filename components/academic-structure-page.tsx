"use client";

import { FormEvent, useState } from "react";
import { askConfirm, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { User, formatDate } from "@/lib/types";
import { BookOpen, BookOpenCheck, CalendarDays, DoorOpen, GraduationCap, Layers, LayoutList, Network, Scale } from "lucide-react";
import { Badge, Empty, FieldHelp, FormActions, HubBack, HubCard, HubCards, Modal, PageIntro, Panel, send, useAction, useForm, useLoad } from "@/components/ui-kit";

export type Level = { id: string; code: string; libelle: string; cycle: string; rang: number; diplome?: string | null; actif: boolean };
export type AcademicYear = { id: string; libelle: string; dateDebut: string; dateFin: string; statut: string; _count?: { classes: number } };
export type Program = { id: string; code: string; nom: string; actif: boolean; poleId?: string | null; pole?: { id: string; nom: string } | null; niveauFinal?: string | null };
export type Pole = { id: string; nom: string; description?: string | null; ordre: number; actif: boolean; filieres: Program[] };
export type Room = { id: string; nom: string; capacite?: number | null; actif: boolean };
type Subject = { id: string; code: string; nom: string; coefficient: string; volumeHoraire: number; actif: boolean };
type Unit = { id: string; semestre: number; code: string; nom: string; credits: number; matieres: Subject[] };
type Curriculum = { annee: AcademicYear | null; unites: Unit[]; credits: Array<{ semestre: number; total: number }> };
type CurriculumList = { annee: AcademicYear | null; maquettes: Array<{ filiereId: string; niveau: string; unites: number; credits: number }> };
type PendingProgram = { texte: string; inscriptions: number; suggestion: { id: string; nom: string } | null };

// Niveaux d'études du référentiel (L1, L2, L3, M1…), dans l'ordre des cycles.
export function useLevels(signal = 0) {
  const levels = useLoad<Level[]>("/academique/niveaux", signal);
  return { ...levels, active: (levels.data ?? []).filter((item) => item.actif) };
}

// Dernier niveau de son cycle : il termine le parcours.
const endsCycle = (level: Level, all: Level[]) => !all.some((other) => other.actif && other.cycle === level.cycle && other.rang > level.rang);
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
      const created = await send<{ libelle: string; maquettesReprises: number }>("/academique/annees", "POST", form.values);
      if (created.maquettesReprises) toast(`Année ${created.libelle} ouverte : ${created.maquettesReprises} unité(s) d'enseignement reprises des maquettes existantes.`);
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

// L1, L2, L3, M1… : autant de niveaux que les cursus en demandent.
function LevelsTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const levels = useLoad<Level[]>("/academique/niveaux", signal);
  const empty = { code: "", libelle: "", cycle: "Licence", rang: "", diplome: "" };
  const form = useForm(empty);
  const [editing, setEditing] = useState<Level | null>(null);
  const edit = useForm(empty);
  const action = useAction();
  const call = (work: () => Promise<unknown>) => void action.run(async () => { await work(); levels.reload(); });
  const list = levels.data ?? [];
  const cycles = [...new Set(list.map((item) => item.cycle))];
  const next = (level: Level) => list.filter((other) => other.actif && other.cycle === level.cycle && other.rang > level.rang).sort((a, b) => a.rang - b.rang)[0];
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send("/academique/niveaux", "POST", form.values); form.setValues({ ...empty, cycle: form.values.cycle }); }); }}>
          <input required maxLength={12} placeholder="Code (ex. L3, M1)" aria-label="Code du niveau" style={{ width: 130 }} {...form.bind("code")} />
          <input required minLength={2} maxLength={80} placeholder="Libellé (ex. Troisième année)" aria-label="Libellé du niveau" {...form.bind("libelle")} />
          <input required maxLength={40} list="cycles-etudes" placeholder="Cycle" aria-label="Cycle" style={{ width: 150 }} {...form.bind("cycle")} />
          <label>Rang<input required type="number" min="1" max="12" style={{ width: 70 }} {...form.bind("rang")} /></label>
          <input maxLength={160} placeholder="Diplôme délivré (facultatif)" aria-label="Diplôme délivré" {...form.bind("diplome")} />
          <button className="outline-button small" disabled={action.busy}>Ajouter le niveau</button>
          <datalist id="cycles-etudes">{[...new Set([...cycles, "Licence", "Master", "Ingénieur", "BTS"])].map((cycle) => <option key={cycle} value={cycle} />)}</datalist>
        </form>
      )}
      <p className="panel-subtitle">Le passage va d&apos;un rang au suivant dans le même cycle. Le dernier rang d&apos;un cycle termine le parcours : tous les crédits y sont exigés et le diplôme indiqué est délivré. Une filière plus courte se règle sur sa ligne, dans « Filières ».</p>
      {(action.error || levels.error) && !editing && <p className="form-error">{action.error || levels.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Libellé</th><th>Cycle</th><th>Rang</th><th>Ensuite</th><th>État</th><th /></tr></thead>
          <tbody>
            {list.map((level) => (
              <tr key={level.id}>
                <td className="strong-cell">{level.code}</td>
                <td>{level.libelle}</td>
                <td>{level.cycle}</td>
                <td>{level.rang}</td>
                <td>{next(level) ? `Passage en ${next(level)?.code}` : <Badge tone="run">Fin de cycle{level.diplome ? ` · ${level.diplome}` : ""}</Badge>}</td>
                <td><Badge tone={level.actif ? "ok" : "off"}>{level.actif ? "Ouvert" : "Désactivé"}</Badge></td>
                <td className="action-group">
                  {canEdit && <button className="row-action" onClick={() => { action.setError(""); edit.setValues({ code: level.code, libelle: level.libelle, cycle: level.cycle, rang: String(level.rang), diplome: level.diplome ?? "" }); setEditing(level); }}>Modifier</button>}
                  {canEdit && <button className="row-action" onClick={() => call(() => send(`/academique/niveaux/${level.id}`, "PATCH", { actif: !level.actif }))}>{level.actif ? "Désactiver" : "Réactiver"}</button>}
                </td>
              </tr>
            ))}
            {!list.length && <Empty columns={7}>{levels.data ? "Aucun niveau." : "Chargement..."}</Empty>}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={`Modifier ${editing.code}`} onClose={() => setEditing(null)}>
          <form className="entity-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send(`/academique/niveaux/${editing.id}`, "PATCH", { libelle: edit.values.libelle, cycle: edit.values.cycle, rang: edit.values.rang, diplome: edit.values.diplome }); setEditing(null); }); }}>
            <label>Libellé<input required minLength={2} maxLength={80} {...edit.bind("libelle")} /></label>
            <div className="form-grid">
              <label>Cycle<input required maxLength={40} list="cycles-etudes" {...edit.bind("cycle")} /></label>
              <label>Rang dans le cycle<input required type="number" min="1" max="12" {...edit.bind("rang")} /></label>
            </div>
            <label>
              <span className="field-title">Diplôme délivré<FieldHelp text="L'intitulé imprimé sur le diplôme et l'attestation de réussite quand ce niveau termine un parcours, par exemple « Licence professionnelle » ou « Diplôme de Technicien Supérieur ». Laissez vide pour un niveau intermédiaire." /></span>
              <input maxLength={160} {...edit.bind("diplome")} />
            </label>
            <p className="panel-subtitle">Le code ({editing.code}) ne change plus : les classes, les maquettes et les inscriptions s&apos;y réfèrent.</p>
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} onCancel={() => setEditing(null)} />
          </form>
        </Modal>
      )}
    </>
  );
}

// Les quatre pôles d'IPAIM et leurs filières : un point de départ, modifiable ensuite.
function PolesTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const poles = useLoad<Pole[]>("/academique/poles", signal);
  const form = useForm({ nom: "", description: "" });
  const [editing, setEditing] = useState<Pole | null>(null);
  const edit = useForm({ nom: "", description: "" });
  const action = useAction();
  const call = (work: () => Promise<unknown>) => void action.run(async () => { await work(); poles.reload(); });
  const loadDefault = async () => {
    if (!(await askConfirm({ title: "Charger l'organisation IPAIM ?", message: "Les 4 pôles (Industriel, Management, Technologique, Agricole et Environnement) et leurs 33 filières seront créés. Ce qui existe déjà est conservé, et tout reste modifiable ensuite.", confirmLabel: "Charger" }))) return;
    call(async () => {
      const result = await send<{ poles: number; filieres: number; rattachees: number }>("/academique/poles/structure-type", "POST", {}, true);
      toast(`${result.poles} pôle(s) et ${result.filieres} filière(s) créés${result.rattachees ? `, ${result.rattachees} filière(s) rattachée(s)` : ""}.`);
    });
  };
  const list = poles.data ?? [];
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send("/academique/poles", "POST", form.values); form.setValues({ nom: "", description: "" }); }); }}>
          <input required minLength={2} maxLength={80} placeholder="Nom du pôle (ex. Pôle Santé)" aria-label="Nom du pôle" {...form.bind("nom")} />
          <input maxLength={600} placeholder="Vocation du pôle (facultatif)" aria-label="Vocation du pôle" {...form.bind("description")} />
          <button className="outline-button small" disabled={action.busy}>Ajouter le pôle</button>
          <button type="button" className="outline-button small" disabled={action.busy} onClick={() => void loadDefault()}>Charger l&apos;organisation IPAIM</button>
        </form>
      )}
      {(action.error || poles.error) && <p className="form-error">{action.error || poles.error}</p>}
      <div className="pole-grid">
        {list.map((pole) => (
          <article className={`pole-card ${pole.actif ? "" : "off"}`} key={pole.id}>
            <header>
              <div>
                <strong>{pole.nom}</strong>
                <small>{pole.filieres.length} filière(s){pole.actif ? "" : " · pôle désactivé"}</small>
              </div>
              {canEdit && (
                <div className="pole-card-actions">
                  <button className="row-action" onClick={() => { edit.setValues({ nom: pole.nom, description: pole.description ?? "" }); setEditing(pole); }}>Modifier</button>
                  <button className="row-action" onClick={() => call(() => send(`/academique/poles/${pole.id}`, "PATCH", { actif: !pole.actif }))}>{pole.actif ? "Désactiver" : "Réactiver"}</button>
                </div>
              )}
            </header>
            {pole.description && <p>{pole.description}</p>}
            <div className="pole-programs">
              {pole.filieres.map((program) => <span className={program.actif ? "" : "off"} key={program.id} title={program.actif ? program.code : `${program.code} · désactivée`}>{program.nom}</span>)}
              {!pole.filieres.length && <em>Aucune filière : rattachez-en depuis la carte « Filières ».</em>}
            </div>
          </article>
        ))}
      </div>
      {poles.data && !list.length && <p className="empty-state">Aucun pôle. Ajoutez-en un, ou chargez l&apos;organisation IPAIM pour partir des quatre pôles et de leurs filières.</p>}
      {!poles.data && !poles.error && <p className="empty-state">Chargement...</p>}
      {editing && (
        <Modal title={`Modifier ${editing.nom}`} onClose={() => setEditing(null)}>
          <form className="entity-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send(`/academique/poles/${editing.id}`, "PATCH", edit.values); setEditing(null); }); }}>
            <label>Nom du pôle<input required minLength={2} maxLength={80} {...edit.bind("nom")} /></label>
            <label>Vocation du pôle<textarea maxLength={600} rows={5} value={edit.values.description} onChange={(event) => edit.setValues({ ...edit.values, description: event.target.value })} /></label>
            {action.error && <p className="form-error">{action.error}</p>}
            <FormActions busy={action.busy} onCancel={() => setEditing(null)} />
          </form>
        </Modal>
      )}
    </>
  );
}

function ProgramsTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const programs = useLoad<Program[]>("/academique/filieres", signal);
  const poles = useLoad<Pole[]>("/academique/poles", signal);
  const levels = useLevels(signal);
  // Inscriptions dont la filière n'est encore qu'un texte saisi à la main.
  const pending = useLoad<PendingProgram[]>("/academique/filieres/rapprochement", signal);
  const [links, setLinks] = useState<Record<string, string>>({});
  const form = useForm({ code: "", nom: "", poleId: "" });
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const action = useAction();
  const call = (work: () => Promise<unknown>) => void action.run(async () => { await work(); programs.reload(); });
  const link = (item: PendingProgram) => {
    const filiereId = links[item.texte] ?? item.suggestion?.id ?? "";
    if (!filiereId) return;
    void action.run(async () => {
      const result = await send<{ rapprochees: number; filiere: string }>("/academique/filieres/rapprochement", "POST", { texte: item.texte, filiereId }, true);
      toast(`${result.rapprochees} inscription(s) rattachée(s) à ${result.filiere}.`);
      pending.reload();
    });
  };
  const needle = search.trim().toLocaleLowerCase();
  const shown = (programs.data ?? []).filter((program) =>
    (!filter || (filter === "aucun" ? !program.poleId : program.poleId === filter)) &&
    (!needle || `${program.code} ${program.nom}`.toLocaleLowerCase().includes(needle)),
  );
  const poleOptions = (poles.data ?? []).map((pole) => <option key={pole.id} value={pole.id}>{pole.nom}{pole.actif ? "" : " (désactivé)"}</option>);
  return (
    <>
      {canEdit && (
        <form className="finance-inline-form" onSubmit={(event) => { event.preventDefault(); call(async () => { await send("/academique/filieres", "POST", { ...form.values, poleId: form.values.poleId || null }); form.setValues({ code: "", nom: "", poleId: form.values.poleId }); }); }}>
          <input required minLength={2} maxLength={12} placeholder="Code (ex. INFO)" aria-label="Code" {...form.bind("code")} />
          <input required minLength={2} placeholder="Nom de la filière" aria-label="Nom de la filière" {...form.bind("nom")} />
          <select aria-label="Pôle de la filière" value={form.values.poleId} onChange={(event) => form.setValues({ ...form.values, poleId: event.target.value })}>
            <option value="">Sans pôle</option>
            {poleOptions}
          </select>
          <button className="outline-button small" disabled={action.busy}>Ajouter</button>
        </form>
      )}
      {Boolean(pending.data?.length) && (
        <div className="expense-alert">
          <span>Filières saisies à la main dans des inscriptions, à rattacher au référentiel</span>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Texte saisi</th><th>Inscriptions</th><th>Filière du référentiel</th><th /></tr></thead>
              <tbody>
                {(pending.data ?? []).map((item) => (
                  <tr key={item.texte}>
                    <td className="strong-cell">{item.texte}</td>
                    <td>{item.inscriptions}</td>
                    <td>
                      <select className="pole-select" aria-label={`Filière pour « ${item.texte} »`} value={links[item.texte] ?? item.suggestion?.id ?? ""} onChange={(event) => setLinks({ ...links, [item.texte]: event.target.value })}>
                        <option value="">Choisir une filière</option>
                        {(programs.data ?? []).map((program) => <option key={program.id} value={program.id}>{program.nom}</option>)}
                      </select>
                      {item.suggestion && !links[item.texte] && <small className="cell-detail">Proposée d&apos;après le texte saisi</small>}
                    </td>
                    <td>{canEdit && <button className="row-action" disabled={action.busy || !(links[item.texte] ?? item.suggestion?.id)} onClick={() => link(item)}>Rattacher</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="finance-inline-form">
        <input type="search" placeholder="Rechercher une filière…" aria-label="Rechercher une filière" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filtrer par pôle" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">Tous les pôles</option>
          {poleOptions}
          <option value="aucun">Sans pôle</option>
        </select>
      </div>
      {(action.error || programs.error) && <p className="form-error">{action.error || programs.error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Filière</th><th>Pôle</th><th>Dernier niveau</th><th>État</th><th /></tr></thead>
          <tbody>
            {shown.map((program) => (
              <tr key={program.id}>
                <td className="strong-cell">{program.code}</td>
                <td>{program.nom}</td>
                <td>
                  {canEdit ? (
                    <select className="pole-select" aria-label={`Pôle de ${program.nom}`} value={program.poleId ?? ""} disabled={action.busy} onChange={(event) => call(() => send(`/academique/filieres/${program.id}`, "PATCH", { poleId: event.target.value || null }))}>
                      <option value="">Sans pôle</option>
                      {poleOptions}
                    </select>
                  ) : (program.pole?.nom ?? "—")}
                </td>
                <td>
                  {canEdit ? (
                    <select className="pole-select" aria-label={`Dernier niveau de ${program.nom}`} title="Une filière courte s'arrête avant la fin du cycle : choisissez son dernier niveau." value={program.niveauFinal ?? ""} disabled={action.busy} onChange={(event) => call(() => send(`/academique/filieres/${program.id}`, "PATCH", { niveauFinal: event.target.value || null }))}>
                      <option value="">Fin du cycle</option>
                      {levels.active.map((level) => <option key={level.id} value={level.code}>{level.code}</option>)}
                    </select>
                  ) : (program.niveauFinal ?? "Fin du cycle")}
                </td>
                <td><Badge tone={program.actif ? "ok" : "off"}>{program.actif ? "Active" : "Désactivée"}</Badge></td>
                <td>{canEdit && <button className="row-action" onClick={() => call(() => send(`/academique/filieres/${program.id}`, "PATCH", { actif: !program.actif }))}>{program.actif ? "Désactiver" : "Réactiver"}</button>}</td>
              </tr>
            ))}
            {!shown.length && <Empty columns={6}>{programs.data ? (programs.data.length ? "Aucune filière ne correspond." : "Aucune filière.") : "Chargement..."}</Empty>}
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
type CurriculumTarget = { yearId: string; programId: string; level: string };
type CopyResult = { maquettes: number; unites: number; matieres: number; dejaPresentes: number };

const copyMessage = (result: CopyResult) =>
  `${result.unites} unité(s) et ${result.matieres} matière(s) ajoutées${result.dejaPresentes ? ` · ${result.dejaPresentes} unité(s) déjà présente(s), conservée(s)` : ""}.`;

// Copie de la maquette affichée (ou de quelques unités : un tronc commun) vers d'autres filières et niveaux.
function CopyCurriculum({ source, units, years, programs, levels, onClose, onDone }: { source: CurriculumTarget; units: Unit[]; years: AcademicYear[]; programs: Program[]; levels: Level[]; onClose: () => void; onDone: () => void }) {
  const [unitCodes, setUnitCodes] = useState(() => new Set(units.map((unit) => unit.code)));
  const [yearId, setYearId] = useState(source.yearId);
  const [levelCodes, setLevelCodes] = useState(() => new Set([source.level]));
  const [programIds, setProgramIds] = useState(() => new Set<string>());
  const [poleId, setPoleId] = useState("");
  const action = useAction();
  const flip = <T,>(set: Set<T>, value: T) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next; };
  const poles = [...new Map(programs.filter((program) => program.pole).map((program) => [program.pole!.id, program.pole!.nom])).entries()];
  const shown = programs.filter((program) => program.actif && (!poleId || program.poleId === poleId));
  // La maquette source elle-même n'est pas une destination.
  const targets = [...programIds].flatMap((filiereId) => [...levelCodes].map((niveau) => ({ filiereId, niveau }))).filter((target) => !(yearId === source.yearId && target.filiereId === source.programId && target.niveau === source.level));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const result = await send<CopyResult>("/academique/maquette/copier", "POST", { source: { anneeId: source.yearId || undefined, filiereId: source.programId, niveau: source.level }, anneeCibleId: yearId || undefined, cibles: targets, unites: [...unitCodes] }, true);
      toast(`${result.maquettes} maquette(s) complétée(s) : ${copyMessage(result)}`);
      onDone();
      onClose();
    });
  };
  return (
    <Modal wide title="Copier cette maquette" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Rien n&apos;est écrasé : une unité déjà présente dans la maquette de destination (même code) est conservée, seules ses matières manquantes sont ajoutées. Chaque copie se modifie ensuite sans toucher à l&apos;original.</p>
        <p className="form-section-label">Unités à copier · {unitCodes.size} sur {units.length}</p>
        <div className="roll-call">
          {units.map((unit) => (
            <label key={unit.id}>
              <input type="checkbox" checked={unitCodes.has(unit.code)} onChange={() => setUnitCodes(flip(unitCodes, unit.code))} />
              <span>S{unit.semestre} · {unit.code} · {unit.nom}</span>
              <small>{unit.credits} cr.</small>
            </label>
          ))}
        </div>
        <div className="form-grid">
          {years.length > 0 && (
            <label>Vers l&apos;année
              <select value={yearId} onChange={(event) => setYearId(event.target.value)}>
                {years.filter((year) => year.statut !== "CLOTUREE").map((year) => <option key={year.id} value={year.id}>{year.libelle}</option>)}
              </select>
            </label>
          )}
          <label>Filières d&apos;un pôle
            <select value={poleId} onChange={(event) => setPoleId(event.target.value)}>
              <option value="">Tous les pôles</option>
              {poles.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
            </select>
          </label>
        </div>
        <p className="form-section-label">Niveaux de destination</p>
        <div className="roll-call">
          {levels.map((level) => (
            <label key={level.id}><input type="checkbox" checked={levelCodes.has(level.code)} onChange={() => setLevelCodes(flip(levelCodes, level.code))} /><span>{level.code} · {level.libelle}</span></label>
          ))}
        </div>
        <p className="form-section-label">
          Filières de destination · {programIds.size} choisie(s){" "}
          <button type="button" className="row-action" onClick={() => setProgramIds(new Set([...programIds, ...shown.map((program) => program.id)]))}>Tout cocher</button>
          <button type="button" className="row-action" onClick={() => setProgramIds(new Set())}>Tout décocher</button>
        </p>
        <div className="roll-call">
          {shown.map((program) => (
            <label key={program.id}><input type="checkbox" checked={programIds.has(program.id)} onChange={() => setProgramIds(flip(programIds, program.id))} /><span>{program.nom}</span><small>{program.code}</small></label>
          ))}
        </div>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} disabled={!targets.length || !unitCodes.size} label={`Copier vers ${targets.length} maquette(s)`} onCancel={onClose} />
      </form>
    </Modal>
  );
}

const IMPORT_COLUMNS = ["semestre", "code_unite", "nom_unite", "credits", "code_matiere", "nom_matiere", "coefficient", "volume_horaire"];
const IMPORT_SAMPLE = [
  IMPORT_COLUMNS.join(";"),
  "1;UE11;Mathématiques générales;6;MAT111;Analyse;2;45",
  "1;UE11;Mathématiques générales;6;MAT112;Algèbre;2;45",
  "1;UE12;Communication;4;COM121;Techniques d'expression;1;30",
  "2;UE21;Informatique;6;INF211;Algorithmique;3;60",
].join("\r\n");

// Lit un tableau collé depuis un tableur ou un fichier CSV : séparateur point-virgule, tabulation ou virgule.
function parseCurriculumRows(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const separator = [";", "\t", ","].reduce((best, candidate) => (lines[0].split(candidate).length > lines[0].split(best).length ? candidate : best));
  const cells = (line: string) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (quoted) {
        if (char === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else current += char;
      } else if (char === '"') quoted = true;
      else if (char === separator) { values.push(current.trim()); current = ""; }
      else current += char;
    }
    values.push(current.trim());
    return values;
  };
  // Une première ligne d'intitulés (« semestre ») est ignorée.
  const body = /^\d+$/.test(cells(lines[0])[0] ?? "") ? lines : lines.slice(1);
  return body.map((line) => {
    const [semestre, codeUnite, nomUnite, credits, codeMatiere, nomMatiere, coefficient, volumeHoraire] = cells(line);
    return { semestre, codeUnite, nomUnite, credits, codeMatiere, nomMatiere, coefficient, volumeHoraire };
  });
}

function ImportCurriculum({ target, label, onClose, onDone }: { target: CurriculumTarget; label: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const action = useAction();
  const rows = parseCurriculumRows(text);
  const unitCount = new Set(rows.map((row) => row.codeUnite)).size;
  const template = () => {
    const url = URL.createObjectURL(new Blob(["﻿", IMPORT_SAMPLE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modele-maquette.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const result = await send<CopyResult>("/academique/maquette/importer", "POST", { anneeAcademiqueId: target.yearId || undefined, filiereId: target.programId, niveau: target.level, lignes: rows }, true);
      toast(copyMessage(result));
      onDone();
      onClose();
    });
  };
  return (
    <Modal wide title={`Importer une maquette · ${label}`} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="panel-subtitle">Une ligne par matière, avec dans l&apos;ordre : {IMPORT_COLUMNS.join(", ")}. Une unité revient sur chacune de ses matières. Choisissez un fichier CSV, ou collez directement les lignes copiées depuis un tableur.</p>
        <div className="finance-inline-form">
          <input type="file" accept=".csv,.txt,text/csv,text/plain" aria-label="Fichier de la maquette" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setText); }} />
          <button type="button" className="row-action" onClick={template}>Télécharger le modèle</button>
        </div>
        <label>Lignes de la maquette<textarea rows={9} spellCheck={false} placeholder={IMPORT_SAMPLE} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <p className="panel-subtitle">{rows.length ? `${rows.length} ligne(s) lue(s) · ${unitCount} unité(s) d'enseignement. Le fichier est contrôlé en entier avant d'être enregistré ; ce qui existe déjà est conservé.` : "Aucune ligne lue pour l'instant."}</p>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} disabled={!rows.length} label="Importer" onCancel={onClose} />
      </form>
    </Modal>
  );
}

function CurriculumTab({ canEdit, signal }: { canEdit: boolean; signal: number }) {
  const programs = useLoad<Program[]>("/academique/filieres", signal);
  const years = useLoad<AcademicYear[]>("/academique/annees", signal);
  const levels = useLevels(signal);
  const [programId, setProgramId] = useState("");
  const [levelCode, setLevelCode] = useState("");
  const [yearId, setYearId] = useState("");
  const selected = programId || programs.data?.find((program) => program.actif)?.id || "";
  const level = levelCode || levels.active[0]?.code || "";
  const curriculum = useLoad<Curriculum>(selected && level ? `/academique/maquette?filiereId=${selected}&niveau=${encodeURIComponent(level)}${yearId ? `&anneeId=${yearId}` : ""}` : null, signal);
  const year = curriculum.data?.annee ?? null;
  const [editing, setEditing] = useState<CurriculumEdit | null>(null);
  const [tool, setTool] = useState<"copy" | "import" | null>(null);
  // Une carte par semestre ; on en ouvre une pour voir et modifier son contenu.
  const [semester, setSemester] = useState<"1" | "2" | null>(null);
  const programName = programs.data?.find((program) => program.id === selected)?.nom ?? "";
  // La maquette d'une année clôturée ne se modifie plus.
  const editable = canEdit && year?.statut !== "CLOTUREE";
  const target: CurriculumTarget = { yearId: year?.id ?? "", programId: selected, level };
  const semesterCards: HubCard<"1" | "2">[] = (["1", "2"] as const).map((key) => {
    const units = (curriculum.data?.unites ?? []).filter((unit) => unit.semestre === Number(key));
    const total = curriculum.data?.credits.find((item) => item.semestre === Number(key))?.total ?? 0;
    const subjects = units.reduce((sum, unit) => sum + unit.matieres.length, 0);
    return {
      key,
      icon: key === "1" ? BookOpen : BookOpenCheck,
      title: `Semestre ${key}`,
      value: curriculum.data ? `${total} / 30` : "…",
      detail: !curriculum.data ? "crédits" : units.length ? `crédits · ${units.length} unité(s), ${subjects} matière(s)` : "crédits · aucune unité d'enseignement",
      tone: curriculum.data && total !== 30 ? "warn" : undefined,
      info: `Le programme du semestre ${key} de ${programName || "cette filière"} en ${level}${year ? `, pour l'année ${year.libelle}` : ""} : ses unités d'enseignement avec leurs crédits, et dans chacune les matières avec leur coefficient et leur volume horaire. Un semestre complet totalise 30 crédits ; la carte reste orange tant que ce n'est pas le cas.`,
    };
  });
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
        else await send("/academique/unites", "POST", { anneeAcademiqueId: year?.id, filiereId: selected, niveau: level, semestre: editing.semestre, code, nom, credits });
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
  // Reprend dans l'année affichée les maquettes d'une autre année, sans rien écraser.
  const carryOver = async (sourceYear: AcademicYear) => {
    if (!year || !(await askConfirm({ title: `Reprendre les maquettes de ${sourceYear.libelle} ?`, message: `Toutes les maquettes de ${sourceYear.libelle} qui manquent en ${year.libelle} y sont copiées. Celles qui existent déjà sont conservées telles quelles.`, confirmLabel: "Reprendre" }))) return;
    void action.run(async () => {
      const result = await send<CopyResult>("/academique/maquette/reconduire", "POST", { sourceAnneeId: sourceYear.id, cibleAnneeId: year.id }, true);
      toast(`${result.maquettes} maquette(s) reprise(s) : ${copyMessage(result)}`);
      curriculum.reload();
    });
  };
  const otherYears = (years.data ?? []).filter((item) => item.id !== year?.id);
  return (
    <>
      <div className="finance-inline-form">
        {Boolean(years.data?.length) && (
          <label>Année
            <select className="expense-select" value={year?.id ?? ""} onChange={(event) => setYearId(event.target.value)}>
              {(years.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.libelle}{item.statut === "CLOTUREE" ? " (clôturée)" : ""}</option>)}
            </select>
          </label>
        )}
        <label>Filière
          <select className="expense-select" value={selected} onChange={(event) => setProgramId(event.target.value)}>
            {(programs.data ?? []).map((program) => <option key={program.id} value={program.id}>{program.nom}</option>)}
          </select>
        </label>
        <label>Niveau
          <select className="expense-select" value={level} onChange={(event) => setLevelCode(event.target.value)}>
            {levels.active.map((item) => <option key={item.id} value={item.code}>{item.code}</option>)}
          </select>
        </label>
        {canEdit && selected && Boolean(curriculum.data?.unites.length) && <button className="outline-button small" onClick={() => setTool("copy")}>Copier vers…</button>}
        {editable && selected && <button className="outline-button small" onClick={() => setTool("import")}>Importer un fichier</button>}
        {editable && year && otherYears.length > 0 && (
          <select className="expense-select" aria-label="Reprendre les maquettes d'une autre année" value="" disabled={action.busy} onChange={(event) => { const source = otherYears.find((item) => item.id === event.target.value); if (source) void carryOver(source); }}>
            <option value="">Reprendre les maquettes de…</option>
            {otherYears.map((item) => <option key={item.id} value={item.id}>{item.libelle}</option>)}
          </select>
        )}
      </div>
      <p className="panel-subtitle">{year ? `Maquette de l'année ${year.libelle}${year.statut === "CLOTUREE" ? " : année clôturée, lecture seule" : " : la modifier ne change pas celle des autres années"}.` : "Aucune année académique ouverte : cette maquette rejoindra la première année créée."}</p>
      {(action.error || curriculum.error) && !editing && <p className="form-error">{action.error || curriculum.error}</p>}
      {!selected && <p className="empty-state">Créez d&apos;abord une filière.</p>}
      {selected && !semester && <HubCards cards={semesterCards} onOpen={setSemester} />}
      {selected && semester && <HubBack label={`Maquette · ${programName} ${level}`} onBack={() => setSemester(null)} />}
      {selected && [1, 2].filter((semestre) => String(semestre) === semester).map((semestre) => {
        const units = (curriculum.data?.unites ?? []).filter((unit) => unit.semestre === semestre);
        const total = curriculum.data?.credits.find((item) => item.semestre === semestre)?.total ?? 0;
        return (
          <div className="curriculum-semester" key={semestre}>
            <div className="curriculum-head">
              <h4>Semestre {semestre}</h4>
              <Badge tone={total === 30 ? "ok" : "wait"}>{total} crédit(s){total !== 30 ? " · 30 attendus" : ""}</Badge>
              {editable && <button className="row-action" onClick={() => open({ kind: "unit", semestre })}>+ Unité d&apos;enseignement</button>}
            </div>
            {units.map((unit) => (
              <div className="curriculum-unit" key={unit.id}>
                <div className="curriculum-unit-head">
                  <strong>{unit.code} · {unit.nom}</strong>
                  <span>{unit.credits} crédit(s)</span>
                  {editable && <span className="action-group">
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
                            {editable && <button className="row-action" onClick={() => open({ kind: "subject", unit, subject })}>Modifier</button>}
                            {editable && <button className="row-action" onClick={() => void action.run(async () => { await send(`/academique/matieres/${subject.id}`, "PATCH", { actif: !subject.actif }); curriculum.reload(); })}>{subject.actif ? "Désactiver" : "Réactiver"}</button>}
                            {editable && <button className="row-action danger-row-action" onClick={() => void remove(`/academique/matieres/${subject.id}`, `la matière ${subject.code}`)}>Retirer</button>}
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
      {tool === "copy" && <CopyCurriculum source={target} units={curriculum.data?.unites ?? []} years={years.data ?? []} programs={programs.data ?? []} levels={levels.active} onClose={() => setTool(null)} onDone={curriculum.reload} />}
      {tool === "import" && <ImportCurriculum target={target} label={`${programName} ${level}${year ? ` · ${year.libelle}` : ""}`} onClose={() => setTool(null)} onDone={curriculum.reload} />}
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
  const seuil = Number(current.moyenneValidation);
  const eliminatoire = current.noteEliminatoire === null || current.noteEliminatoire === "" ? null : Number(current.noteEliminatoire);
  const sauf = eliminatoire === null ? "" : `, sauf s'il a une note sous ${eliminatoire}/20`;
  return (
    <div className="finance-rules">
      <form className="entity-form" onSubmit={save}>
        <p className="form-section-label">Calcul des moyennes</p>
        <label>
          <span className="field-title">Part du contrôle continu (%)<FieldHelp text={`Le poids des devoirs et interrogations de l'année face à l'examen final, dans la note de chaque matière. Exemple avec ${cc} % : 14 aux contrôles et 9 à l'examen donnent ${(14 * cc / 100 + 9 * (100 - cc) / 100).toFixed(2).replace(".", ",")}/20. Plus la valeur est haute, plus le travail régulier compte ; à 0, seul l'examen compte ; à 100, l'examen ne compte plus. S'applique à toutes les matières de toutes les filières.`} /></span>
          <input required type="number" min="0" max="100" disabled={!canEdit} value={Number(current.poidsControleContinu)} onChange={(event) => set({ poidsControleContinu: event.target.value })} />
          <small className="cell-detail">Moyenne d&apos;une matière = contrôle continu × {cc} % + examen × {100 - cc} %.</small>
        </label>
        <div className="form-grid">
          <label>
            <span className="field-title">Moyenne de validation (/20)<FieldHelp text={`La moyenne à atteindre pour valider une unité d'enseignement, un semestre ou l'année. À ${seuil}/20, une unité à ${Math.max(0, seuil - 0.5)} n'est pas validée et ses crédits ne sont pas acquis. C'est aussi le seuil des deux compensations ci-dessous. La relever rend tout plus exigeant ; la baisser fait valider davantage d'étudiants.`} /></span>
            <input required type="number" min="1" max="20" step="0.5" disabled={!canEdit} value={Number(current.moyenneValidation)} onChange={(event) => set({ moyenneValidation: event.target.value })} />
          </label>
          <label>
            <span className="field-title">Note éliminatoire (vide : aucune)<FieldHelp text={eliminatoire === null ? "Aucune note éliminatoire pour l'instant : une très mauvaise note dans une matière peut être rattrapée par les autres. Si vous en fixez une, par exemple 6, toute moyenne de matière en dessous empêche la compensation : l'unité concernée n'est pas validée, même avec une bonne moyenne générale." : `Une moyenne de matière sous ${eliminatoire}/20 ne peut pas être rattrapée par les autres notes : elle bloque la compensation du semestre et de l'année, et l'unité concernée reste à valider. Laissez vide pour qu'aucune note ne soit éliminatoire. Plus la valeur est haute, plus d'étudiants sont bloqués.`} /></span>
            <input type="number" min="0" max="20" step="0.5" disabled={!canEdit} value={current.noteEliminatoire === null ? "" : current.noteEliminatoire === "" ? "" : Number(current.noteEliminatoire)} onChange={(event) => set({ noteEliminatoire: event.target.value })} />
          </label>
        </div>
        <label className="check-row"><input type="checkbox" disabled={!canEdit} checked={current.compensationSemestre} onChange={(event) => set({ compensationSemestre: event.target.checked })} /><span><span className="field-title">Compensation entre les unités d&apos;un semestre<FieldHelp text={`Cochée : un étudiant dont la moyenne du semestre atteint ${seuil}/20 valide toutes les unités du semestre, même celles qu'il a ratées${sauf}. Il acquiert alors les 30 crédits. Décochée : chaque unité doit être validée séparément, et une seule unité ratée laisse des crédits à rattraper.`} /></span><small>Une moyenne de semestre d&apos;au moins {seuil}/20 valide tout le semestre, sauf note éliminatoire.</small></span></label>
        <label className="check-row"><input type="checkbox" disabled={!canEdit} checked={current.compensationAnnuelle} onChange={(event) => set({ compensationAnnuelle: event.target.checked })} /><span><span className="field-title">Compensation entre les deux semestres<FieldHelp text={`Cochée : un étudiant dont la moyenne annuelle atteint ${seuil}/20 valide toute l'année, même s'il a raté un semestre${sauf}. Exemple : 8 au premier semestre et 13 au second font 10,5 de moyenne annuelle, donc l'année est validée. Décochée : le semestre raté reste à rattraper, et l'étudiant ne passe qu'avec des dettes s'il a assez de crédits.`} /></span><small>Une moyenne annuelle d&apos;au moins {seuil}/20 valide toute l&apos;année, sauf note éliminatoire.</small></span></label>
        <p className="form-section-label">Passage et contrôles</p>
        <div className="form-grid">
          <label>
            <span className="field-title">Crédits pour passer avec des dettes<FieldHelp text={`Le nombre de crédits qu'un étudiant doit avoir acquis sur les 60 de l'année pour passer en année supérieure sans avoir tout validé. Avec ${current.creditsPassage} : à ${current.creditsPassage} crédits ou plus il est « admis avec crédits à rattraper », en dessous il est ajourné. À 60, plus personne ne passe avec des dettes ; à 0, tout le monde passe. Ne s'applique pas au dernier niveau d'un parcours, où tous les crédits sont exigés.`} /></span>
            <input required type="number" min="0" max="60" disabled={!canEdit} value={current.creditsPassage} onChange={(event) => set({ creditsPassage: Number(event.target.value) })} />
          </label>
          <label>
            <span className="field-title">Seuil d&apos;alerte d&apos;absences (%)<FieldHelp text={`La part d'heures de cours manquées à partir de laquelle un étudiant est signalé dans le suivi de l'assiduité. Avec ${Number(current.seuilAbsences)} % : sur 100 heures tenues, l'alerte se déclenche à ${Number(current.seuilAbsences)} heures d'absence. C'est un signal pour agir, il ne bloque ni les notes ni le passage. Une valeur basse signale plus tôt, donc plus d'étudiants ; à 0, aucune alerte.`} /></span>
            <input required type="number" min="0" max="100" disabled={!canEdit} value={Number(current.seuilAbsences)} onChange={(event) => set({ seuilAbsences: event.target.value })} />
          </label>
        </div>
        <label className="check-row"><input type="checkbox" disabled={!canEdit} checked={current.blocageImpayes} onChange={(event) => set({ blocageImpayes: event.target.checked })} /><span><span className="field-title">Retenir les bulletins des étudiants qui n&apos;ont pas soldé leur scolarité<FieldHelp text="Cochée : le bulletin d'un étudiant qui a encore un reste à payer ne peut pas être édité ; il redevient disponible dès que tout est réglé. Ses notes sont quand même calculées et délibérées normalement. Décochée : tous les bulletins s'éditent, quel que soit l'état des paiements." /></span><small>Le bulletin redevient disponible dès que le reste à payer est nul.</small></span></label>
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
          <li>Au dernier niveau d&apos;un parcours, tous les crédits sont exigés : pas de passage avec dettes.</li>
          <li>Une unité acquise le reste : le redoublant ne repasse que celles qui lui manquent.</li>
          <li>Les crédits dus par un étudiant admis avec dettes sont suivis jusqu&apos;à leur rattrapage ; pas de diplôme tant qu&apos;il en reste.</li>
          <li>Une maquette vaut pour une année : la modifier ne change ni les années passées ni les suivantes.</li>
          <li>Deux épreuves ne se chevauchent pas pour une même classe, une même salle ou un même surveillant.</li>
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
  type Tab = "poles" | "annees" | "niveaux" | "filieres" | "maquettes" | "salles" | "regles";
  const [tab, setTab] = useState<Tab | null>(null);
  // Chiffres clés des cartes.
  const years = useLoad<AcademicYear[]>(tab ? null : "/academique/annees", refreshSignal);
  const programs = useLoad<Program[]>(tab ? null : "/academique/filieres", refreshSignal);
  const poles = useLoad<Pole[]>(tab ? null : "/academique/poles", refreshSignal);
  const rooms = useLoad<Room[]>(tab ? null : "/academique/salles", refreshSignal);
  const rules = useLoad<Rules>(tab ? null : "/academique/parametres", refreshSignal);
  const levels = useLoad<Level[]>(tab ? null : "/academique/niveaux", refreshSignal);
  const curricula = useLoad<CurriculumList>(tab ? null : "/academique/maquettes", refreshSignal);
  const tabs: Array<[Tab, string, string]> = [
    ["poles", "Pôles", "Les grands domaines de formation, et les filières que chacun regroupe."],
    ["annees", "Années", "Chaque année porte ses classes, ses notes et ses délibérations."],
    ["niveaux", "Niveaux", "Les niveaux d'études et leurs cycles : licence, master, ingénieur…"],
    ["filieres", "Filières", "Les parcours proposés par l'établissement."],
    ["maquettes", "Maquettes", "Unités d'enseignement, matières, coefficients et crédits par filière, par niveau et par année."],
    ["salles", "Salles", "Les salles utilisées par l'emploi du temps et les examens."],
    ["regles", "Règles", "Les règles de calcul et de passage, appliquées à tous les résultats."],
  ];
  const active = tabs.find(([key]) => key === tab);
  const openYear = years.data?.find((year) => year.statut !== "CLOTUREE");
  const activePrograms = programs.data?.filter((item) => item.actif).length;
  const withoutPole = programs.data?.filter((item) => item.actif && !item.poleId).length ?? 0;
  const openLevels = (levels.data ?? []).filter((item) => item.actif);
  const finals = openLevels.filter((item) => endsCycle(item, openLevels));
  const expected = activePrograms === undefined || !levels.data ? undefined : activePrograms * openLevels.length;
  const cards: HubCard<Tab>[] = [
    { key: "poles", icon: Network, title: "Pôles", value: poles.data ? `${poles.data.filter((item) => item.actif).length}` : "…", detail: !poles.data ? "pôle(s) de formation" : withoutPole ? `pôle(s) · ${withoutPole} filière(s) sans pôle` : `pôle(s) · ${poles.data.reduce((total, pole) => total + pole.filieres.length, 0)} filière(s) rattachée(s)`, tone: withoutPole ? "warn" : undefined, info: "Les grands domaines de formation de l'université (industriel, management, technologique, agricole…) et les filières que chacun regroupe. Rien n'est figé : ajoutez un pôle, renommez-le, désactivez-le, et déplacez une filière d'un pôle à l'autre. Chaque modification est tracée dans le journal d'audit." },
    { key: "annees", icon: CalendarDays, title: "Années", value: years.data ? `${years.data.length}` : "…", detail: !years.data ? "année(s) académique(s)" : openYear ? `année(s) · en cours : ${openYear.libelle}` : "Aucune année ouverte", tone: years.data && !openYear ? "alert" : undefined, info: "Les années académiques. Chaque année porte ses classes, ses notes et ses délibérations. Ouvrez-la avec le même libellé que l'année scolaire des inscriptions (par exemple 2026-2027) ; une fois clôturée, elle devient définitive." },
    { key: "niveaux", icon: Layers, title: "Niveaux", value: levels.data ? `${openLevels.length}` : "…", detail: !levels.data ? "niveau(x) d'études" : `${openLevels.map((item) => item.code).join(", ")} · fin de parcours : ${finals.map((item) => item.code).join(", ") || "—"}`, info: "Les niveaux d'études ouverts : L1, L2, L3, M1, cycle ingénieur… Chacun appartient à un cycle et y porte un rang ; le passage va d'un rang au suivant, et le dernier rang délivre le diplôme. Ajoutez un niveau pour ouvrir une année d'études de plus : il devient aussitôt disponible pour les classes, les maquettes et les inscriptions." },
    { key: "filieres", icon: GraduationCap, title: "Filières", value: activePrograms === undefined ? "…" : `${activePrograms}`, detail: "filière(s) active(s)", info: "Les parcours que l'établissement propose, avec leur code, leur nom et le pôle auquel ils appartiennent. Une filière sert à créer les classes et à bâtir les maquettes ; désactivez celle qui n'est plus ouverte au lieu de la supprimer." },
    { key: "maquettes", icon: LayoutList, title: "Maquettes", value: curricula.data ? `${curricula.data.maquettes.length}` : "…", detail: !curricula.data ? "maquette(s) posée(s)" : `maquette(s) posée(s)${curricula.data.annee ? ` pour ${curricula.data.annee.libelle}` : ""}${expected ? ` sur ${expected} possibles (filières × niveaux)` : ""}`, info: "Le programme de chaque filière et de chaque niveau, année par année : unités d'enseignement par semestre, matières, coefficients, crédits et volumes horaires. Les notes et les moyennes se calculent d'après la maquette de l'année. Pour ne pas tout ressaisir : copiez une maquette ou un tronc commun vers d'autres filières, importez un fichier, ou reprenez les maquettes d'une autre année." },
    { key: "salles", icon: DoorOpen, title: "Salles", value: rooms.data ? `${rooms.data.filter((item) => item.actif).length}` : "…", detail: "salle(s) disponible(s)", info: "Les salles utilisées par l'emploi du temps et les examens, avec leur capacité. L'emploi du temps s'en sert pour détecter deux cours placés dans la même salle au même moment." },
    { key: "regles", icon: Scale, title: "Règles", value: rules.data ? `${Number(rules.data.moyenneValidation)}/20` : "…", detail: rules.data ? `pour valider · ${rules.data.creditsPassage} crédits pour passer` : "moyenne de validation", info: "Les règles de calcul et de passage, appliquées à tous les résultats : poids du contrôle continu, moyenne de validation, note éliminatoire, compensation entre matières, crédits exigés pour passer, seuil d'absences et blocage des bulletins en cas d'impayé." },
  ];
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Structure académique" text="Posez une fois le cadre : pôles, années, niveaux, filières, maquettes et règles. Tout le reste s'appuie dessus." />
      {!tab && <HubCards cards={cards} onOpen={setTab} />}
      {tab && active && (
        <>
          <HubBack label="Structure académique" onBack={() => setTab(null)} />
          <Panel eyebrow={active[1]} title={active[2]}>
            {tab === "poles" && <PolesTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "annees" && <YearsTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "niveaux" && <LevelsTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "filieres" && <ProgramsTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "maquettes" && <CurriculumTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "salles" && <RoomsTab canEdit={canEdit} signal={refreshSignal} />}
            {tab === "regles" && <RulesTab canEdit={canEdit} signal={refreshSignal} />}
          </Panel>
        </>
      )}
    </div>
  );
}
