"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "ipaim-etudiant-ouverture";
const DURATION_MS = 2900;
const TITLE = "IPAIM Étudiant";

// Animation d'ouverture : une goutte tombe, frappe une flaque qui ondule, puis
// le nom de l'application s'écrit dessous. Jouée une fois par ouverture de
// l'application (pas à chaque changement d'écran) ; un toucher la passe.
export function StudentSplash() {
  const [phase, setPhase] = useState<"pending" | "show" | "done">("pending");

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* stockage indisponible : on joue l'animation */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = window.setTimeout(() => setPhase(seen ? "done" : "show"), 0);
    const end = seen ? undefined : window.setTimeout(() => setPhase("done"), reduced ? 900 : DURATION_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, []);

  if (phase === "done") return null;
  return (
    <div className={`stu-splash-overlay${phase === "show" ? " play" : ""}`} onClick={() => setPhase("done")} aria-hidden="true">
      {phase === "show" && (
        <>
          <div className="stu-splash-stage">
            <span className="stu-splash-ring" />
            <span className="stu-splash-ring stu-splash-ring-2" />
            <span className="stu-splash-puddle" />
            <span className="stu-splash-ball" />
          </div>
          <p className="stu-splash-title">
            {[...TITLE].map((letter, index) => (
              <span key={index} style={{ animationDelay: `${1.05 + index * 0.045}s` }}>{letter === " " ? " " : letter}</span>
            ))}
          </p>
          <p className="stu-splash-credit">Powered by <strong>PEJOSOFT CORPORATION</strong></p>
        </>
      )}
    </div>
  );
}
