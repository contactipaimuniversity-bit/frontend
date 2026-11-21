"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CalendarClock, CalendarDays, Clock, IdCard, MapPin, UserRound, UserX, Wallet } from "lucide-react";
import { HomeAnnouncements, MessagesBell } from "@/components/etudiant/student-announcements";
import { EmptyState, Loaded, Pill, ScreenHeader, Section, StaleNote } from "@/components/etudiant/student-ui";
import { Attendance, Exam, Fees, Grades, JOURS, Slot, StudentProfile, StudentResource, Timetable, hours, money, shortDate, toMinutes, useStudentResource, weekday } from "@/lib/student-api";

const EXAM_TYPES: Record<string, string> = { CONTROLE: "Contrôle", EXAMEN: "Examen", RATTRAPAGE: "Rattrapage" };

/** Prochain créneau à venir (aujourd'hui, ou le prochain jour de cours). */
function nextSlot(slots: Slot[], now = new Date()) {
  if (!slots.length) return null;
  const today = weekday(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = ((today - 1 + offset) % 7) + 1;
    const candidates = slots
      .filter((slot) => slot.jour === day && (offset > 0 || toMinutes(slot.heureFin) > minutes))
      .sort((first, second) => toMinutes(first.heureDebut) - toMinutes(second.heureDebut));
    if (candidates.length) {
      const slot = candidates[0];
      const startsIn = offset === 0 ? toMinutes(slot.heureDebut) - minutes : null;
      return { slot, offset, startsIn };
    }
  }
  return null;
}

function whenLabel(next: NonNullable<ReturnType<typeof nextSlot>>) {
  if (next.offset === 0) {
    if (next.startsIn !== null && next.startsIn <= 0) return { text: "En cours", tone: "ok" as const };
    if (next.startsIn !== null && next.startsIn < 90) return { text: `Dans ${next.startsIn} min`, tone: "ok" as const };
    return { text: "Aujourd'hui", tone: "info" as const };
  }
  if (next.offset === 1) return { text: "Demain", tone: "info" as const };
  return { text: JOURS[next.slot.jour], tone: "muted" as const };
}

type SlotStatus = { kind: "past" | "live" | "upcoming"; progress: number; remaining: number };

/** L'heure qui avance : rafraîchie toutes les 30 secondes. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Passé, en cours ou à venir, d'après le jour de la semaine et l'heure. */
function slotStatus(slot: Slot, now: Date): SlotStatus {
  const today = weekday(now);
  const minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const start = toMinutes(slot.heureDebut);
  const end = toMinutes(slot.heureFin);
  // Le dimanche, la grille affichée est celle de la semaine qui vient.
  if (today === 7) return { kind: "upcoming", progress: 0, remaining: 0 };
  if (slot.jour < today || (slot.jour === today && minutes >= end)) return { kind: "past", progress: 1, remaining: 0 };
  if (slot.jour === today && minutes >= start) {
    const length = Math.max(1, end - start);
    return { kind: "live", progress: Math.min(1, (minutes - start) / length), remaining: Math.ceil(end - minutes) };
  }
  return { kind: "upcoming", progress: 0, remaining: 0 };
}

function SlotStatusPill({ status }: { status: SlotStatus }) {
  if (status.kind === "past") return <Pill tone="muted">Passé</Pill>;
  if (status.kind === "live") return <Pill tone="ok">En cours</Pill>;
  return <Pill tone="info">À venir</Pill>;
}

