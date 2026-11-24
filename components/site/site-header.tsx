"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Phone, X } from "lucide-react";
import { CONTACT, MENU } from "@/lib/site-content";

const isPage = (href: string) => href.startsWith("/");

function MenuLink({ href, className, onClick, children }: { href: string; className?: string; onClick?: () => void; children: React.ReactNode }) {
  return isPage(href)
    ? <Link href={href} className={className} onClick={onClick}>{children}</Link>
    : <a href={href} className={className} onClick={onClick}>{children}</a>;
}

// En-tête institutionnel : un bandeau d'accès rapides, puis la barre principale
// dont chaque rubrique ouvre un panneau détaillé.
export function SiteHeader() {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileSection, setMobileSection] = useState<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = (index: number) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenMenu(index);
  };
  const closeSoon = () => {
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 160);
  };
  const closeAll = () => {
    setOpenMenu(null);
    setMobile(false);
  };

  return (
    <header className={`site-header ${openMenu !== null ? "has-panel" : ""}`} onMouseLeave={closeSoon}>
      <div className="site-utility">
        <div className="site-container site-utility-bar">
          <a href={CONTACT.phoneHref} className="site-utility-phone"><Phone size={13} aria-hidden="true" /> {CONTACT.phone}</a>
          <nav aria-label="Accès rapides">
            <Link href="/etudiant">Espace étudiant</Link>
            <a href="#actualites">Actualités</a>
            <a href="#equipe">Recrutement</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </div>

      <div className="site-mainbar">
        <div className="site-container site-mainbar-inner">
          <a className="site-brand" href="#haut" onClick={closeAll}>
            <Image src="/etudiant/icon-192.png" alt="" width={46} height={46} priority />
            <span><strong>IPAIM University</strong><small>Institut Polytechnique Africain d&apos;Innovation et de Management</small></span>
          </a>

          <nav className="site-menu" aria-label="Navigation principale">
            {MENU.map((item, index) => (
              <div key={item.label} className="site-menu-item" onMouseEnter={() => open(index)}>
                <button type="button" aria-expanded={openMenu === index} aria-controls={`panneau-${index}`} className={openMenu === index ? "is-open" : ""} onClick={() => (openMenu === index ? setOpenMenu(null) : open(index))} onFocus={() => open(index)}>
                  {item.label} <ChevronDown size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            <a className="site-menu-plain" href="#actualites" onMouseEnter={() => setOpenMenu(null)}>Actualités</a>
            <a className="site-menu-plain" href="#contact" onMouseEnter={() => setOpenMenu(null)}>Contact</a>
          </nav>

          <div className="site-mainbar-actions">
            <Link className="site-btn site-btn-primary" href="/enregistrements">Pré-inscription</Link>
            <button type="button" className="site-burger" aria-label={mobile ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={mobile} onClick={() => setMobile((value) => !value)}>
              {mobile ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {MENU.map((item, index) => (
          <div key={item.label} id={`panneau-${index}`} className={`site-panel ${openMenu === index ? "is-open" : ""}`} onMouseEnter={() => open(index)} hidden={openMenu !== index}>
            <div className="site-container site-panel-inner">
              <div className="site-panel-intro">
                <strong>{item.label}</strong>
                <p>{item.intro}</p>
              </div>
              <ul className="site-panel-links">
                {item.links.map((link) => (
                  <li key={link.label}>
                    <MenuLink href={link.href} onClick={closeAll}><strong>{link.label}</strong><span>{link.text}</span></MenuLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {mobile && (
        <nav className="site-mobile" aria-label="Navigation principale">
          {MENU.map((item, index) => (
            <div key={item.label} className="site-mobile-group">
              <button type="button" aria-expanded={mobileSection === index} onClick={() => setMobileSection(mobileSection === index ? null : index)}>
                {item.label} <ChevronDown size={18} aria-hidden="true" />
              </button>
              {mobileSection === index && (
                <ul>
                  {item.links.map((link) => <li key={link.label}><MenuLink href={link.href} onClick={closeAll}>{link.label}</MenuLink></li>)}
                </ul>
              )}
            </div>
          ))}
          <a className="site-mobile-plain" href="#actualites" onClick={closeAll}>Actualités</a>
          <a className="site-mobile-plain" href="#contact" onClick={closeAll}>Contact</a>
          <Link className="site-btn site-btn-primary" href="/enregistrements" onClick={closeAll}>Pré-inscription en ligne</Link>
        </nav>
      )}
    </header>
  );
}
