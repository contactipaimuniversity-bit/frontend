"use client";

import { useState } from "react";
import { BriefcaseBusiness, Cpu, Factory, Leaf } from "lucide-react";
import { POLES, PROGRAMS, type Pole } from "@/lib/site-content";

const POLE_ICONS: Record<Pole, typeof Cpu> = {
  Technologique: Cpu,
  Management: BriefcaseBusiness,
  Industriel: Factory,
  "Agricole & environnement": Leaf,
};

function PoleIcon({ pole }: { pole: Pole }) {
  const Glyph = POLE_ICONS[pole];
  return <Glyph size={22} strokeWidth={1.8} aria-hidden="true" />;
}

// Les filières, pôle par pôle.
export function Programs() {
  const [pole, setPole] = useState<Pole | "Tous">("Tous");
  const shown = PROGRAMS.filter((item) => pole === "Tous" || item.pole === pole);
  return (
    <>
      <div className="site-chips" role="tablist" aria-label="Filtrer par pôle">
        {(["Tous", ...POLES] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={pole === item} className={pole === item ? "is-active" : ""} onClick={() => setPole(item)}>
            {item === "Tous" ? "Tous les pôles" : `Pôle ${item.toLowerCase()}`}
          </button>
        ))}
      </div>
      <div className="program-grid">
        {shown.map((item) => (
          <article key={item.name} className="program-card">
            <div className="program-head">
              <span className="site-round-icon"><PoleIcon pole={item.pole} /></span>
              <div>
                <small>Pôle {item.pole.toLowerCase()}</small>
                <h3>{item.name}</h3>
              </div>
            </div>
            <p>{item.summary}</p>
            {item.learn.length ? (
            <div className="program-lists">
              <div>
                <strong>Enseignements</strong>
                <ul>{item.learn.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
              <div>
                <strong>Débouchés</strong>
                <ul>{item.careers.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            </div>
            ) : (
              <a className="site-link-arrow" href="#contact">Se renseigner auprès du service d&apos;information</a>
            )}
            <p className="program-levels">BTS · Licence</p>
          </article>
        ))}
      </div>
    </>
  );
}
