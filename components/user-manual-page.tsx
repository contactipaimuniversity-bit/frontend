"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarClock, CheckCircle2, ChevronRight, Circle, LayoutGrid, ListChecks, Search, UserRound, UsersRound, Workflow } from "lucide-react";
import { PageIntro, Panel } from "@/components/ui-kit";
import { canAccessView } from "@/lib/access";
import { MANUALS } from "@/lib/manuals";
import { MANUAL_SECTIONS, ManualSection, navigateTo, pathForManual } from "@/lib/routes";
import { User, ViewName } from "@/lib/types";

const DONE_KEY = (section: ManualSection) => `ipaim-manuel-${section}-etapes`;

function readDone(section: ManualSection): string[] {
  try { return JSON.parse(window.localStorage.getItem(DONE_KEY(section)) ?? "[]") as string[]; } catch { return []; }
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Manuel d'utilisation d'une section du menu : mise en place, quotidien,
// cas pratiques et erreurs fréquentes, avec un lien vers chaque écran cité.
// À monter avec key={section} : chaque manuel a sa propre progression.
export function UserManualPage({ section, user, onOpen }: { section: ManualSection; user: User | null; onOpen: (view: ViewName) => void }) {
  const manual = MANUALS[section];
  // Les étapes de mise en place cochées sont mémorisées sur cet appareil.
  const [doneTitles, setDoneTitles] = useState<string[]>(() => readDone(section));
  const [query, setQuery] = useState("");
  const toggle = (title: string) => {
    const next = doneTitles.includes(title) ? doneTitles.filter((item) => item !== title) : [...doneTitles, title];
    try { window.localStorage.setItem(DONE_KEY(section), JSON.stringify(next)); } catch { /* Stockage indisponible. */ }
    setDoneTitles(next);
  };
  const canOpen = (view?: ViewName) => Boolean(view && canAccessView(user, view));
  const openButton = (view?: ViewName, label = "Ouvrir l'écran") =>
    view && canOpen(view) ? <button type="button" className="outline-button small" onClick={() => onOpen(view)}>{label} <ArrowRight size={14} aria-hidden="true" /></button> : null;
  const setupDone = manual.setup.filter((step) => doneTitles.includes(step.title)).length;
  const needle = normalize(query.trim());
  const cases = needle ? manual.cases.filter((item) => normalize([item.title, item.situation, item.who, ...item.steps].join(" ")).includes(needle)) : manual.cases;
  const anchors = [
    { id: "ecrans", label: "Les écrans" },
    manual.flow && { id: "circuit", label: "Le circuit" },
    manual.roles && { id: "roles", label: "Qui fait quoi" },
    { id: "demarrer", label: "Pour commencer" },
    { id: "quotidien", label: "Le quotidien" },
    { id: "cas", label: `Cas pratiques (${manual.cases.length})` },
    { id: "erreurs", label: "Erreurs fréquentes" },
    manual.glossary && { id: "lexique", label: "Lexique" },
  ].filter(Boolean) as Array<{ id: string; label: string }>;
  const jump = (id: string) => document.getElementById(`manuel-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="content-scroll manual-page">
      <PageIntro eyebrow="Manuel d'utilisation" title={`Section ${manual.title}`} text={manual.summary} />

      <nav className="manual-sections" aria-label="Manuels des autres sections">
        {MANUAL_SECTIONS.map((key) => (
          <button key={key} type="button" className={key === section ? "active" : ""} aria-current={key === section ? "page" : undefined} onClick={() => navigateTo(pathForManual(key))}>
            <BookOpen size={14} aria-hidden="true" /> {MANUALS[key].title}
          </button>
        ))}
      </nav>

      <nav className="manual-toc" aria-label="Sommaire du manuel">
        <span>Sommaire</span>
        {anchors.map((item) => <button key={item.id} type="button" onClick={() => jump(item.id)}>{item.label}</button>)}
      </nav>

      <section id="manuel-ecrans" className="manual-anchor">
        <Panel eyebrow="1 · Se repérer" title={<span className="manual-title"><LayoutGrid size={18} aria-hidden="true" /> Les écrans de la section</span>} subtitle="Chaque écran a un rôle précis. Le bouton « Info sur la page », en haut de chaque écran, en donne le détail.">
          <div className="manual-screens">
            {manual.screens.map((item) => (
              <article key={item.view} className="manual-screen">
                <strong>{item.view}</strong>
                <p>{item.role}</p>
                {openButton(item.view, "Ouvrir")}
              </article>
            ))}
          </div>
        </Panel>
      </section>

      {manual.flow && (
        <section id="manuel-circuit" className="manual-anchor">
          <Panel eyebrow="2 · Comprendre" title={<span className="manual-title"><Workflow size={18} aria-hidden="true" /> {manual.flow.title}</span>} subtitle="Chaque étape débloque la suivante : on ne peut pas sauter une étape.">
            <ol className="manual-flow">
              {manual.flow.steps.map((step, index) => (
                <li key={step}><span className="manual-flow-step"><b>{index + 1}</b>{step}</span>{index < manual.flow!.steps.length - 1 && <ChevronRight size={16} aria-hidden="true" />}</li>
              ))}
            </ol>
          </Panel>
        </section>
      )}

      {manual.roles && (
        <section id="manuel-roles" className="manual-anchor">
          <Panel eyebrow="Les acteurs" title={<span className="manual-title"><UsersRound size={18} aria-hidden="true" /> Qui fait quoi</span>} subtitle="Une même personne peut tenir plusieurs rôles, sauf ceux que le système sépare volontairement (demander, valider, payer).">
            <div className="manual-roles">
              {manual.roles.map((item) => <div key={item.role}><strong>{item.role}</strong><p>{item.tasks}</p></div>)}
            </div>
          </Panel>
        </section>
      )}

      <section id="manuel-demarrer" className="manual-anchor">
        <Panel eyebrow="3 · Mettre en place (une seule fois)" title={<span className="manual-title"><ListChecks size={18} aria-hidden="true" /> Pour commencer</span>} subtitle="Suivez ces étapes dans l'ordre, puis cochez-les : votre progression est gardée sur cet appareil.">
          <div className="manual-progress" role="progressbar" aria-valuemin={0} aria-valuemax={manual.setup.length} aria-valuenow={setupDone} aria-label="Étapes faites">
            <span style={{ width: `${Math.round((setupDone / manual.setup.length) * 100)}%` }} />
          </div>
          <p className="manual-progress-label">{setupDone === manual.setup.length ? "Tout est en place : vous pouvez passer au quotidien." : `${setupDone} étape(s) faite(s) sur ${manual.setup.length}`}</p>
          <ol className="manual-setup">
            {manual.setup.map((step, index) => {
              const checked = doneTitles.includes(step.title);
              return (
                <li key={step.title} className={checked ? "done" : ""}>
                  <button type="button" className="manual-check" aria-pressed={checked} aria-label={checked ? `Marquer « ${step.title} » comme à faire` : `Marquer « ${step.title} » comme fait`} onClick={() => toggle(step.title)}>
                    {checked ? <CheckCircle2 size={22} aria-hidden="true" /> : <Circle size={22} aria-hidden="true" />}
                  </button>
                  <div>
                    <strong>Étape {index + 1} · {step.title}</strong>
                    <p>{step.detail}</p>
                    {openButton(step.open)}
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </section>

      <section id="manuel-quotidien" className="manual-anchor">
        <Panel eyebrow="4 · Le travail régulier" title={<span className="manual-title"><CalendarClock size={18} aria-hidden="true" /> Le quotidien</span>} subtitle="Ce qu'il faut faire, et quand. Une routine tenue évite les mauvaises surprises en fin de mois.">
          <div className="manual-routine">
            {manual.routine.map((block) => (
              <article key={block.when}>
                <h4>{block.when}</h4>
                <ul>{block.tasks.map((task) => <li key={task}>{task}</li>)}</ul>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <section id="manuel-cas" className="manual-anchor">
        <Panel
          eyebrow="5 · Pratiquer"
          title={<span className="manual-title"><BookOpen size={18} aria-hidden="true" /> Cas pratiques</span>}
          subtitle="Des situations réelles, pas à pas. Cliquez un cas pour le déplier."
          actions={
            <label className="manual-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" aria-label="Rechercher un cas pratique" placeholder="Rechercher un cas (ex. trop-perçu)" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          }
        >
          <div className="manual-cases">
            {cases.map((item, index) => (
              <details key={item.title} className="manual-case" open={Boolean(needle) && cases.length === 1}>
                <summary>
                  <span className="manual-case-number">{index + 1}</span>
                  <span><strong>{item.title}</strong><small><UserRound size={12} aria-hidden="true" /> {item.who}</small></span>
                </summary>
                <div className="manual-case-body">
                  <p className="manual-case-situation"><b>La situation</b>{item.situation}</p>
                  <h4>Ce qu&apos;il faut faire</h4>
                  <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  <p className="manual-case-result"><CheckCircle2 size={16} aria-hidden="true" /><span><b>Résultat</b>{item.result}</span></p>
                  {openButton(item.open, "Essayer maintenant")}
                </div>
              </details>
            ))}
            {!cases.length && <p className="empty-state">Aucun cas ne correspond à « {query} ».</p>}
          </div>
        </Panel>
      </section>

      <section id="manuel-erreurs" className="manual-anchor">
        <Panel eyebrow="6 · Dépanner" title={<span className="manual-title"><AlertTriangle size={18} aria-hidden="true" /> Erreurs fréquentes et solutions</span>}>
          <div className="manual-mistakes">
            {manual.mistakes.map((item) => (
              <div key={item.problem}><strong>{item.problem}</strong><p>{item.solution}</p></div>
            ))}
          </div>
        </Panel>
      </section>

      {manual.glossary && (
        <section id="manuel-lexique" className="manual-anchor">
          <Panel eyebrow="7 · Comprendre les mots" title="Lexique">
            <dl className="manual-glossary">
              {manual.glossary.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}
            </dl>
          </Panel>
        </section>
      )}
    </div>
  );
}
