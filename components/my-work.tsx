"use client";

import { CheckCircle2, ChevronRight, CloudOff } from "lucide-react";
import { navigateTo } from "@/lib/routes";
import { Work, WorkItem } from "@/lib/work";

const ORDER: Record<WorkItem["tone"], number> = { alert: 0, warn: 1, info: 2 };

// « Mon travail du jour » : tout ce qui attend l'utilisateur, selon son poste,
// avec un clic pour arriver directement sur l'écran où le traiter.
export function MyWorkPanel({ work, hidden = [] }: { work: Work | null; hidden?: string[] }) {
  const items = work?.items ?? null;
  const pending = (items ?? []).filter((entry) => entry.count > 0 && !hidden.includes(entry.key)).sort((first, second) => ORDER[first.tone] - ORDER[second.tone] || second.count - first.count);
  return (
    <section className="my-work" aria-label="Mon travail du jour" aria-busy={!items}>
      <div className="my-work-heading">
        <p className="eyebrow">Mon travail du jour</p>
        {items && <span>{pending.length ? `${pending.reduce((total, entry) => total + entry.count, 0)} élément(s) en attente` : ""}</span>}
      </div>
      {!items && <p className="worklist-empty">Recherche de ce qui vous attend…</p>}
      {work && !pending.length && !work.unchecked && (
        <p className="my-work-done"><CheckCircle2 size={18} aria-hidden="true" /> Rien en attente dans vos rubriques. Tout est à jour.</p>
      )}
      {Boolean(work?.unchecked) && (
        <p className="my-work-unchecked"><CloudOff size={16} aria-hidden="true" /> {work?.unchecked} rubrique(s) n&apos;ont pas pu être vérifiées (connexion ou session). Cliquez « Actualiser » une fois reconnecté.</p>
      )}
      {pending.length > 0 && (
        <div className="my-work-grid">
          {pending.map((entry) => (
            <button type="button" key={entry.key} className={`my-work-item ${entry.tone}`} onClick={() => navigateTo(entry.path)}>
              <strong>{entry.count}</strong>
              <span><b>{entry.label}</b><small>{entry.detail} · {entry.view}</small></span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
