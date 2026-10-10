"use client";

import { BrandLogo } from "@/components/brand-logo";

const capabilities = [
  {
    index: "01",
    title: "Admissions et inscriptions",
    detail: "Prospects, demandes de bourse, inscriptions, pièces, photos et certificats se suivent dans un même espace, du premier contact jusqu’au dossier complet.",
  },
  {
    index: "02",
    title: "Encaissements maîtrisés",
    detail: "Paiements, échéances, reçus, trop-perçus et annulations motivées sont rattachés à chaque dossier : le reste à payer est toujours à jour et rien ne s’efface.",
  },
  {
    index: "03",
    title: "Vie académique",
    detail: "Filières, classes, emplois du temps, cahier de textes, présences, notes sous anonymat, délibérations, bulletins et statistiques de réussite.",
  },
  {
    index: "04",
    title: "Dépenses et budget",
    detail: "Chaque dépense suit son circuit, de la demande à la validation puis au paiement, et se compare au budget voté par catégorie.",
  },
  {
    index: "05",
    title: "Comptabilité tenue automatiquement",
    detail: "Encaissements, factures, décaissements et paies génèrent leurs écritures : journal, balance, grand livre et états financiers sont disponibles à tout moment.",
  },
  {
    index: "06",
    title: "Personnel et paie",
    detail: "Recrutement, contrats, congés et absences alimentent la préparation de la paie, sa validation et l’édition des bulletins.",
  },
  {
    index: "07",
    title: "Un travail qui continue sans connexion",
    detail: "Les saisies faites hors ligne sont conservées sur l’appareil puis envoyées au serveur dès que la connexion revient.",
  },
  {
    index: "08",
    title: "Pilotage, traçabilité et sécurité",
    detail: "Tableau de bord, rapports et exports PDF éclairent les décisions ; les accès par poste, le journal d’audit, la corbeille et les sauvegardes chiffrées protègent les données.",
  },
];

export function AboutSgiPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="content-scroll about-sgi-page">
      <section className="about-sgi-hero">
        <div className="about-sgi-brand"><BrandLogo compact /><span>IPAIM UNIVERSITY</span></div>
        <p className="eyebrow">Innovation au service de l’éducation</p>
        <h2>IPAIM fait du numérique un véritable outil de maîtrise.</h2>
        <p className="about-sgi-lead">Le SGI d’IPAIM réunit dans un même espace les admissions, la scolarité, les finances et le personnel, pour aider chaque équipe à faire avancer son travail avec clarté.</p>
        <div className="about-sgi-status"><span aria-hidden="true">✓</span><div><strong>Version stable en service</strong><small>Vous utilisez la dernière version stable du SGI IPAIM.</small></div></div>
      </section>
      <section className="about-sgi-intro">
        <p className="eyebrow">Une ambition portée par IPAIM</p>
        <h3>Faire mieux circuler l’information pour mieux agir.</h3>
        <p>IPAIM a voulu créer un système de gestion intégré qui accompagne la réalité de l’établissement : des admissions aux délibérations, de l’encaissement à la comptabilité, du recrutement à la paie. Cette innovation place l’information utile au bon endroit et donne aux équipes une vision plus cohérente du travail à accomplir.</p>
      </section>
      <section className="about-sgi-capabilities" aria-label="Ce que couvre le SGI IPAIM">
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