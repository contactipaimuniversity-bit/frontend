"use client";

import { BrandLogo } from "@/components/brand-logo";

const capabilities = [
  {
    index: "01",
    title: "Un parcours suivi de bout en bout",
    detail: "Les demandes de bourse, inscriptions, pièces et certificats se retrouvent dans un même espace de travail, pour garder une lecture claire de chaque dossier.",
  },
  {
    index: "02",
    title: "Des opérations maîtrisées",
    detail: "Les paiements, échéances et affectations sont rapprochés des dossiers concernés, afin de rendre les montants attendus et les actions restantes plus lisibles.",
  },
  {
    index: "03",
    title: "Un contrôle concret au quotidien",
    detail: "Le suivi des éléments requis et des états de dossier aide les équipes à repérer ce qui est complet, ce qui manque et ce qui doit avancer.",
  },
  {
    index: "04",
    title: "Une vision utile à la décision",
    detail: "Les rapports rassemblent les indicateurs d’activité, les dossiers incomplets et les échéances en retard pour faciliter le pilotage de l’établissement.",
  },
];

export function AboutSgiPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="content-scroll about-sgi-page">
      <section className="about-sgi-hero">
        <div className="about-sgi-brand"><BrandLogo compact /><span>IPAIM UNIVERSITY</span></div>
        <p className="eyebrow">Innovation au service de l’éducation</p>
        <h2>IPAIM fait du numérique un véritable outil de maîtrise.</h2>
        <p className="about-sgi-lead">Le SGI d’IPAIM réunit le suivi, le contrôle et le pilotage des activités scolaires dans un espace conçu pour aider les équipes à faire avancer chaque dossier avec clarté.</p>
        <div className="about-sgi-status"><span aria-hidden="true">✓</span><div><strong>Version stable en service</strong><small>Vous utilisez la dernière version stable du SGI IPAIM.</small></div></div>
      </section>
      <section className="about-sgi-intro">
        <p className="eyebrow">Une ambition portée par IPAIM</p>
        <h3>Faire mieux circuler l’information pour mieux agir.</h3>
        <p>IPAIM a voulu créer un système de gestion intégré qui accompagne la réalité de l’établissement : des admissions aux inscriptions, du contrôle des pièces au suivi financier. Cette innovation place l’information utile au bon endroit et donne aux équipes une vision plus cohérente du travail à accomplir.</p>
      </section>
      <section className="about-sgi-capabilities" aria-label="Les principes du SGI IPAIM">
        {capabilities.map((item) => (
          <article className="about-sgi-capability" key={item.index}>
            <span>{item.index}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div>
          </article>
        ))}
      </section>
      <section className="about-sgi-closing">
        <p className="eyebrow">La technologie, avec une intention claire</p>
        <p>Avec son SGI, IPAIM affirme une conviction : une gestion rigoureuse libère du temps pour l’essentiel. Le système transforme des opérations dispersées en un suivi plus lisible, des contrôles plus simples et une meilleure continuité entre les équipes.</p>
        <button className="primary-button compact" onClick={onBack}>Retour à mon espace</button>
      </section>
      <footer className="about-sgi-credit">Powered by PEJOSOFT CORPORATION</footer>
    </div>
  );
}