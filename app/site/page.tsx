import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  Headphones,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Smartphone,
  TrendingUp,
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
  NEWS,
  SCHOLARSHIPS,
  STEPS,
  STUDENT_SERVICES,
  TEAM,
  VALUES,
} from "@/lib/site-content";

const VALUE_ICONS = [Lightbulb, GraduationCap, TrendingUp];

function Heading({ id, title, text }: { id: string; title: string; text?: string }) {
  return (
    <div className="sec-head">
      <h2 id={id}>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export default function SitePage() {
  return (
    <div className="site" id="haut">
      <a className="site-skip" href="#contenu">Aller au contenu</a>
      <SiteHeader />

      <div className="site-advice">
        <Phone size={14} aria-hidden="true" /> Besoin d&apos;un conseil pour choisir votre filière ? Appelez le <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
      </div>

      <HeroCarousel />

      <main id="contenu">
        {/* L'université */}
        <section className="sec" aria-labelledby="t-universite" id="universite">
          <div className="site-container">
            <Heading id="t-universite" title="Former les talents dont le Congo a besoin." text="Un établissement privé d'enseignement supérieur implanté à Moukondo, à Brazzaville." />
            <div className="intro-grid">
              <div className="intro-text">
                <p>IPAIM University, l&apos;Institut Polytechnique Africain d&apos;Innovation et de Management, prépare les bacheliers aux métiers qui recrutent : le numérique, les télécommunications, le management, la logistique, le droit et l&apos;industrie.</p>
                <p>Notre conviction : une grande carrière peut se construire au pays, à condition d&apos;y être formé de façon concrète et exigeante. Notre mission est d&apos;offrir à la jeunesse congolaise une formation professionnalisante et accessible, grâce à des frais maîtrisés et à un programme de bourses d&apos;études.</p>
                <a className="text-link" href="#gouvernance">Découvrir la gouvernance <ChevronRight size={16} aria-hidden="true" /></a>
              </div>
              <dl className="figures">
                {FIGURES.map((figure) => (
                  <div key={figure.label}><dd>{figure.value}</dd><dt>{figure.label}</dt></div>
                ))}
              </dl>
            </div>
            <div className="tiles tiles-3">
              {VALUES.map((value, position) => {
                const Glyph = VALUE_ICONS[position];
                return (
                  <article key={value.title} className="tile">
                    <Glyph size={26} strokeWidth={1.6} aria-hidden="true" className="tile-icon" />
                    <h3>{value.title}</h3>
                    <p>{value.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Formations */}
        <section className="sec sec-soft" aria-labelledby="t-formations" id="formations">
          <div className="site-container">
            <Heading id="t-formations" title="Nos formations à la une." text="Quatre pôles, huit domaines d'études. Chaque filière associe enseignements fondamentaux et mises en situation professionnelle." />
            <Programs />
            <div className="degrees" id="diplomes">
              {DEGREES.map((degree) => (
                <article key={degree.name} className="degree">
                  <span>{degree.name}</span>
                  <div><strong>{degree.duration}</strong><p>{degree.text}</p></div>
                </article>
              ))}
              <article className="degree degree-note">
                <CalendarDays size={24} strokeWidth={1.6} aria-hidden="true" />
                <div><strong>L&apos;année universitaire</strong><p>Deux semestres associant cours, travaux dirigés et évaluations. Résultats et documents sont délivrés par la scolarité.</p></div>
              </article>
            </div>
          </div>
        </section>

        {/* Admissions */}
        <section className="sec" aria-labelledby="t-admissions" id="admissions">
          <div className="site-container">
            <Heading id="t-admissions" title="Rejoindre l'IPAIM en quatre étapes." text="L'université accueille les titulaires du baccalauréat général, technique ou professionnel." />
            <ol className="adm-steps">
              {STEPS.map((step, position) => (
                <li key={step.title}>
                  <span className="step-index">{position + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>

            <div className="split-cards" id="bourses">
              <article className="panel-card">
                <FileText size={26} strokeWidth={1.6} aria-hidden="true" className="tile-icon" />
                <h3>Composition du dossier</h3>
                <ul className="ticks">{FILE_PIECES.map((piece) => <li key={piece}><Check size={16} aria-hidden="true" />{piece}</li>)}</ul>
              </article>
              <article className="panel-card panel-card-brand">
                <Award size={26} strokeWidth={1.6} aria-hidden="true" className="tile-icon" />
                <h3>La bourse locale 2026-2027</h3>
                <p>IPAIM University attribue des bourses aux bacheliers qui souhaitent poursuivre leurs études dans de bonnes conditions. Les places sont limitées.</p>
                <dl className="grants">
                  {SCHOLARSHIPS.map((item) => <div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>)}
                </dl>
              </article>
            </div>

            <div className="tiles tiles-3 offers">
              {ADVANTAGES.map((item) => (
                <article key={item.title} className="tile offer">
                  <span className="offer-value">{item.value.trim()}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>

            <div className="cta">
              <div>
                <h3>Votre place commence par une pré-inscription.</h3>
                <p>Gratuite et rapide, elle vous met en relation avec le service d&apos;information.</p>
              </div>
              <div className="cta-actions">
                <Link className="site-btn site-btn-gold" href="/enregistrements">Je me pré-inscris</Link>
                <a className="site-btn site-btn-light" href={CONTACT.phoneHref}>Appeler le service d&apos;information</a>
              </div>
            </div>

            <div className="faq" id="faq">
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
        <section className="sec sec-soft" aria-labelledby="t-vie" id="vie-etudiante">
          <div className="site-container app-block">
            <div>
              <Heading id="t-vie" title="Votre université, dans votre poche." text="Depuis le 14 novembre 2026, l'application étudiante réunit la carte d'étudiant, le matricule, l'emploi du temps, les notes et les démarches." />
              <ul className="ticks ticks-2">{STUDENT_SERVICES.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
              <p className="muted">Les accès se retirent au service de la scolarité.</p>
              <Link className="site-btn site-btn-primary" href="/etudiant"><Smartphone size={17} aria-hidden="true" /> Accéder à l&apos;espace étudiant</Link>
            </div>
            <div className="phone" aria-hidden="true">
              <div className="phone-screen">
                <div className="phone-top"><Image src="/etudiant/icon-192.png" alt="" width={30} height={30} /><span>Mon espace IPAIM</span></div>
                <div className="phone-card"><small>Carte d&apos;étudiant · 2026-2027</small><strong>IPAIM University</strong><span>Matricule IP-26-••••</span></div>
                {["Emploi du temps", "Mes notes", "Mes paiements", "Annonces"].map((item) => <div key={item} className="phone-row">{item}<ChevronRight size={14} /></div>)}
              </div>
            </div>
          </div>
          <div className="site-container tiles tiles-3 community">
            {COMMUNITY.map((item) => (
              <article key={item.title} className="tile">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Actualités */}
        <section className="sec" aria-labelledby="t-actualites" id="actualites">
          <div className="site-container">
            <Heading id="t-actualites" title="Actualités." text="Rentrée, bourses, nouveaux services et vie du campus." />
            <div className="news">
              {NEWS.map((item, position) => (
                <article key={item.title} className={`news-item ${position === 0 ? "news-lead" : ""}`}>
                  <div className="news-meta"><span>{item.tag}</span><time>{item.date}</time></div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Gouvernance et campus */}
        <section className="sec sec-soft" aria-labelledby="t-gouvernance" id="gouvernance">
          <div className="site-container">
            <Heading id="t-gouvernance" title="Gouvernance et équipe." text="La direction générale fixe les orientations ; deux responsables pilotent au quotidien la qualité de la formation et le fonctionnement de l'établissement." />
            <div className="tiles tiles-4">
              {GOVERNANCE.map((item) => (
                <article key={item.title} className="tile tile-line">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
            <div className="people">
              {TEAM.map((member) => (
                <article key={member.name} className="person">
                  <span aria-hidden="true">{member.initials}</span>
                  <div><strong>{member.name}</strong><small>{member.role}</small></div>
                </article>
              ))}
              <article className="person person-join">
                <div><strong>Enseigner à l&apos;IPAIM</strong><small>Enseignants et personnel administratif : candidatures spontanées ouvertes.</small></div>
                <a className="text-link" href={`mailto:${CONTACT.email}?subject=Candidature`}>Postuler <ChevronRight size={16} aria-hidden="true" /></a>
              </article>
            </div>
            <div className="campuses" id="campus">
              {CAMPUSES.map((campus) => (
                <article key={campus.city} className="campus">
                  <span className={`campus-state ${campus.status === "Campus ouvert" ? "is-open" : ""}`}>{campus.status}</span>
                  <h3>{campus.city}</h3>
                  <p>{campus.text}</p>
                  {campus.status === "Campus ouvert" && <a className="text-link text-link-light" href={CONTACT.maps} target="_blank" rel="noreferrer">Itinéraire <ArrowRight size={16} aria-hidden="true" /></a>}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="sec" aria-labelledby="t-contact" id="contact">
          <div className="site-container contact">
            <div>
              <Heading id="t-contact" title="Parlons de votre avenir." text="Une question sur une filière, une bourse ou une démarche ? Le service d'information vous répond." />
              <div className="cta-actions">
                <a className="site-btn site-btn-primary" href={CONTACT.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} aria-hidden="true" /> Écrire sur WhatsApp</a>
                <a className="site-btn site-btn-outline" href={CONTACT.maps} target="_blank" rel="noreferrer"><MapPin size={17} aria-hidden="true" /> Itinéraire vers le campus</a>
              </div>
            </div>
            <ul className="contact-list">
              <li><Phone size={20} strokeWidth={1.7} aria-hidden="true" /><div><small>Service d&apos;information</small><a href={CONTACT.phoneHref}>{CONTACT.phone}</a><a href={CONTACT.phone2Href}>{CONTACT.phone2}</a></div></li>
              <li><Mail size={20} strokeWidth={1.7} aria-hidden="true" /><div><small>Courriel</small><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></div></li>
              <li><MapPin size={20} strokeWidth={1.7} aria-hidden="true" /><div><small>Adresse</small><span>{CONTACT.address}, République du Congo</span></div></li>
            </ul>
          </div>
        </section>

        {/* Réassurance */}
        <section className="assure" aria-label="Nous joindre">
          <div className="site-container assure-grid">
            <div>
              <Headphones size={30} strokeWidth={1.5} aria-hidden="true" />
              <strong>Un conseiller à votre écoute</strong>
              <p>Le service d&apos;information vous aide à choisir votre filière selon votre bac et votre projet.</p>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            </div>
            <div>
              <MapPin size={30} strokeWidth={1.5} aria-hidden="true" />
              <strong>Visitez le campus</strong>
              <p>Accueil sur place à Moukondo, en face de la station Total de Mazala (Western Union).</p>
              <a href={CONTACT.maps} target="_blank" rel="noreferrer">Voir l&apos;itinéraire</a>
            </div>
            <div>
              <FileText size={30} strokeWidth={1.5} aria-hidden="true" />
              <strong>Pré-inscription en ligne</strong>
              <p>Gratuite, elle réserve votre place et lance votre parcours d&apos;admission.</p>
              <Link href="/enregistrements">Se pré-inscrire</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="site-container">
          <div className="foot-cols">
            <nav aria-label="L'université">
              <strong>L&apos;université</strong>
              <a href="#universite">Présentation</a>
              <a href="#gouvernance">Gouvernance</a>
              <a href="#campus">Nos campus</a>
              <a href="#actualites">Actualités</a>
            </nav>
            <nav aria-label="Étudier">
              <strong>Étudier</strong>
              <a href="#formations">Offre de formation</a>
              <a href="#diplomes">BTS et Licence</a>
              <a href="#admissions">Admissions</a>
              <a href="#bourses">Bourses d&apos;études</a>
            </nav>
            <nav aria-label="Étudiants">
              <strong>Étudiants</strong>
              <Link href="/etudiant">Espace étudiant</Link>
              <a href="#vie-etudiante">Application étudiante</a>
              <a href="#vie-etudiante">Scolarité</a>
              <a href="#faq">Questions fréquentes</a>
            </nav>
            <nav aria-label="Contact">
              <strong>Contact</strong>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
              <a href={CONTACT.phone2Href}>{CONTACT.phone2}</a>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href={`mailto:${CONTACT.email}?subject=Candidature`} className="foot-highlight">L&apos;IPAIM recrute</a>
            </nav>
          </div>
          <div className="foot-band">
            <div className="foot-brand">
              <Image src="/etudiant/icon-192.png" alt="" width={44} height={44} />
              <span><strong>IPAIM University</strong><small>Innover · Former · Transformer</small></span>
            </div>
            <div className="foot-social">
              <span>Nous joindre</span>
              <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} aria-hidden="true" /></a>
              <a href={CONTACT.phoneHref} aria-label="Téléphone"><Phone size={17} aria-hidden="true" /></a>
              <a href={`mailto:${CONTACT.email}`} aria-label="Courriel"><Mail size={17} aria-hidden="true" /></a>
              <a href={CONTACT.maps} target="_blank" rel="noreferrer" aria-label="Itinéraire"><MapPin size={17} aria-hidden="true" /></a>
            </div>
          </div>
          <div className="foot-legal">
            <nav aria-label="Informations">
              <a href="#contact">Contact</a>
              <a href="#faq">Questions fréquentes</a>
              <Link href="/enregistrements">Pré-inscription</Link>
              <Link href="/">Espace de gestion</Link>
            </nav>
            <span>© {new Date().getFullYear()} IPAIM University · Moukondo, Brazzaville, République du Congo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
