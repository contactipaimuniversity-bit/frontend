"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { API_URL } from "@/lib/connectivity";
import { DEFAULT_SLIDES } from "@/lib/site-content";

type Slide = { id: string; surtitre: string | null; titre: string; texte: string | null; boutonLibelle: string | null; boutonLien: string | null; image: string | null };

const DURATION = 7000;

// Grand carrousel d'ouverture : la photo passe du flou au net, le texte se
// détache au premier plan sur un voile dépoli. Les diapositives viennent de
// l'administration ; à défaut, une présentation aux couleurs de l'université.
export function HeroCarousel() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
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
  const stopped = paused || userPaused || count < 2;

  useEffect(() => {
    if (stopped) return;
    const timer = window.setTimeout(() => go(index + 1), DURATION);
    return () => window.clearTimeout(timer);
  }, [index, stopped, go]);

  return (
    <section
      className="hero"
      aria-roledescription="carrousel"
      aria-label="À la une"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
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
            <div className="hero-veil" />
            <div className="site-container hero-content">
              <div className="hero-glass">
                {slide.surtitre && <p className="hero-kicker">{slide.surtitre}</p>}
                {position === 0 ? <h1>{slide.titre}</h1> : <h2>{slide.titre}</h2>}
                {slide.texte && <p className="hero-text">{slide.texte}</p>}
                {slide.boutonLibelle && slide.boutonLien && (
                  <a className="site-button site-button-gold" href={slide.boutonLien} tabIndex={active ? 0 : -1}>
                    {slide.boutonLibelle} <ArrowRight size={18} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <div className="site-container hero-controls">
          <div className="hero-progress" role="tablist" aria-label="Choisir une diapositive">
            {slides.map((slide, position) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={position === index}
                aria-label={`Diapositive ${position + 1} : ${slide.titre}`}
                className={`hero-bar ${position === index ? "is-active" : ""} ${position < index ? "is-done" : ""} ${stopped ? "is-paused" : ""}`}
                onClick={() => go(position)}
              >
                <span style={position === index ? { animationDuration: `${DURATION}ms` } : undefined} />
              </button>
            ))}
          </div>
          <div className="hero-arrows">
            <button type="button" aria-label={userPaused ? "Reprendre le défilement" : "Mettre en pause"} onClick={() => setUserPaused((value) => !value)}>
              {userPaused ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}
            </button>
            <button type="button" aria-label="Diapositive précédente" onClick={() => go(index - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" aria-label="Diapositive suivante" onClick={() => go(index + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
        </div>
      )}
    </section>
  );
}
