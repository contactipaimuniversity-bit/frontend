import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  Check,
  FileText,
  GraduationCap,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { HeroCarousel } from "@/components/site/hero-carousel";
import { Programs } from "@/components/site/programs";
import { SiteHeader } from "@/components/site/site-header";
import {
  ADVANTAGES,
  CAMPUSES,
  COMMUNITY,
  CONTACT,
  DEGREES,
  FAQ,
  FIGURES,
  FILE_PIECES,
  GOVERNANCE,
  NAV,
  NEWS,
  SCHOLARSHIPS,
  STEPS,
  STUDENT_SERVICES,
  TEAM,
  TICKER,
  VALUES,
} from "@/lib/site-content";

const VALUE_ICONS = [Lightbulb, GraduationCap, TrendingUp];
const ADVANTAGE_ICONS = [BadgeCheck, Users, Plane];

function SectionHead({ id, eyebrow, title, accent, text, light }: { id?: string; eyebrow: string; title: string; accent: string; text?: string; light?: boolean }) {
  return (
    <div className={`site-section-head ${light ? "is-light" : ""}`}>
      <p className="site-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title} <span className="site-accent">{accent}</span></h2>
      {text && <p className="site-lead">{text}</p>}
    </div>
  );
}

export default function SitePage() {
  return (
    <div className="site" id="haut">
      <a className="site-skip" href="#contenu">Aller au contenu</a>
      <SiteHeader />
      <HeroCarousel />

      <div className="site-ticker" aria-label="Informations">
        <div className="site-ticker-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="site-ticker-group" aria-hidden={copy === 1}>
              {TICKER.map((item) => <span key={item}>{item}<Sparkles size={14} aria-hidden="true" /></span>)}
            </div>
          ))}
        </div>
      </div>

      <main id="contenu">
        {/* L'université */}
        <section className="site-section" id="universite" aria-labelledby="titre-universite">
          <div className="site-container site-split">
            <div>
              <SectionHead id="titre-universite" eyebrow="L'université" title="Former les talents dont le Congo" accent="a besoin" />
              <p className="site-lead">IPAIM University, l&apos;Institut Polytechnique Africain d&apos;Innovation et de Management, est un établissement privé d&apos;enseignement supérieur implanté à Moukondo, à Brazzaville.</p>
              <p>Nous préparons les bacheliers aux métiers qui recrutent : le numérique, les télécommunications, le management, la logistique, le droit et l&apos;industrie. Notre conviction : une grande carrière peut se construire au pays, à condition d&apos;y être formé de façon concrète et exigeante.</p>
              <div className="site-mission">
                <strong>Notre mission</strong>
                <p>Offrir à la jeunesse congolaise une formation professionnalisante et accessible, grâce à des frais maîtrisés et à un programme de bourses d&apos;études.</p>
              </div>
            </div>
            <div className="value-stack">
              {VALUES.map((value, position) => {
                const Glyph = VALUE_ICONS[position];
                return (
                  <article key={value.title} className="value-card">
                    <span className="site-round-icon"><Glyph size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                    <div>
                      <h3>{value.title}</h3>
                      <p>{value.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="site-container">
            <dl className="figure-band">
              {FIGURES.map((figure) => (
                <div key={figure.label}>
                  <dt>{figure.label}</dt>
                  <dd>{figure.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Formations */}
        <section className="site-section site-section-tint" id="formations" aria-labelledby="titre-formations">
          <div className="site-container">
            <SectionHead id="titre-formations" eyebrow="Formations" title="Quatre pôles," accent="huit domaines" text="Chaque filière associe enseignements fondamentaux et mises en situation, pour une insertion professionnelle rapide." />
            <Programs />
            <div className="degree-row">
              {DEGREES.map((degree) => (
                <article key={degree.name} className="degree-card">
                  <span className="degree-name">{degree.name}</span>
                  <div>
                    <strong>{degree.duration}</strong>
                    <p>{degree.text}</p>
                  </div>
                </article>
              ))}
              <article className="degree-card degree-card-note">
                <CalendarDays size={22} aria-hidden="true" />
                <div>
                  <strong>L&apos;année universitaire</strong>
                  <p>Deux semestres, chacun associant cours, travaux dirigés et évaluations. Résultats et documents sont délivrés par la scolarité.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Admissions */}
        <section className="site-section" id="admissions" aria-labelledby="titre-admissions">
          <div className="site-container">
            <SectionHead id="titre-admissions" eyebrow="Admissions et bourses" title="Rejoindre l'IPAIM" accent="en quatre étapes" text="L'université accueille les titulaires du baccalauréat général, technique ou professionnel." />
            <ol className="step-track">
              {STEPS.map((step, position) => (
                <li key={step.title}>
                  <span className="step-number">{String(position + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="admission-grid">
              <article className="admission-card">
                <span className="site-round-icon"><FileText size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                <h3>Composition du dossier</h3>
                <ul className="check-list">{FILE_PIECES.map((piece) => <li key={piece}><Check size={16} aria-hidden="true" />{piece}</li>)}</ul>
              </article>
              <article className="admission-card admission-card-dark">
                <span className="site-round-icon"><Award size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                <h3>La bourse locale 2026-2027</h3>
                <p>IPAIM University attribue des bourses aux bacheliers qui souhaitent poursuivre leurs études dans de bonnes conditions. Les places sont limitées.</p>
                <dl className="scholarship-list">
                  {SCHOLARSHIPS.map((item) => (
                    <div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>
                  ))}
                </dl>
              </article>
            </div>
            <div className="advantage-row">
              {ADVANTAGES.map((item, position) => {
                const Glyph = ADVANTAGE_ICONS[position];
                return (
                  <article key={item.title} className="advantage-card">
                    <Glyph size={20} aria-hidden="true" />
                    <span className="advantage-value">{item.value}</span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>
            <div className="cta-band">
              <div>
                <h3>Votre place commence par une pré-inscription</h3>
                <p>Gratuite et rapide, elle vous met en relation avec le service d&apos;information.</p>
              </div>
              <div className="cta-actions">
                <Link className="site-button site-button-gold" href="/enregistrements">Je me pré-inscris <ArrowRight size={18} aria-hidden="true" /></Link>
                <a className="site-button site-button-ghost" href={CONTACT.phoneHref}><Phone size={17} aria-hidden="true" /> {CONTACT.phone}</a>
              </div>
            </div>
            <div className="faq">
              <h3>Questions fréquentes</h3>
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Vie étudiante */}
        <section className="site-section site-section-dark" id="vie-etudiante" aria-labelledby="titre-vie">
          <div className="site-container site-split">
            <div>
              <SectionHead id="titre-vie" eyebrow="Vie étudiante" title="Votre université," accent="dans votre poche" light />
              <p className="site-lead">Depuis le 14 novembre 2026, l&apos;application étudiante réunit la carte d&apos;étudiant, le matricule, l&apos;emploi du temps, les notes et les démarches en un seul espace.</p>
              <p>Les accès se retirent au service de la scolarité, qui accompagne aussi chaque étudiant de l&apos;inscription à la délivrance des documents officiels.</p>
              <ul className="service-list">{STUDENT_SERVICES.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
              <Link className="site-button site-button-gold" href="/etudiant"><Smartphone size={18} aria-hidden="true" /> Accéder à l&apos;espace étudiant</Link>
            </div>
            <div className="phone-frame" aria-hidden="true">
              <div className="phone-screen">
                <div className="phone-top"><Image src="/etudiant/icon-192.png" alt="" width={34} height={34} /><span>Mon espace IPAIM</span></div>
                <div className="phone-card">
                  <small>Carte d&apos;étudiant · 2026-2027</small>
                  <strong>IPAIM University</strong>
                  <span>Matricule IP-26-••••</span>
                </div>
                {["Emploi du temps", "Mes notes", "Mes paiements", "Annonces"].map((item) => <div key={item} className="phone-row">{item}<ArrowRight size={14} /></div>)}
              </div>
            </div>
          </div>
          <div className="site-container community-row">
            {COMMUNITY.map((item) => (
              <article key={item.title} className="community-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Actualités */}
        <section className="site-section" id="actualites" aria-labelledby="titre-actualites">
          <div className="site-container">
            <SectionHead id="titre-actualites" eyebrow="Actualités" title="La vie de" accent="l'université" />
            <div className="news-grid">
              {NEWS.map((item) => (
                <article key={item.title} className="news-card">
                  <div className="news-meta"><time>{item.date}</time><span>{item.tag}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Gouvernance et campus */}
        <section className="site-section site-section-tint" aria-labelledby="titre-gouvernance">
          <div className="site-container">
            <SectionHead id="titre-gouvernance" eyebrow="Gouvernance" title="Une équipe engagée," accent="au service de l'excellence" />
            <div className="governance-grid">
              {GOVERNANCE.map((item) => (
                <article key={item.title} className="governance-card">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
            <div className="team-row">
              {TEAM.map((member) => (
                <article key={member.name} className="team-card">
                  <span className="team-initials" aria-hidden="true">{member.initials}</span>
                  <div><strong>{member.name}</strong><small>{member.role}</small></div>
                </article>
              ))}
              <article className="team-card team-card-join">
                <div>
                  <strong>Enseigner à l&apos;IPAIM</strong>
                  <small>Enseignants et personnel administratif : candidatures spontanées ouvertes.</small>
                </div>
                <a className="site-link-arrow" href={`mailto:${CONTACT.email}?subject=Candidature`}>Postuler <ArrowRight size={16} aria-hidden="true" /></a>
              </article>
            </div>
            <div className="campus-row">
              {CAMPUSES.map((campus) => (
                <article key={campus.city} className="campus-card">
                  <span className={`campus-status ${campus.status === "Campus ouvert" ? "is-open" : ""}`}>{campus.status}</span>
                  <h3>{campus.city}</h3>
                  <p>{campus.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="site-section" id="contact" aria-labelledby="titre-contact">
          <div className="site-container contact-layout">
            <div>
              <SectionHead id="titre-contact" eyebrow="Contact" title="Parlons de" accent="votre avenir" text="Une question sur une filière, une bourse ou une démarche ? Le service d'information vous répond." />
              <div className="contact-actions">
                <a className="site-button site-button-gold" href={CONTACT.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> Écrire sur WhatsApp</a>
                <a className="site-button site-button-outline" href={CONTACT.maps} target="_blank" rel="noreferrer"><MapPin size={18} aria-hidden="true" /> Itinéraire vers le campus</a>
              </div>
            </div>
            <ul className="contact-list">
              <li><span className="site-round-icon"><Phone size={20} aria-hidden="true" /></span><div><small>Service d&apos;information</small><a href={CONTACT.phoneHref}>{CONTACT.phone}</a><a href={CONTACT.phone2Href}>{CONTACT.phone2}</a></div></li>
              <li><span className="site-round-icon"><Mail size={20} aria-hidden="true" /></span><div><small>Courriel</small><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></div></li>
              <li><span className="site-round-icon"><MapPin size={20} aria-hidden="true" /></span><div><small>Adresse</small><span>{CONTACT.address}, République du Congo</span></div></li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-container site-footer-grid">
          <div className="site-footer-brand">
            <span className="site-brand-logo"><Image src="/etudiant/icon-192.png" alt="" width={52} height={52} /></span>
            <p><strong>IPAIM University</strong>Institut Polytechnique Africain d&apos;Innovation et de Management, établissement privé d&apos;enseignement supérieur à Brazzaville.</p>
          </div>
          <nav aria-label="Plan du site">
            <strong>Le site</strong>
            {NAV.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
          </nav>
          <div>
            <strong>Accès rapides</strong>
            <Link href="/enregistrements">Pré-inscription en ligne</Link>
            <Link href="/etudiant">Espace étudiant</Link>
            <a href={`mailto:${CONTACT.email}?subject=Candidature`}>Recrutement</a>
          </div>
          <div>
            <strong>Nous joindre</strong>
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <span>Moukondo, Brazzaville</span>
          </div>
        </div>
        <div className="site-container site-footer-bottom">
          <span>© {new Date().getFullYear()} IPAIM University. Tous droits réservés.</span>
          <span>Innover · Former · Transformer</span>
        </div>
      </footer>
    </div>
  );
}
