"use client";

import { CalendarClock, ClipboardCheck, FileClock, UserX } from "lucide-react";
import { navigateTo, pathForClass, pathForGrades, pathForStudent, pathForView } from "@/lib/routes";
import { formatDate } from "@/lib/types";
import { Badge, Empty, HubCard, HubCards, PageIntro, Panel, number, personName, useLoad } from "@/components/ui-kit";

type Person = { id?: string; nom: string; prenom: string };
type Exam = { id: string; coursId: string; libelle: string; type: string; date?: string | null; heureDebut?: string | null; matiere: string; classe: string; anonyme: boolean; saisies: number; effectif: number; complete: boolean };
type Today = {
  annee: { id: string; libelle: string } | null;
  date: string;
  cours: { total: number; emarges: number; absents: number; aPointer: number; lignes: Array<{ creneauId: string; heureDebut: string; heureFin: string; classe: string; matiere: string; enseignant: Person | null; etat: "PRESENT" | "ABSENT" | "A_POINTER" }> } | null;
  evaluations: { aValider: Exam[]; enRetard: Exam[]; prochaines: Exam[]; fichesAGenerer: Exam[] } | null;
  assiduite?: { seuil: number; total: number; etudiants: Array<{ personne: Person & { id: string }; classeId: string; classe: string; taux: number }> };
  aCompleter?: { coursSansEnseignant: number; classesSansEmploiDuTemps: Array<{ id: string; nom: string }>; inscriptionsSansClasse: number };
};
type Key = "cours" | "valider" | "epreuves" | "absences";

const TYPES: Record<string, string> = { CONTROLE: "Contrôle continu", EXAMEN: "Examen", RATTRAPAGE: "Rattrapage" };
const longDay = (date: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date));