function SlotCard({ slot, badge, status }: { slot: Slot; badge?: { text: string; tone: "ok" | "info" | "muted" }; status?: SlotStatus }) {
  const live = status?.kind === "live";
  return (
    <article className={`stu-slot${status ? ` stu-slot-${status.kind}` : ""}`}>
      <div className="stu-slot-time">
        <strong>{slot.heureDebut}</strong>
        <span>{slot.heureFin}</span>
      </div>
      <div className="stu-slot-body">
        {status ? <SlotStatusPill status={status} /> : badge && <Pill tone={badge.tone}>{badge.text}</Pill>}
        <h3>{slot.matiere}</h3>
        <p>
          {slot.salle && <span><MapPin size={13} aria-hidden="true" /> {slot.salle}</span>}
          {slot.enseignant && <span><UserRound size={13} aria-hidden="true" /> {slot.enseignant}</span>}
        </p>
        {live && status && (
          <div className="stu-slot-track">
            <div className="stu-slot-progress" role="progressbar" aria-valuenow={Math.round(status.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement du cours">
              <span style={{ width: `${status.progress * 100}%` }} />
            </div>
            <small>{status.remaining > 0 ? `Fin dans ${status.remaining} min` : "Se termine"}</small>
          </div>
        )}
      </div>
    </article>
  );
}

function ExamCard({ exam }: { exam: Exam }) {
  const date = new Date(exam.date);
  return (
    <article className="stu-exam">
      <div className="stu-exam-date">
        <span>{date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span>
        <strong>{date.getDate()}</strong>
      </div>
      <div className="stu-slot-body">
        <Pill tone={exam.type === "EXAMEN" ? "warn" : exam.type === "RATTRAPAGE" ? "bad" : "info"}>{EXAM_TYPES[exam.type] ?? exam.type}</Pill>
        <h3>{exam.matiere}</h3>
        <p>
          <span><Clock size={13} aria-hidden="true" /> {date.toLocaleDateString("fr-FR", { weekday: "long" })}{exam.heureDebut ? ` · ${exam.heureDebut}${exam.heureFin ? `–${exam.heureFin}` : ""}` : ""}</span>
          {exam.salle && <span><MapPin size={13} aria-hidden="true" /> {exam.salle}</span>}
        </p>
      </div>
    </article>
  );
}

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

// ---------- Accueil ----------

export function HomeScreen({ profile }: { profile: StudentResource<StudentProfile>; photo: string | null }) {
  const timetable = useStudentResource<Timetable>("/etudiant/moi/emploi-du-temps");
  const exams = useStudentResource<Exam[]>("/etudiant/moi/examens");
  const fees = useStudentResource<Fees>("/etudiant/moi/scolarite");
  const attendance = useStudentResource<Attendance>("/etudiant/moi/assiduite");
  const grades = useStudentResource<Grades>("/etudiant/moi/notes");
  const [now] = useState(() => new Date());

  const student = profile.data?.etudiant;
  const inscription = profile.data?.inscription;
  const next = useMemo(() => nextSlot(timetable.data?.creneaux ?? [], now), [timetable.data, now]);
  const upcoming = useMemo(() => {
    const today = startOfToday();
    return (exams.data ?? []).filter((exam) => new Date(exam.date).getTime() >= today).slice(0, 2);
  }, [exams.data]);
  const lastResult = grades.data?.resultats.filter((item) => item.disponible).at(-1);
  const latestGrades = grades.data?.notes.slice(0, 3) ?? [];

  return (
    <div className="stu-screen">
      <header className="stu-home-head">
        <div className="stu-greeting">
          <p>{now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>Bonjour{student ? ` ${student.prenom.split(" ")[0]}` : ""}</h1>
        </div>
        <div className="stu-home-actions">
          <MessagesBell />
          <Image src="/etudiant/icon-192.png" alt="IPAIM University" width={44} height={44} />
        </div>
      </header>

      {profile.staleSince && <StaleNote since={profile.staleSince} onRetry={profile.reload} />}

      {profile.data ? (
        inscription ? (
          <>
            <section className="stu-hero" aria-label="Mon année">
              <span className="stu-hero-chip">{inscription.anneeScolaire}</span>
              <div>
                <h2>{inscription.classe?.nom ?? `${inscription.filiere} · ${inscription.niveau}`}</h2>
                <p className="stu-hero-sub">{inscription.filiere} · {inscription.niveau} · {student?.matricule ?? "sans matricule"}</p>
              </div>
              <dl className="stu-hero-stats">
                <div><dt>Absences</dt><dd>{attendance.data ? hours(attendance.data.totalMinutes) : "—"}</dd></div>
                <div><dt>À payer</dt><dd>{fees.data?.situation ? money(fees.data.situation.resteTotal) : "—"}</dd></div>
                <div><dt>Moyenne</dt><dd>{lastResult?.disponible && lastResult.resultat.moyenne !== null ? lastResult.resultat.moyenne.toFixed(2) : "—"}</dd></div>
              </dl>
            </section>
          </>
        ) : (
          <div className="stu-info"><p>Aucune inscription enregistrée à ton nom.</p></div>
        )
      ) : (
        <Loaded resource={profile} lines={3}>{() => null}</Loaded>
      )}

      <HomeAnnouncements />

      <nav className="stu-shortcuts" aria-label="Raccourcis">
        <Link href="/etudiant/cours"><CalendarDays aria-hidden="true" />Emploi du temps</Link>
        <Link href="/etudiant/notes"><BookOpenCheck aria-hidden="true" />Notes</Link>
        <Link href="/etudiant/paiements"><Wallet aria-hidden="true" />Paiements</Link>
        <Link href="/etudiant/carte"><IdCard aria-hidden="true" />Carte</Link>
        <Link href="/etudiant/examens"><CalendarClock aria-hidden="true" />Examens</Link>
        <Link href="/etudiant/absences"><UserX aria-hidden="true" />Absences</Link>
      </nav>

      <Section title="Prochain cours" action={<Link href="/etudiant/cours" className="stu-link">Emploi du temps</Link>}>
        {timetable.data ? (
          next ? <SlotCard slot={next.slot} badge={whenLabel(next)} status={next.offset === 0 && next.startsIn !== null && next.startsIn <= 0 ? slotStatus(next.slot, now) : undefined} /> : <EmptyState icon={null} title="Aucun cours programmé." />
        ) : (
          <Loaded resource={timetable} lines={1}>{() => null}</Loaded>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section title="Prochaines épreuves" action={<Link href="/etudiant/examens" className="stu-link">Tout voir</Link>}>
          <div className="stu-list">{upcoming.map((exam) => <ExamCard key={exam.id} exam={exam} />)}</div>
        </Section>
      )}

      {latestGrades.length > 0 && (
        <Section title="Dernières notes" action={<Link href="/etudiant/notes" className="stu-link">Tout voir</Link>}>
          <div className="stu-card stu-rows">
            {latestGrades.map((grade) => (
              <div key={grade.id} className="stu-row">
                <div>
                  <strong>{grade.matiere.nom}</strong>
                  <span>{grade.evaluation.libelle}</span>
                </div>
                <b className={gradeTone(grade.valeur, grade.evaluation.bareme)}>{grade.absent ? "Abs." : grade.valeur === null ? "—" : `${grade.valeur}/${grade.evaluation.bareme}`}</b>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function gradeTone(value: number | null, scale: number) {
  if (value === null) return "stu-grade";
  const ratio = value / scale;
  return `stu-grade ${ratio >= 0.5 ? "stu-grade-ok" : ratio >= 0.4 ? "stu-grade-warn" : "stu-grade-bad"}`;
}

// ---------- Emploi du temps et examens ----------

export function TimetableScreen({ initial }: { initial: "semaine" | "examens" }) {
  const [view, setView] = useState(initial);
  const timetable = useStudentResource<Timetable>("/etudiant/moi/emploi-du-temps");
  const exams = useStudentResource<Exam[]>("/etudiant/moi/examens");
  const today = weekday();
  const [day, setDay] = useState(today === 7 ? 1 : today);
  const [showPast, setShowPast] = useState(false);
  const now = useNow();

  return (
    <div className="stu-screen">
      <ScreenHeader title={view === "semaine" ? "Emploi du temps" : "Examens"} subtitle={timetable.data?.classe ?? undefined} />
      <div className="stu-segmented">
        <button type="button" className={view === "semaine" ? "on" : ""} onClick={() => setView("semaine")}>Semaine</button>
        <button type="button" className={view === "examens" ? "on" : ""} onClick={() => setView("examens")}>Examens</button>
      </div>

      {view === "semaine" ? (
        <Loaded resource={timetable} lines={4}>
          {(data) => {
            const days = [1, 2, 3, 4, 5, 6].filter((item) => item <= 5 || data.creneaux.some((slot) => slot.jour === item));
            const slots = data.creneaux.filter((slot) => slot.jour === day);
            return (
              <>
                <div className="stu-days" role="tablist" aria-label="Jour">
                  {days.map((item) => {
                    const count = data.creneaux.filter((slot) => slot.jour === item).length;
                    return (
                      <button key={item} type="button" role="tab" aria-selected={day === item} className={`${day === item ? "on" : ""}${item === today ? " today" : ""}`} onClick={() => setDay(item)}>
                        <span>{JOURS[item].slice(0, 3)}</span>
                        <i aria-label={`${count} cours`}>{count || "·"}</i>
                      </button>
                    );
                  })}
                </div>
                {!data.classe ? (
                  <EmptyState icon={null} title="Pas encore de classe." text="L'emploi du temps s'affichera dès ton affectation." />
                ) : slots.length ? (
                  <div className="stu-timeline">{slots.map((slot) => <SlotCard key={slot.id} slot={slot} status={slotStatus(slot, now)} />)}</div>
                ) : (
                  <EmptyState icon={null} title={`Pas de cours le ${JOURS[day].toLowerCase()}.`} />
                )}
              </>
            );
          }}
        </Loaded>
      ) : (
        <Loaded resource={exams} lines={4}>
          {(data) => {
            const todayStart = startOfToday();
            const coming = data.filter((exam) => new Date(exam.date).getTime() >= todayStart);
            const past = data.filter((exam) => new Date(exam.date).getTime() < todayStart).reverse();
            return (
              <>
                {coming.length ? <div className="stu-list">{coming.map((exam) => <ExamCard key={exam.id} exam={exam} />)}</div> : <EmptyState icon={null} title="Aucune épreuve à venir." />}
                {past.length > 0 && (
                  <Section title="Épreuves passées" action={<button type="button" className="stu-link" onClick={() => setShowPast((value) => !value)}>{showPast ? "Masquer" : `Afficher (${past.length})`}</button>}>
                    {showPast && <div className="stu-list stu-list-muted">{past.map((exam) => <ExamCard key={exam.id} exam={exam} />)}</div>}
                  </Section>
                )}
              </>
            );
          }}
        </Loaded>
      )}
    </div>
  );
}

// ---------- Absences et retards ----------

export function AbsencesScreen() {
  const attendance = useStudentResource<Attendance>("/etudiant/moi/assiduite");
  return (
    <div className="stu-screen">
      <ScreenHeader title="Absences et retards" back="/etudiant/profil" />
      <Loaded resource={attendance} lines={4}>
        {(data) => (
          <>
            <dl className="stu-figures">
              <div><dt>Absences</dt><dd>{hours(data.totalMinutes)}</dd></div>
              <div><dt>Non justifiées</dt><dd className={data.nonJustifieesMinutes ? "stu-text-bad" : ""}>{hours(data.nonJustifieesMinutes)}</dd></div>
              <div><dt>Retards</dt><dd>{data.retards.length}</dd></div>
            </dl>
            <Section title="Absences">
              {data.absences.length ? (
                <div className="stu-card stu-rows">
                  {data.absences.map((absence) => (
                    <div key={absence.id} className="stu-row">
                      <div>
                        <strong>{absence.matiere}</strong>
                        <span>{shortDate(absence.date, { weekday: "short", day: "numeric", month: "short" })} · {absence.heureDebut} · {hours(absence.dureeMinutes)}</span>
                        {absence.motif && <span>{absence.motif}</span>}
                      </div>
                      <Pill tone={absence.justifiee ? "ok" : "bad"}>{absence.justifiee ? "Justifiée" : "Non justifiée"}</Pill>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={null} title="Aucune absence." />
              )}
            </Section>
            {data.retards.length > 0 && (
              <Section title="Retards">
                <div className="stu-card stu-rows">
                  {data.retards.map((late) => (
                    <div key={late.id} className="stu-row">
                      <div>
                        <strong>{late.matiere}</strong>
                        <span>{shortDate(late.date, { weekday: "short", day: "numeric", month: "short" })} · {late.heureDebut}</span>
                      </div>
                      <Pill tone="warn">{late.minutes} min</Pill>
                    </div>
                  ))}
                </div>
              </Section>
            )}
            <p className="stu-footnote">Pour justifier une absence, présente ton justificatif à la scolarité.</p>
          </>
        )}
      </Loaded>
    </div>
  );
}
