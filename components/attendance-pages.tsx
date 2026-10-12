"use client";

import { FormEvent, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { askReason, toast } from "@/components/feedback";
import { monthLabel } from "@/lib/pdf-docs";
import { formatDate } from "@/lib/types";
import { Badge, Empty, FormActions, Panel, Tabs, downloadPdf, number, personName, send, today, useAction, useForm, useLoad } from "@/components/ui-kit";

type Person = { id: string; nom: string; prenom: string; matricule?: string };
type State = "PRESENT" | "ABSENT" | "CONGE" | "A_POINTER";
type Hours = { heureArrivee: string; heureDepart: string; toleranceRetard: number };
type StaffLine = {
  employe: Person & { fonction: string; service?: string | null };
  etat: State;
  pointage: { heureArrivee: string | null; heureDepart: string | null; observation?: string | null } | null;
  absence: { id: string; justifiee: boolean; motif?: string | null } | null;
  conge: { id: string; type: string; dateFin: string } | null;
  retardMinutes: number;
  departAnticipeMinutes: number;
};
type StaffDay = { date: string; horaires: Hours; synthese: { effectif: number; presents: number; absents: number; enConge: number; aPointer: number; retards: number }; lignes: StaffLine[] };
type StaffRecap = { annee: number; mois: number; lignes: Array<{ employe: Person & { fonction: string }; joursPointes: number; retards: number; minutesRetard: number; departsAnticipes: number; minutesDepartAnticipe: number; heuresTravaillees: number; joursAbsence: number; joursAbsenceInjustifiee: number }> };
type TeacherLine = {
  creneauId: string;
  heureDebut: string;
  heureFin: string;
  classe: string;
  matiere: string;
  salle: string | null;
  enseignant: Person | null;
  etat: State;
  seance: { id: string; dureeMinutes: number; cahierRempli: boolean } | null;
  absence: { id: string; justifiee: boolean; motif?: string | null } | null;
};
type TeacherDay = { date: string; synthese: { creneaux: number; presents: number; absents: number; aPointer: number }; lignes: TeacherLine[]; exceptionnelles: Array<{ id: string; heureDebut: string; dureeMinutes: number; classe: string; matiere: string; enseignant: Person | null }> };
type TeacherRecap = { annee: number; mois: number; lignes: Array<{ employe: Person; seances: number; heuresFaites: number; absences: number; absencesInjustifiees: number; heuresManquees: number }> };

const LEAVE_LABELS: Record<string, string> = { ANNUEL: "Congé annuel", MALADIE: "Maladie", MATERNITE: "Maternité", PERMISSION: "Permission", SANS_SOLDE: "Sans solde" };
const duration = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")}` : ""}` : `${minutes} min`);
const clock = () => new Date().toTimeString().slice(0, 5);
const shift = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
};
const dayLabel = (date: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));

