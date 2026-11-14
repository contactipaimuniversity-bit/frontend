"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, CloudOff } from "lucide-react";
import type { StudentResource } from "@/lib/student-api";

export function ScreenHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: string; action?: ReactNode }) {
  return (
    <header className="stu-screen-head">
      {back && (
        <Link href={back} className="stu-icon-button" aria-label="Retour">
          <ChevronLeft size={20} aria-hidden="true" />
        </Link>
      )}
      <div className="stu-screen-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="stu-section">
      <div className="stu-section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="stu-empty">
      {icon && <span className="stu-empty-icon">{icon}</span>}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stu-skeleton" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

/** Affiche une donnée chargée : squelette, erreur avec « Réessayer », ou le contenu. */
export function Loaded<T>({ resource, lines, children }: { resource: StudentResource<T>; lines?: number; children: (data: T) => ReactNode }) {
  if (resource.data) {
    return (
      <>
        {resource.staleSince && <StaleNote since={resource.staleSince} onRetry={resource.reload} />}
        {children(resource.data)}
      </>
    );
  }
  if (resource.loading) return <Skeleton lines={lines} />;
  return (
    <div className="stu-error">
      <p>{resource.error || "Données indisponibles."}</p>
      <button type="button" className="stu-button stu-button-ghost" onClick={resource.reload}>
        Réessayer
      </button>
    </div>
  );
}

export function StaleNote({ since, onRetry }: { since: number; onRetry: () => void }) {
  const when = new Date(since).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <button type="button" className="stu-stale" onClick={onRetry}>
      <CloudOff size={15} aria-hidden="true" />
      <span>Hors ligne · données du {when}. Toucher pour actualiser.</span>
    </button>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "info" | "muted"; children: ReactNode }) {
  return <span className={`stu-pill stu-pill-${tone}`}>{children}</span>;
}

export function Avatar({ photo, name, size = 44 }: { photo: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="stu-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- photo en data URL, gardée hors ligne */}
      {photo ? <img src={photo} alt="" /> : initials || "?"}
    </span>
  );
}
