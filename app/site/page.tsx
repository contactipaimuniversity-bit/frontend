import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  Headphones,
  HeartHandshake,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  Wallet,
} from "lucide-react";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/site/brand-icons";
import { HeroCarousel } from "@/components/site/hero-carousel";
import { Programs } from "@/components/site/programs";
import { SiteFaq } from "@/components/site/site-faq";
import { SiteHeader } from "@/components/site/site-header";
import { SiteNews } from "@/components/site/site-news";
import {
  ADMISSION_STEPS,
  CAMPUSES,
  COMMUNITY,
  CONTACT,
  DIGITAL_SERVICES,
  FIGURES,
  FILE_PIECES,
  FUNDING,
  LEADERSHIP,
  PATHWAY,
  STRENGTHS,
  TEAM,
} from "@/lib/site-content";

const STRENGTH_ICONS = [BadgeCheck, Wallet, GraduationCap, HeartHandshake];

function Heading({ id, kicker, title, text }: { id: string; kicker: string; title: string; text?: string }) {
  return (
    <div className="sec-head">
      <p className="sec-kicker">{kicker}</p>
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
        <Phone size={14} aria-hidden="true" /> Vous hésitez entre plusieurs filières ? Nos conseillers vous orientent au <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
      </div>

      <HeroCarousel />

      <main id="contenu">
        {/* Pourquoi l'IPAIM */}
        <section className="sec" aria-labelledby="t-atouts" id="atouts">
          <div className="site-container">
            <Heading id="t-atouts" kicker="Pourquoi l'IPAIM" title="Un enseignement supérieur exigeant, pensé pour l'emploi." text="Implanté à Brazzaville, l'Institut Polytechnique Africain d'Innovation et de Management forme des techniciens et des cadres opérationnels, prêts à intégrer les entreprises congolaises." />
            <div className="strengths">
              {STRENGTHS.map((item, position) => {
                const Glyph = STRENGTH_ICONS[position];
                return (
                  <article key={item.title} className="strength">
                    <span className="strength-icon"><Glyph size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>
            <dl className="figures-band">
              {FIGURES.map((figure) => (
                <div key={figure.label}><dd>{figure.value}</dd><dt>{figure.label}</dt></div>
              ))}
            </dl>
          </div>
        </section>

        {/* Formations */}
        <section className="sec sec-soft" aria-labelledby="t-formations" id="formations">
          <div className="site-container">
            <Heading id="t-formations" kicker="Formations" title="Trouvez la filière qui vous ressemble." text="Huit programmes, regroupés en quatre pôles, accessibles en BTS comme en Licence." />
            <Programs />
          </div>
        </section>

        {/* Parcours d'études */}
        <section className="sec" aria-labelledby="t-parcours" id="parcours">
          <div className="site-container pathway-block">
            <Heading id="t-parcours" kicker="Parcours d'études" title="Du baccalauréat à la vie active." text="Une progression lisible, organisée en semestres associant cours, travaux dirigés et évaluations." />
            <ol className="pathway">
              {PATHWAY.map((item, position) => (
                <li key={item.step}>
                  <span className="pathway-dot" aria-hidden="true">{position + 1}</span>
                  <strong>{item.step}</strong>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Financer ses études */}
        <section className="sec sec-brand" aria-labelledby="t-financement" id="financement">
          <div className="site-container">
            <Heading id="t-financement" kicker="Financer ses études" title="Des aides concrètes pour alléger le coût de la formation." />
            <div className="funding">
              {FUNDING.map((item) => (
                <article key={item.title} className="funding-card">
                  <span className="funding-value">{item.value}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
            <p className="sec-note">Le montant de chaque formule de bourse est présenté lors de l&apos;entretien. Les places sont limitées.</p>
          </div>
        </section>

        {/* Intégrer l'IPAIM */}
        <section className="sec" aria-labelledby="t-admission" id="admission">
          <div className="site-container admission">
            <div>
              <Heading id="t-admission" kicker="Intégrer l'IPAIM" title="Quatre démarches pour rejoindre la prochaine promotion." />
              <ol className="admission-steps">
                {ADMISSION_STEPS.map((step, position) => (
                  <li key={step.title}>
                    <span>{String(position + 1).padStart(2, "0")}</span>
                    <div><strong>{step.title}</strong><p>{step.text}</p></div>
                  </li>
                ))}
              </ol>
              <div className="cta-actions">
                <Link className="site-btn site-btn-primary" href="/enregistrements">Commencer ma pré-inscription</Link>
                <a className="site-btn site-btn-outline" href={CONTACT.phoneHref}>Parler à un conseiller</a>
              </div>
            </div>
            <aside className="dossier">
              <FileText size={26} strokeWidth={1.6} aria-hidden="true" />
              <h3>Votre dossier de candidature</h3>
              <ul className="ticks">{FILE_PIECES.map((piece) => <li key={piece}><Check size={16} aria-hidden="true" />{piece}</li>)}</ul>
            </aside>
          </div>
        </section>

        {/* Actualités */}
        <section className="sec sec-soft" aria-labelledby="t-actualites" id="actualites">
          <div className="site-container">
            <Heading id="t-actualites" kicker="Actualités" title="La vie de l'université." />
            <SiteNews />
          </div>
        </section>

        {/* Vivre l'IPAIM */}
        <section className="sec" aria-labelledby="t-vivre" id="vivre">
          <div className="site-container app-block">
            <div>
              <Heading id="t-vivre" kicker="Vivre l'IPAIM" title="Votre scolarité, accessible partout." text="L'application étudiante IPAIM réunit vos informations et vos démarches. Vos codes d'accès sont remis par le service de la scolarité." />
              <ul className="ticks ticks-2">{DIGITAL_SERVICES.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
              <Link className="site-btn site-btn-primary" href="/etudiant"><Smartphone size={17} aria-hidden="true" /> Ouvrir l&apos;espace étudiant</Link>
            </div>
            <div className="phone">
              <div className="phone-screen phone-screen-shot">
                <Image src="/site/application-etudiante.jpeg" alt="Accueil de l'application étudiante IPAIM : classe, absences, montant à payer, accès à l'emploi du temps, aux notes et aux paiements, et prochain cours." width={540} height={1200} sizes="(max-width: 760px) 80vw, 280px" />
              </div>
            </div>
          </div>
          <div className="site-container community">
            {COMMUNITY.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* L'institution */}
        <section className="sec sec-soft" aria-labelledby="t-institution" id="institution">
          <div className="site-container">
            <Heading id="t-institution" kicker="L'institution" title="Une direction resserrée, au service des étudiants." text="L'IPAIM a pour mission d'offrir à la jeunesse congolaise une formation professionnalisante et accessible." />
            <div className="org">
              {LEADERSHIP.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
            <div className="people" id="equipe">
              {TEAM.map((member) => (
                <article key={member.name} className="person">
                  <span aria-hidden="true">{member.initials}</span>
                  <div><strong>{member.name}</strong><small>{member.role}</small></div>
                </article>
              ))}
              <article className="person person-join">
                <div><strong>Enseigner ou travailler à l&apos;IPAIM</strong><small>Les candidatures spontanées sont étudiées toute l&apos;année.</small></div>
                <a className="text-link" href={`mailto:${CONTACT.email}?subject=Candidature`}>Envoyer ma candidature <ChevronRight size={16} aria-hidden="true" /></a>
              </article>
            </div>
            <div className="campuses" id="campus">
              {CAMPUSES.map((campus) => (
                <article key={campus.city} className="campus">
                  <span className={`campus-state ${campus.status === "Ouvert" ? "is-open" : ""}`}>{campus.status}</span>
                  <h3>{campus.city}</h3>
                  <p>{campus.text}</p>
                  {campus.status === "Ouvert" && <a className="text-link text-link-light" href={CONTACT.maps} target="_blank" rel="noreferrer">Voir sur la carte <ArrowRight size={16} aria-hidden="true" /></a>}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Questions fréquentes */}
        <section className="sec" aria-labelledby="t-questions" id="questions">
          <div className="site-container faq-block">
            <Heading id="t-questions" kicker="Questions fréquentes" title="Vous vous posez des questions ?" text="Les réponses aux interrogations les plus courantes des candidats et de leurs familles." />
            <SiteFaq />
          </div>
        </section>

        {/* Contact */}
        <section className="sec sec-soft" aria-labelledby="t-contact" id="contact">
          <div className="site-container contact">
            <div>
              <Heading id="t-contact" kicker="Contact" title="Échangeons sur votre projet." text="Par téléphone, par écrit ou directement à l'accueil du campus : nous répondons à toutes vos questions." />
              <div className="cta-actions">
                <a className="site-btn site-btn-primary" href={CONTACT.whatsapp} target="_blank" rel="noreferrer"><WhatsAppIcon size={17} /> Nous écrire sur WhatsApp</a>
                <a className="site-btn site-btn-outline" href={CONTACT.maps} target="_blank" rel="noreferrer"><MapPin size={17} aria-hidden="true" /> Venir au campus</a>
              </div>
            </div>
            <ul className="contact-list">
              <li><Phone size={20} strokeWidth={1.7} aria-hidden="true" /><div><small>Téléphone</small><a href={CONTACT.phoneHref}>{CONTACT.phone}</a><a href={CONTACT.phone2Href}>{CONTACT.phone2}</a></div></li>
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
              <strong>Un conseiller dédié</strong>
              <p>Une orientation personnalisée selon votre série de bac et votre projet professionnel.</p>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            </div>
            <div>
              <MapPin size={30} strokeWidth={1.5} aria-hidden="true" />
              <strong>Un accueil sur place</strong>
              <p>Le campus de Moukondo vous reçoit pour toute information sur les formations.</p>
              <a href={CONTACT.maps} target="_blank" rel="noreferrer">Obtenir l&apos;itinéraire</a>
            </div>
            <div>
              <FileText size={30} strokeWidth={1.5} aria-hidden="true" />
              <strong>Une candidature en ligne</strong>
              <p>La pré-inscription est gratuite et ne prend que quelques minutes.</p>
              <Link href="/enregistrements">Je me pré-inscris</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="site-container">
          <div className="foot-cols">
            <nav aria-label="Découvrir">
              <strong>Découvrir</strong>
              <a href="#atouts">Pourquoi l&apos;IPAIM</a>
              <a href="#institution">L&apos;institution</a>
              <a href="#campus">Nos implantations</a>
              <a href="#actualites">Actualités</a>
            </nav>
            <nav aria-label="Étudier">
              <strong>Étudier</strong>
              <a href="#formations">Nos filières</a>
              <a href="#parcours">Parcours d&apos;études</a>
              <a href="#admission">Admission</a>
              <a href="#financement">Financement</a>
            </nav>
            <nav aria-label="Étudiants">
              <strong>Étudiants</strong>
              <Link href="/etudiant">Espace étudiant</Link>
              <a href="#vivre">Services numériques</a>
              <a href="#questions">Questions fréquentes</a>
              <Link href="/enregistrements">Pré-inscription</Link>
            </nav>
            <nav aria-label="Contact">
              <strong>Contact</strong>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
              <a href={CONTACT.phone2Href}>{CONTACT.phone2}</a>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href="#equipe" className="foot-highlight">Rejoindre l&apos;équipe</a>
            </nav>
          </div>
          <div className="foot-band">
            <div className="foot-brand">
              <Image src="/etudiant/icon-192.png" alt="" width={44} height={44} />
              <span><strong>IPAIM University</strong><small>Innover · Former · Transformer</small></span>
            </div>
            <div className="foot-social">
              <span>Suivez-nous</span>
              <a href={CONTACT.facebook} target="_blank" rel="noreferrer" aria-label="IPAIM University sur Facebook"><FacebookIcon /></a>
              <a href={CONTACT.instagram} target="_blank" rel="noreferrer" aria-label="IPAIM University sur Instagram"><InstagramIcon /></a>
              <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" aria-label="IPAIM University sur WhatsApp"><WhatsAppIcon /></a>
              <a href={`mailto:${CONTACT.email}`} aria-label="Courriel"><Mail size={17} aria-hidden="true" /></a>
            </div>
          </div>
          <div className="foot-legal">
            <nav aria-label="Informations">
              <a href="#contact">Contact</a>
              <a href="#questions">Questions fréquentes</a>
              <Link href="/enregistrements">Pré-inscription</Link>
              <Link href="/">Espace de gestion</Link>
            </nav>
            <span>© {new Date().getFullYear()} IPAIM University · Brazzaville, République du Congo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
