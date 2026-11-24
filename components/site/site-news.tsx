"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { API_URL } from "@/lib/connectivity";

type News = { id: string; categorie: string; titre: string; resume: string; contenu: string | null; datePublication: string; lienLibelle: string | null; lien: string | null; aLaUne: boolean; image: string | null };

const day = (value: string) => new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const FIRST = 7;

function NewsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return href.startsWith("/") ? <Link className="site-btn site-btn-primary" href={href}>{children}</Link> : <a className="site-btn site-btn-primary" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{children}</a>;
}

// Les actualités publiées depuis l'administration : la première, à la une, en
// grand ; chacune s'ouvre pour être lue en entier.
export function SiteNews() {
  const [items, setItems] = useState<News[] | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<News | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/vitrine/actualites`)
      .then((response) => (response.ok ? response.json() : []))
      .then((list: News[]) => active && setItems(Array.isArray(list) ? list.map((item) => ({ ...item, image: item.image ? `${API_URL}${item.image}` : null })) : []))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (items === null) return <div className="news-loading" aria-hidden="true" />;
  if (!items.length) return <p className="muted">Les prochaines actualités de l&apos;université seront publiées ici.</p>;
  const shown = all ? items : items.slice(0, FIRST);
  const [lead, ...rest] = shown;

  return (
    <>
      <div className="news-layout">
        <button type="button" className="news-feature" onClick={() => setOpen(lead)}>
          <span className={`news-visual ${lead.image ? "" : "is-empty"}`} style={lead.image ? { backgroundImage: `url("${lead.image}")` } : undefined} />
          <span className="news-feature-body">
            <span className="news-meta"><span>{lead.categorie}</span><time>{day(lead.datePublication)}</time></span>
            <strong>{lead.titre}</strong>
            <span className="news-resume">{lead.resume}</span>
            <span className="news-more">Lire l&apos;article <ArrowRight size={16} aria-hidden="true" /></span>
          </span>
        </button>
        <div className="news-list">
          {rest.map((item) => (
            <button key={item.id} type="button" className="news-row" onClick={() => setOpen(item)}>
              <span className={`news-thumb ${item.image ? "" : "is-empty"}`} style={item.image ? { backgroundImage: `url("${item.image}")` } : undefined} />
              <span className="news-row-body">
                <span className="news-meta"><span>{item.categorie}</span><time>{day(item.datePublication)}</time></span>
                <strong>{item.titre}</strong>
              </span>
            </button>
          ))}
        </div>
      </div>
      {items.length > FIRST && (
        <div className="news-toggle">
          <button type="button" className="site-btn site-btn-outline" onClick={() => setAll((value) => !value)}>
            {all ? "Afficher moins" : `Voir toutes les actualités (${items.length})`}
          </button>
        </div>
      )}

      {open && (
        <div className="news-dialog-backdrop" onMouseDown={() => setOpen(null)}>
          <article className="news-dialog" role="dialog" aria-modal="true" aria-labelledby="news-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="news-dialog-close" aria-label="Fermer" onClick={() => setOpen(null)}><X size={20} aria-hidden="true" /></button>
            {open.image && <span className="news-dialog-visual" style={{ backgroundImage: `url("${open.image}")` }} />}
            <div className="news-dialog-body">
              <span className="news-meta"><span>{open.categorie}</span><time>{day(open.datePublication)}</time></span>
              <h3 id="news-dialog-title">{open.titre}</h3>
              <p className="news-dialog-lead">{open.resume}</p>
              {open.contenu && open.contenu.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {open.lien && open.lienLibelle && <NewsLink href={open.lien}>{open.lienLibelle} <ArrowRight size={16} aria-hidden="true" /></NewsLink>}
            </div>
          </article>
        </div>
      )}
    </>
  );
}
