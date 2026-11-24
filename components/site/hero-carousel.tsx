"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { API_URL } from "@/lib/connectivity";
import { DEFAULT_SLIDES } from "@/lib/site-content";

type Slide = { id: string; surtitre: string | null; titre: string; texte: string | null; boutonLibelle: string | null; boutonLien: string | null; image: string | null };

const DURATION = 7000;

function SlideButton({ href, className, active, children }: { href: string; className: string; active: boolean; children: React.ReactNode }) {
  return href.startsWith("/")
    ? <Link className={className} href={href} tabIndex={active ? 0 : -1}>{children}</Link>
    : <a className={className} href={href} tabIndex={active ? 0 : -1}>{children}</a>;
}

// Carrousel d'ouverture : une grande carte arrondie, la photo en plein fond,
// le texte à gauche. D'une diapositive à l'autre, l'image passe du flou au net.
// Les diapositives viennent de l'administration (Site vitrine).
export function HeroCarousel() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/vitrine/diapositives`)
      .then((response) => (response.ok ? response.json() : []))
      .then((list: Slide[]) => {
        if (active && Array.isArray(list) && list.length) {
          setSlides(list.map((item) => ({ ...item, image: item.image ? `${API_URL}${item.image}` : null })));
          setIndex(0);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  // Le défilement continue même sous le pointeur ; seul le bouton pause l'arrête.
  const stopped = userPaused || count < 2;

  useEffect(() => {
    if (stopped) return;
    const timer = window.setTimeout(() => go(index + 1), DURATION);
    return () => window.clearTimeout(timer);
  }, [index, stopped, go]);

  return (
    <section className="site-container hero-wrap" aria-label="À la une">
      <div
        className="hero"
        aria-roledescription="carrousel"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(index + 1);
          if (event.key === "ArrowLeft") go(index - 1);
        }}
        onTouchStart={(event) => { touch.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (touch.current === null) return;
          const delta = event.changedTouches[0].clientX - touch.current;
          if (Math.abs(delta) > 50) go(index + (delta < 0 ? 1 : -1));
          touch.current = null;
        }}
      >
        {slides.map((slide, position) => {
          const active = position === index;
          return (
            <div key={slide.id} className={`hero-slide ${active ? "is-active" : ""}`} aria-hidden={!active} role="group" aria-roledescription="diapositive" aria-label={`${position + 1} sur ${count}`}>
              <div className={`hero-media ${slide.image ? "" : `hero-media-default hero-tone-${position % 3}`}`} style={slide.image ? { backgroundImage: `url("${slide.image}")` } : undefined} />
              <div className="hero-shade" />
              <div className="hero-copy">
                {slide.surtitre && <span className="hero-badge">{slide.surtitre}</span>}
                {position === 0 ? <h1>{slide.titre}</h1> : <h2>{slide.titre}</h2>}
                {slide.texte && <p>{slide.texte}</p>}
                <div className="hero-actions">
                  {slide.boutonLibelle && slide.boutonLien && <SlideButton className="site-btn site-btn-gold" href={slide.boutonLien} active={active}>{slide.boutonLibelle}</SlideButton>}
                  <SlideButton className="site-btn site-btn-light" href={slide.boutonLien === "/enregistrements" ? "#formations" : "/enregistrements"} active={active}>{slide.boutonLien === "/enregistrements" ? "Nos formations" : "Pré-inscription"}</SlideButton>
                </div>
              </div>
            </div>
          );
        })}

        {count > 1 && (
          <div className="hero-controls">
            <span className="hero-count" aria-live="polite">{index + 1} / {count}</span>
            <button type="button" aria-label={userPaused ? "Reprendre le défilement" : "Mettre en pause"} onClick={() => setUserPaused((value) => !value)}>
              {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Diapositive précédente" onClick={() => go(index - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" aria-label="Diapositive suivante" onClick={() => go(index + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
        )}
        {count > 1 && <span key={`${index}-${stopped}`} className={`hero-timer ${stopped ? "is-paused" : ""}`} style={{ animationDuration: `${DURATION}ms` }} aria-hidden="true" />}
      </div>
    </section>
  );
}
