"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import { GroupIcon, NavIcon, visibleNavGroups } from "@/components/dashboard-layout";
import { MANUALS } from "@/lib/manuals";
import { ManualSection } from "@/lib/routes";
import { User, ViewName } from "@/lib/types";

// L'espace d'une section : au lieu de dérouler ses écrans dans le menu, on les
// présente en cartes, chacune avec son rôle et ce qui attend une action.
export function SpacePage({ section, user, badges, onOpen }: { section: ManualSection; user: User | null; badges: Partial<Record<ViewName, number>>; onOpen: (view: ViewName) => void }) {
  const group = visibleNavGroups(user).find((item) => item.section === section);
  const manual = MANUALS[section];
  const role = (views: ViewName[]) => manual.screens.find((screen) => views.includes(screen.view))?.role ?? "";
  if (!group) return <section className="space-page"><p className="empty-state">Vous n&apos;avez accès à aucun écran de cette section.</p></section>;
  const total = group.items.reduce((sum, item) => sum + item.views.reduce((count, view) => count + (badges[view] ?? 0), 0), 0);
  return (
    <section className="space-page">
      <header className="space-head">
        <span className="space-head-icon"><GroupIcon label={group.label} size={26} /></span>
        <div>
          <h2>{group.label}</h2>
          {/* La première phrase du manuel : la suite parle du manuel lui-même. */}
          <p>{manual.summary.split(/(?<=\.)\s+(?=Ce manuel)/)[0]}</p>
        </div>
        {total > 0 && <span className="space-head-count">{total} à traiter</span>}
      </header>

      {manual.flow && (
        <div className="space-flow" aria-label={manual.flow.title}>
          <span className="space-flow-label">{manual.flow.title} :</span>
          {manual.flow.steps.map((step, index) => (
            <span key={step} className="space-flow-step">
              {index > 0 && <ChevronRight size={15} aria-hidden="true" focusable="false" />}
              <span>{step}</span>
            </span>
          ))}
        </div>
      )}

      <div className="space-cards">
        {group.items.map((item) => {
          const count = item.views.reduce((sum, view) => sum + (badges[view] ?? 0), 0);
          const title = item.views.length > 1 ? item.title ?? item.label : item.label;
          return (
            <button key={item.icon + item.label} type="button" className="space-card" onClick={() => onOpen(item.label)}>
              <span className="space-card-top">
                <span className="space-card-icon"><NavIcon name={item.icon} size={21} /></span>
                <strong>{title}</strong>
                {count > 0 && <span className="space-card-badge" aria-label={`${count} à traiter`}>{count > 99 ? "99+" : count}</span>}
              </span>
              <span className="space-card-text">{role(item.views)}</span>
              <span className="space-card-foot">
                <span className={`space-card-chip ${count ? "todo" : ""}`}>{count ? `${count} à traiter` : "Rien en attente"}</span>
                <span className="space-card-open">Ouvrir <ArrowRight size={16} aria-hidden="true" focusable="false" /></span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
