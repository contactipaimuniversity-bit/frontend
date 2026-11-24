"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV } from "@/lib/site-content";

// En-tête flottant : transparent sur le carrousel, puis plein au défilement.
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className={`site-header ${scrolled || open ? "is-solid" : ""} ${open ? "is-open" : ""}`}>
      <div className="site-container site-header-bar">
        <a className="site-brand" href="#haut" onClick={() => setOpen(false)}>
          <span className="site-brand-logo"><Image src="/etudiant/icon-192.png" alt="" width={44} height={44} priority /></span>
          <span className="site-brand-text"><strong>IPAIM University</strong><small>Innover · Former · Transformer</small></span>
        </a>
        <nav className="site-nav" aria-label="Navigation du site">
          {NAV.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
        </nav>
        <div className="site-header-actions">
          <Link className="site-link-quiet" href="/etudiant">Espace étudiant</Link>
          <Link className="site-button site-button-gold site-button-small" href="/enregistrements">Pré-inscription</Link>
          <button type="button" className="site-burger" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="site-mobile-nav" aria-label="Navigation du site">
          {NAV.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
          <Link href="/etudiant" onClick={() => setOpen(false)}>Espace étudiant</Link>
          <Link className="site-button site-button-gold" href="/enregistrements">Pré-inscription en ligne</Link>
        </nav>
      )}
    </header>
  );
}