// Choix du jour pointé : la veille, le lendemain (jamais au-delà d'aujourd'hui) ou une date précise.
function DayPicker({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  return (
    <>
      <button type="button" className="outline-button small" aria-label="Jour précédent" onClick={() => onChange(shift(date, -1))}><ChevronLeft size={15} aria-hidden="true" /></button>
      <input type="date" className="expense-select" aria-label="Jour pointé" max={today()} value={date} onChange={(event) => event.target.value && onChange(event.target.value)} />
      <button type="button" className="outline-button small" aria-label="Jour suivant" disabled={date >= today()} onClick={() => onChange(shift(date, 1))}><ChevronRight size={15} aria-hidden="true" /></button>
      {date !== today() && <button type="button" className="outline-button small" onClick={() => onChange(today())}>Aujourd&apos;hui</button>}
    </>
  );
}

// ---------- Personnel administratif et technique : arrivée et départ ----------

export function StaffAttendance({ canEdit }: { canEdit: boolean }) {
  type Tab = "jour" | "mois";
  const [tab, setTab] = useState<Tab>("jour");
  const [date, setDate] = useState(today());
  const [settings, setSettings] = useState(false);
  const day = useLoad<StaffDay>(`/rh/pointage/personnel?date=${date}`);
  const [year, month] = date.split("-").map(Number);
  const recap = useLoad<StaffRecap>(tab === "mois" ? `/rh/pointage/personnel/recapitulatif?annee=${year}&mois=${month}` : null);
  const hours = useForm({ heureArrivee: "08:00", heureDepart: "16:00", toleranceRetard: "10" });
  const action = useAction();
  const data = day.data;
  const run = (work: () => Promise<StaffDay>, done?: string) =>
    action.run(async () => {
      day.setData(await work());
      if (done) toast(done);
    });
  const point = (line: StaffLine, arrival: string | null, departure: string | null) =>
    run(() => send<StaffDay>(`/rh/pointage/personnel/${line.employe.id}`, "PUT", { date, heureArrivee: arrival, heureDepart: departure }, true));
  const absent = async (line: StaffLine, justified: boolean) => {
    const motif = justified ? await askReason({ title: `Absence justifiée de ${personName(line.employe)}`, message: "Une absence justifiée n'est pas retenue sur le salaire.", confirmLabel: "Enregistrer", reason: { label: "Justificatif présenté", minLength: 3, placeholder: "Certificat médical, permission accordée..." } }) : "";
    if (justified && !motif) return;
    void run(() => send<StaffDay>(`/rh/pointage/personnel/${line.employe.id}/absence`, "POST", { date, justifiee: justified, motif }, true));
  };
  // Tous ceux qui restent à pointer sont notés arrivés à l'heure normale.
  const allOnTime = () =>
    action.run(async () => {
      if (!data) return;
      let last = data;
      for (const line of data.lignes.filter((item) => item.etat === "A_POINTER")) last = await send<StaffDay>(`/rh/pointage/personnel/${line.employe.id}`, "PUT", { date, heureArrivee: data.horaires.heureArrivee, heureDepart: null }, true);
      day.setData(last);
      toast("Arrivées enregistrées.");
    });
  const saveHours = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      await send("/rh/parametres", "PATCH", { ...hours.values, toleranceRetard: Number(hours.values.toleranceRetard) }, true);
      setSettings(false);
      day.reload();
      toast("Horaires enregistrés.");
    });
  };
  const exportRecap = () =>
    recap.data &&
    downloadPdf(`pointage-${recap.data.annee}-${String(recap.data.mois).padStart(2, "0")}.pdf`, "Pointage du personnel", monthLabel(recap.data.annee, recap.data.mois), [
      ["Matricule", "Nom", "Prénom", "Fonction", "Jours pointés", "Heures travaillées", "Retards", "Minutes de retard", "Départs anticipés", "Jours d'absence", "Dont non justifiés"],
      ...recap.data.lignes.map((line) => [line.employe.matricule, line.employe.nom, line.employe.prenom, line.employe.fonction, line.joursPointes, line.heuresTravaillees, line.retards, line.minutesRetard, line.departsAnticipes, line.joursAbsence, line.joursAbsenceInjustifiee]),
    ]);
  const isToday = date === today();
  return (
    <>
      <Tabs label="Vue" value={tab} onChange={setTab} tabs={[["jour", "Pointage du jour"], ["mois", "Récapitulatif du mois"]]} />
      {(day.error || action.error) && <p className="form-error">{action.error || day.error}</p>}
      {tab === "jour" && (
        <Panel
          eyebrow={dayLabel(date)}
          title={data ? `${data.synthese.presents} présent(s) sur ${data.synthese.effectif}` : "Pointage du jour"}
          subtitle={data ? `${data.synthese.aPointer} à pointer · ${data.synthese.absents} absent(s) · ${data.synthese.enConge} en congé · ${data.synthese.retards} retard(s). Horaires : ${data.horaires.heureArrivee} – ${data.horaires.heureDepart}, tolérance ${data.horaires.toleranceRetard} min.` : "Chargement..."}
          actions={
            <>
              <DayPicker date={date} onChange={setDate} />
              {canEdit && Boolean(data?.synthese.aPointer) && <button className="outline-button small" disabled={action.busy} onClick={() => void allOnTime()}>Tous arrivés à {data?.horaires.heureArrivee}</button>}
              {canEdit && data && <button className="outline-button small" onClick={() => { action.setError(""); hours.setValues({ heureArrivee: data.horaires.heureArrivee, heureDepart: data.horaires.heureDepart, toleranceRetard: String(data.horaires.toleranceRetard) }); setSettings(!settings); }}>Horaires</button>}
            </>
          }
        >
          {settings && (
            <form className="entity-form expense-panel" onSubmit={saveHours}>
              <p className="form-section-label">Horaires de travail attendus</p>
              <div className="form-grid">
                <label>Arrivée<input required type="time" {...hours.bind("heureArrivee")} /></label>
                <label>Départ<input required type="time" {...hours.bind("heureDepart")} /></label>
              </div>
              <label>Tolérance de retard (minutes)<input required type="number" min="0" max="120" {...hours.bind("toleranceRetard")} /></label>
              <p className="panel-subtitle">Une arrivée dans la tolérance n&apos;est pas comptée comme un retard. Les retards sont une information : ils ne sont pas retenus sur le salaire.</p>
              <FormActions busy={action.busy} onCancel={() => setSettings(false)} />
            </form>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employé</th><th>Arrivée</th><th>Départ</th><th>État</th><th /></tr></thead>
              <tbody>
                {(data?.lignes ?? []).map((line) => {
                  const arrival = line.pointage?.heureArrivee ?? "";
                  const departure = line.pointage?.heureDepart ?? "";
                  const locked = !canEdit || line.etat === "ABSENT";
                  return (
                    <tr key={line.employe.id}>
                      <td className="strong-cell">{personName(line.employe)}<small className="cell-detail">{line.employe.matricule} · {line.employe.fonction}</small></td>
                      <td><input className="expense-select" type="time" aria-label={`Arrivée de ${personName(line.employe)}`} disabled={locked} key={`a:${arrival}`} defaultValue={arrival} onBlur={(event) => { if (event.target.value !== arrival) void point(line, event.target.value || null, event.target.value ? departure || null : null); }} /></td>
                      <td><input className="expense-select" type="time" aria-label={`Départ de ${personName(line.employe)}`} disabled={locked || !arrival} key={`d:${departure}`} defaultValue={departure} onBlur={(event) => { if (event.target.value !== departure) void point(line, arrival, event.target.value || null); }} /></td>
                      <td>
                        {line.etat === "PRESENT" && <Badge tone={line.retardMinutes ? "wait" : "ok"}>{line.retardMinutes ? `Retard de ${duration(line.retardMinutes)}` : "Présent"}</Badge>}
                        {line.etat === "ABSENT" && <Badge tone={line.absence?.justifiee ? "run" : "bad"}>{line.absence?.justifiee ? "Absence justifiée" : "Absent"}</Badge>}
                        {line.etat === "CONGE" && <Badge tone="off">{LEAVE_LABELS[line.conge?.type ?? ""] ?? "En congé"}</Badge>}
                        {line.etat === "A_POINTER" && <Badge tone="off">À pointer</Badge>}
                        {line.departAnticipeMinutes > 0 && <small className="cell-detail">Parti {duration(line.departAnticipeMinutes)} avant l&apos;heure</small>}
                        {line.absence?.motif && <small className="cell-detail">{line.absence.motif}</small>}
                        {line.etat === "CONGE" && line.conge && <small className="cell-detail">jusqu&apos;au {formatDate(line.conge.dateFin)}</small>}
                      </td>
                      <td className="action-group">
                        {canEdit && isToday && line.etat !== "ABSENT" && !arrival && <button className="row-action" disabled={action.busy} onClick={() => void point(line, clock(), null)}>Arrivée maintenant</button>}
                        {canEdit && isToday && arrival && !departure && <button className="row-action" disabled={action.busy} onClick={() => void point(line, arrival, clock())}>Départ maintenant</button>}
                        {canEdit && line.etat === "A_POINTER" && <button className="row-action danger-row-action" disabled={action.busy} onClick={() => void absent(line, false)}>Absent</button>}
                        {canEdit && line.etat === "A_POINTER" && <button className="row-action" disabled={action.busy} onClick={() => void absent(line, true)}>Absence justifiée</button>}
                        {canEdit && (line.etat === "ABSENT" || line.pointage) && <button className="row-action" disabled={action.busy} onClick={() => void run(() => send<StaffDay>(`/rh/pointage/personnel/${line.employe.id}?date=${date}`, "DELETE", undefined, true))}>Effacer</button>}
                      </td>
                    </tr>
                  );
                })}
                {!data?.lignes.length && <Empty columns={5}>{data ? "Aucun employé administratif ou technique en activité ce jour-là." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
          <p className="panel-subtitle">Saisissez l&apos;heure puis quittez la case : elle est enregistrée aussitôt. Une absence non justifiée rejoint le dossier de l&apos;employé et sera retenue sur sa paie du mois.</p>
        </Panel>
      )}
      {tab === "mois" && (
        <Panel eyebrow={monthLabel(year, month)} title="Récapitulatif du pointage" subtitle="Le mois est celui du jour sélectionné." actions={<><DayPicker date={date} onChange={setDate} /><button className="outline-button small" disabled={!recap.data?.lignes.length} onClick={() => exportRecap()}>Exporter (PDF)</button></>}>
          {recap.error && <p className="form-error">{recap.error}</p>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employé</th><th>Jours pointés</th><th>Heures travaillées</th><th>Retards</th><th>Départs anticipés</th><th>Absences</th></tr></thead>
              <tbody>
                {(recap.data?.lignes ?? []).map((line) => (
                  <tr key={line.employe.id}>
                    <td className="strong-cell">{personName(line.employe)}<small className="cell-detail">{line.employe.matricule} · {line.employe.fonction}</small></td>
                    <td>{line.joursPointes}</td>
                    <td>{number(line.heuresTravaillees, 1)} h</td>
                    <td>{line.retards ? <Badge tone="wait">{line.retards} · {duration(line.minutesRetard)}</Badge> : "—"}</td>
                    <td>{line.departsAnticipes ? `${line.departsAnticipes} · ${duration(line.minutesDepartAnticipe)}` : "—"}</td>
                    <td>{line.joursAbsence ? <Badge tone={line.joursAbsenceInjustifiee ? "bad" : "run"}>{number(line.joursAbsence, 1)} j{line.joursAbsenceInjustifiee ? ` · ${number(line.joursAbsenceInjustifiee, 1)} non justifié(s)` : ""}</Badge> : "—"}</td>
                  </tr>
                ))}
                {!recap.data?.lignes.length && <Empty columns={6}>{recap.data ? "Aucun employé à pointer ce mois-là." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

// ---------- Enseignants : émargement sur les créneaux de l'emploi du temps ----------

export function TeacherAttendance({ canEdit }: { canEdit: boolean }) {
  type Tab = "jour" | "mois";
  const [tab, setTab] = useState<Tab>("jour");
  const [date, setDate] = useState(today());
  const day = useLoad<TeacherDay>(`/rh/pointage/enseignants?date=${date}`);
  const [year, month] = date.split("-").map(Number);
  const recap = useLoad<TeacherRecap>(tab === "mois" ? `/rh/pointage/enseignants/recapitulatif?annee=${year}&mois=${month}` : null);
  const action = useAction();
  const data = day.data;
  const run = (work: () => Promise<TeacherDay>) => action.run(async () => day.setData(await work()));
  const present = (line: TeacherLine) => run(() => send<TeacherDay>("/rh/pointage/enseignants/presence", "POST", { creneauId: line.creneauId, date }, true));
  const absent = async (line: TeacherLine, justified: boolean) => {
    const motif = justified ? await askReason({ title: `Absence justifiée de ${personName(line.enseignant)}`, confirmLabel: "Enregistrer", reason: { label: "Justificatif présenté", minLength: 3, placeholder: "Maladie, mission, report convenu..." } }) : "";
    if (justified && !motif) return;
    void run(() => send<TeacherDay>("/rh/pointage/enseignants/absence", "POST", { creneauId: line.creneauId, date, justifiee: justified, motif }, true));
  };
  const exportRecap = () =>
    recap.data &&
    downloadPdf(`emargement-enseignants-${recap.data.annee}-${String(recap.data.mois).padStart(2, "0")}.pdf`, "Émargement des enseignants", monthLabel(recap.data.annee, recap.data.mois), [
      ["Matricule", "Nom", "Prénom", "Séances tenues", "Heures faites", "Séances manquées", "Dont non justifiées", "Heures manquées"],
      ...recap.data.lignes.map((line) => [line.employe.matricule, line.employe.nom, line.employe.prenom, line.seances, line.heuresFaites, line.absences, line.absencesInjustifiees, line.heuresManquees]),
    ]);
  return (
    <>
      <Tabs label="Vue" value={tab} onChange={setTab} tabs={[["jour", "Émargement du jour"], ["mois", "Récapitulatif du mois"]]} />
      {(day.error || action.error) && <p className="form-error">{action.error || day.error}</p>}
      {tab === "jour" && (
        <Panel
          eyebrow={dayLabel(date)}
          title={data ? `${data.synthese.presents} séance(s) émargée(s) sur ${data.synthese.creneaux}` : "Émargement du jour"}
          subtitle={data ? `${data.synthese.aPointer} à pointer · ${data.synthese.absents} absence(s). Seuls les créneaux prévus ce jour-là à l'emploi du temps peuvent être émargés.` : "Chargement..."}
          actions={<DayPicker date={date} onChange={setDate} />}
        >
          <div className="table-wrap">
            <table>
              <thead><tr><th>Horaire</th><th>Cours</th><th>Enseignant</th><th>État</th><th /></tr></thead>
              <tbody>
                {(data?.lignes ?? []).map((line) => (
                  <tr key={line.creneauId}>
                    <td className="strong-cell">{line.heureDebut} – {line.heureFin}</td>
                    <td>{line.matiere}<small className="cell-detail">{line.classe}{line.salle ? ` · ${line.salle}` : ""}</small></td>
                    <td>{line.enseignant ? personName(line.enseignant) : <Badge tone="bad">Aucun enseignant affecté</Badge>}</td>
                    <td>
                      {line.etat === "PRESENT" && <Badge tone="ok">Présent</Badge>}
                      {line.etat === "ABSENT" && <Badge tone={line.absence?.justifiee ? "run" : "bad"}>{line.absence?.justifiee ? "Absence justifiée" : "Absent"}</Badge>}
                      {line.etat === "A_POINTER" && <Badge tone="off">À pointer</Badge>}
                      {line.seance && !line.seance.cahierRempli && <small className="cell-detail">Cahier de textes à compléter</small>}
                      {line.absence?.motif && <small className="cell-detail">{line.absence.motif}</small>}
                    </td>
                    <td className="action-group">
                      {canEdit && line.enseignant && line.etat !== "PRESENT" && <button className="row-action" disabled={action.busy} onClick={() => void present(line)}>Présent</button>}
                      {canEdit && line.enseignant && line.etat === "A_POINTER" && <button className="row-action danger-row-action" disabled={action.busy} onClick={() => void absent(line, false)}>Absent</button>}
                      {canEdit && line.enseignant && line.etat !== "PRESENT" && !line.absence?.justifiee && <button className="row-action" disabled={action.busy} onClick={() => void absent(line, true)}>Absence justifiée</button>}
                      {canEdit && line.etat !== "A_POINTER" && <button className="row-action" disabled={action.busy} onClick={() => void run(() => send<TeacherDay>(`/rh/pointage/enseignants/${line.creneauId}?date=${date}`, "DELETE", undefined, true))}>Annuler</button>}
                    </td>
                  </tr>
                ))}
                {!data?.lignes.length && <Empty columns={5}>{data ? "Aucun cours prévu ce jour-là à l'emploi du temps." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
          {Boolean(data?.exceptionnelles.length) && (
            <>
              <p className="form-section-label">Séances exceptionnelles du jour (hors emploi du temps)</p>
              <ul className="expense-pieces">
                {data?.exceptionnelles.map((item) => <li key={item.id}><span>{item.heureDebut} · {item.matiere} · {item.classe}</span><small>{item.enseignant ? personName(item.enseignant) : "—"} · {duration(item.dureeMinutes)}</small></li>)}
              </ul>
            </>
          )}
          <p className="panel-subtitle">« Présent » enregistre la séance avec la durée du créneau : c&apos;est elle qui sera payée à un enseignant rémunéré à la séance. Le contenu enseigné et l&apos;appel des étudiants se complètent ensuite dans « Enseignement ». Un rattrapage hors emploi du temps se déclare là-bas comme séance exceptionnelle.</p>
        </Panel>
      )}
      {tab === "mois" && (
        <Panel eyebrow={monthLabel(year, month)} title="Récapitulatif par enseignant" subtitle="Le mois est celui du jour sélectionné." actions={<><DayPicker date={date} onChange={setDate} /><button className="outline-button small" disabled={!recap.data?.lignes.length} onClick={() => exportRecap()}>Exporter (PDF)</button></>}>
          {recap.error && <p className="form-error">{recap.error}</p>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Enseignant</th><th>Séances tenues</th><th>Heures faites</th><th>Séances manquées</th><th>Heures manquées</th></tr></thead>
              <tbody>
                {(recap.data?.lignes ?? []).map((line) => (
                  <tr key={line.employe.id}>
                    <td className="strong-cell">{personName(line.employe)}<small className="cell-detail">{line.employe.matricule}</small></td>
                    <td>{line.seances}</td>
                    <td>{number(line.heuresFaites, 1)} h</td>
                    <td>{line.absences ? <Badge tone={line.absencesInjustifiees ? "bad" : "run"}>{line.absences}{line.absencesInjustifiees ? ` · ${line.absencesInjustifiees} non justifiée(s)` : ""}</Badge> : "—"}</td>
                    <td>{line.heuresManquees ? `${number(line.heuresManquees, 1)} h` : "—"}</td>
                  </tr>
                ))}
                {!recap.data?.lignes.length && <Empty columns={5}>{recap.data ? "Aucune séance ni absence ce mois-là." : "Chargement..."}</Empty>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