// Ce qui demande une action aujourd'hui dans la vie académique, sur un seul écran.
export function AcademicDashboardPage({ refreshSignal }: { refreshSignal: number }) {
  const today = useLoad<Today>("/academique/tableau-de-bord", refreshSignal);
  const data = today.data;
  const cours = data?.cours;
  const exams = data?.evaluations;
  // Une évaluation n'apparaît qu'une fois, sous son besoin le plus pressant.
  const tasks = exams
    ? [
        ...exams.aValider.map((item) => ({ item, tone: "run" as const, label: "À valider" })),
        ...exams.enRetard.map((item) => ({ item, tone: "bad" as const, label: "Notes manquantes" })),
        ...exams.fichesAGenerer.map((item) => ({ item, tone: "wait" as const, label: "Fiches d'anonymat à générer" })),
        ...exams.prochaines.map((item) => ({ item, tone: "off" as const, label: "À venir" })),
      ].filter((task, index, all) => all.findIndex((other) => other.item.id === task.item.id) === index)
    : [];
  const todo = data?.aCompleter;
  const cards: HubCard<Key>[] = [
    { key: "cours", icon: ClipboardCheck, title: "Cours du jour émargés", value: cours ? `${cours.emarges} / ${cours.total}` : "…", detail: cours ? `${cours.aPointer} à pointer · ${cours.absents} absence(s) d'enseignant` : "cours prévus aujourd'hui", tone: cours?.absents ? "alert" : cours?.aPointer ? "warn" : undefined, info: "Les cours prévus aujourd'hui à l'emploi du temps et ceux dont l'enseignant a déjà été émargé. Ouvre l'émargement des enseignants." },
    { key: "valider", icon: FileClock, title: "Évaluations à valider", value: exams ? `${exams.aValider.length}` : "…", detail: exams ? `${exams.enRetard.length} épreuve(s) passée(s) avec des notes manquantes` : "notes complètes en attente", tone: exams?.enRetard.length ? "alert" : exams?.aValider.length ? "warn" : undefined, info: "Les évaluations dont toutes les notes sont saisies et qui attendent la validation de la scolarité, et celles dont l'épreuve est passée sans que les notes soient complètes." },
    { key: "epreuves", icon: CalendarClock, title: "Épreuves dans 7 jours", value: exams ? `${exams.prochaines.length}` : "…", detail: exams?.fichesAGenerer.length ? `${exams.fichesAGenerer.length} sans fiches d'anonymat` : "épreuve(s) à préparer", tone: exams?.fichesAGenerer.length ? "warn" : undefined, info: "Les épreuves datées d'aujourd'hui aux sept prochains jours. Quand l'anonymat est obligatoire, celles dont les fiches ne sont pas encore générées sont signalées." },
    { key: "absences", icon: UserX, title: "Étudiants en alerte d'absences", value: data?.assiduite ? `${data.assiduite.total}` : "…", detail: data?.assiduite ? `au-delà de ${data.assiduite.seuil} % d'heures manquées sans justificatif` : "au-delà du seuil", tone: data?.assiduite?.total ? "alert" : undefined, info: "Les étudiants dont les absences non justifiées dépassent le seuil réglé dans « Structure académique », règles de calcul." },
  ];
  const open = (key: Key) => {
    if (key === "cours") navigateTo(pathForView("Enseignement"));
    else if (key === "absences") navigateTo(pathForView("Classes et étudiants"));
    else navigateTo(pathForView("Évaluations et notes"));
  };
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Académique" title="Tableau de bord académique" text={data ? `${longDay(data.date)}${data.annee ? ` · année ${data.annee.libelle}` : ""}. Ce qui demande une action aujourd'hui.` : today.error ? "" : "Chargement..."} />
      {today.error && <p className="form-error">{today.error}</p>}
      {data && !data.annee && <Panel title="Aucune année académique en cours">Ouvrez une année dans « Structure académique » pour suivre les cours et les évaluations.</Panel>}
      {data?.annee && (
        <>
          <HubCards cards={cards} onOpen={open} />
          <div className="dashboard-stack">
            <Panel eyebrow="Aujourd'hui" title={`${cours?.total ?? 0} cours prévu(s)`} subtitle="D'après l'emploi du temps. L'émargement se fait dans « Enseignement »." actions={<button className="outline-button small" onClick={() => navigateTo(pathForView("Enseignement"))}>Émarger les enseignants</button>}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Horaire</th><th>Cours</th><th>Enseignant</th><th>État</th></tr></thead>
                  <tbody>
                    {(cours?.lignes ?? []).map((line) => (
                      <tr key={line.creneauId}>
                        <td className="strong-cell">{line.heureDebut} – {line.heureFin}</td>
                        <td>{line.matiere}<small className="cell-detail">{line.classe}</small></td>
                        <td>{line.enseignant ? personName(line.enseignant) : <Badge tone="bad">Aucun enseignant</Badge>}</td>
                        <td><Badge tone={line.etat === "PRESENT" ? "ok" : line.etat === "ABSENT" ? "bad" : "off"}>{line.etat === "PRESENT" ? "Émargé" : line.etat === "ABSENT" ? "Absent" : "À pointer"}</Badge></td>
                      </tr>
                    ))}
                    {!cours?.lignes.length && <Empty columns={4}>Aucun cours n&apos;est prévu aujourd&apos;hui à l&apos;emploi du temps.</Empty>}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel eyebrow="Évaluations" title={`${tasks.length} évaluation(s) à suivre`} subtitle="Cliquez une ligne pour ouvrir l'évaluation.">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Évaluation</th><th>Classe</th><th>Date</th><th>Notes</th><th>À faire</th></tr></thead>
                  <tbody>
                    {tasks.map(({ item, tone, label }) => (
                      <tr key={item.id}>
                        <td><button className="dossier-open-button" onClick={() => navigateTo(pathForGrades(item.coursId, item.id))}>{item.libelle}</button><small className="cell-detail">{item.matiere} · {TYPES[item.type] ?? item.type}</small></td>
                        <td>{item.classe}</td>
                        <td>{item.date ? `${formatDate(item.date)}${item.heureDebut ? ` · ${item.heureDebut}` : ""}` : "—"}</td>
                        <td>{item.saisies} / {item.effectif}</td>
                        <td><Badge tone={tone}>{label}</Badge></td>
                      </tr>
                    ))}
                    {!tasks.length && <Empty columns={5}>Aucune évaluation ne demande d&apos;action.</Empty>}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel eyebrow="Assiduité" title={`${data.assiduite?.total ?? 0} étudiant(s) en alerte`} subtitle={`Absences non justifiées au-delà de ${data.assiduite?.seuil ?? 0} % des heures tenues.${(data.assiduite?.total ?? 0) > 10 ? " Les dix plus élevées sont affichées." : ""}`}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Étudiant</th><th>Classe</th><th>Heures manquées</th></tr></thead>
                  <tbody>
                    {(data.assiduite?.etudiants ?? []).map((line) => (
                      <tr key={line.personne.id}>
                        <td><button className="dossier-open-button" onClick={() => navigateTo(pathForStudent(line.personne.id))}>{personName(line.personne)}</button></td>
                        <td><button className="row-action" onClick={() => navigateTo(pathForClass(line.classeId, "assiduite"))}>{line.classe}</button></td>
                        <td><Badge tone="bad">{number(line.taux, 1)} %</Badge></td>
                      </tr>
                    ))}
                    {!data.assiduite?.etudiants.length && <Empty columns={3}>Aucun étudiant au-delà du seuil.</Empty>}
                  </tbody>
                </table>
              </div>
            </Panel>
            {todo && Boolean(todo.coursSansEnseignant || todo.classesSansEmploiDuTemps.length || todo.inscriptionsSansClasse) && (
              <Panel eyebrow="Mise en place" title="Ce qui reste à compléter">
                <ul className="expense-pieces">
                  {todo.inscriptionsSansClasse > 0 && <li><span><button className="dossier-open-button" onClick={() => navigateTo(pathForView("Classes et étudiants"))}>{todo.inscriptionsSansClasse} inscription(s) sans classe</button></span><small>Ces étudiants n&apos;ont ni classe ni matricule : affectez-les depuis la page de leur classe.</small></li>}
                  {todo.coursSansEnseignant > 0 && <li><span><button className="dossier-open-button" onClick={() => navigateTo(pathForView("Classes et étudiants"))}>{todo.coursSansEnseignant} matière(s) sans enseignant</button></span><small>Sans enseignant, un cours ne peut être ni émargé ni déclaré : attribuez-le dans la classe, carte « Cours et enseignants ».</small></li>}
                  {todo.classesSansEmploiDuTemps.map((classe) => <li key={classe.id}><span><button className="dossier-open-button" onClick={() => navigateTo(pathForView("Enseignement"))}>{classe.nom} : aucun emploi du temps</button></span><small>Placez ses cours dans « Enseignement », onglet « Emploi du temps ».</small></li>)}
                </ul>
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}
