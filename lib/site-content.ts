// Contenus de la vitrine publique d'IPAIM University.
// Les diapositives du carrousel viennent de l'administration (Site vitrine) ;
// le reste se met à jour ici.

export const CONTACT = {
  phone: "+242 06 400 04 71",
  phoneHref: "tel:+242064000471",
  phone2: "+242 06 782 09 44",
  phone2Href: "tel:+242067820944",
  whatsapp: "https://wa.me/242064000471",
  email: "contact.ipaimuniversity@gmail.com",
  address: "Moukondo, en face de la station Total de Mazala (Western Union), Brazzaville",
  maps: "https://www.google.com/maps/search/?api=1&query=Station+Total+Mazala+Moukondo+Brazzaville",
};

export const NAV = [
  { href: "#universite", label: "L'université" },
  { href: "#formations", label: "Formations" },
  { href: "#admissions", label: "Admissions" },
  { href: "#vie-etudiante", label: "Vie étudiante" },
  { href: "#actualites", label: "Actualités" },
  { href: "#contact", label: "Contact" },
];

// Présentation par défaut, tant qu'aucune diapositive n'est publiée.
export const DEFAULT_SLIDES = [
  {
    id: "defaut-1",
    surtitre: "Enseignement supérieur privé · Brazzaville",
    titre: "Innover. Former. Transformer.",
    texte: "BTS et Licences professionnalisantes en informatique, télécoms, management, droit, logistique et métiers industriels.",
    boutonLibelle: "Découvrir nos formations",
    boutonLien: "#formations",
    image: null,
  },
  {
    id: "defaut-2",
    surtitre: "Rentrée 2026-2027",
    titre: "30 % de réduction sur les frais de scolarité",
    texte: "Pour toute inscription à la rentrée 2026-2027, et une bourse locale pouvant aller jusqu'à 100 000 FCFA.",
    boutonLibelle: "Admissions et bourses",
    boutonLien: "#admissions",
    image: null,
  },
  {
    id: "defaut-3",
    surtitre: "Application étudiante",
    titre: "Votre université, partout avec vous",
    texte: "Carte d'étudiant, matricule, emploi du temps, notes et démarches réunis dans un seul espace.",
    boutonLibelle: "Accéder à l'espace étudiant",
    boutonLien: "/etudiant",
    image: null,
  },
];

export const TICKER = [
  "Rentrée académique : 2 novembre 2026",
  "−30 % sur les frais de scolarité 2026-2027",
  "Bourse locale 2026-2027 : dossiers ouverts",
  "Application étudiante disponible",
  "Pointe-Noire : dépôts de bourse ouverts",
];

export const VALUES = [
  { title: "Innover", text: "Des filières tournées vers le numérique, l'industrie et les métiers de demain, et des outils modernes au service des étudiants." },
  { title: "Former", text: "Un enseignement qui associe théorie et pratique, encadré par une équipe disponible et attentive à chacun." },
  { title: "Transformer", text: "Faire du potentiel de chaque étudiant des compétences reconnues et des opportunités professionnelles." },
];

export const FIGURES = [
  { value: "4", label: "pôles de formation" },
  { value: "8", label: "domaines d'études" },
  { value: "2", label: "diplômes : BTS et Licence" },
  { value: "2", label: "villes : Brazzaville et Pointe-Noire" },
];

export type Pole = "Technologique" | "Management" | "Industriel" | "Agricole & environnement";
export const POLES: Pole[] = ["Technologique", "Management", "Industriel", "Agricole & environnement"];

export const PROGRAMS: Array<{ pole: Pole; name: string; summary: string; learn: string[]; careers: string[] }> = [
  {
    pole: "Technologique",
    name: "Génie informatique",
    summary: "Concevoir, programmer et maintenir des systèmes informatiques fiables.",
    learn: ["Algorithmique et programmation", "Systèmes d'exploitation et bases de données", "Architecture des ordinateurs et maintenance"],
    careers: ["Développeur", "Technicien informatique", "Administrateur de bases de données"],
  },
  {
    pole: "Technologique",
    name: "Développement web et mobile",
    summary: "Créer des sites, des applications et des services mobiles, de la maquette à la mise en ligne.",
    learn: ["Développement front-end et back-end", "Applications mobiles", "Ergonomie et design d'interface"],
    careers: ["Développeur web ou mobile", "Intégrateur web", "Créateur de solutions numériques"],
  },
  {
    pole: "Technologique",
    name: "Télécoms, réseaux et cybersécurité",
    summary: "Installer, administrer et sécuriser les réseaux des entreprises et des opérateurs.",
    learn: ["Réseaux informatiques et télécommunications", "Administration système", "Sécurité des réseaux et des données"],
    careers: ["Technicien réseaux et télécoms", "Administrateur réseau", "Analyste en cybersécurité"],
  },
  {
    pole: "Management",
    name: "Management",
    summary: "Gérer et piloter une activité, encadrer une équipe ou créer son entreprise.",
    learn: ["Gestion et comptabilité", "Marketing et relation client", "Gestion des ressources humaines"],
    careers: ["Assistant de gestion", "Chargé de clientèle", "Créateur d'entreprise"],
  },
  {
    pole: "Management",
    name: "Logistique et transport",
    summary: "Planifier et optimiser les flux de marchandises entre entreprises, ports et territoires.",
    learn: ["Chaîne logistique et gestion des stocks", "Transport national et international", "Douane et commerce international"],
    careers: ["Gestionnaire logistique", "Agent de transit", "Responsable d'entrepôt"],
  },
  {
    pole: "Management",
    name: "Droit",
    summary: "Les fondements du droit pour les carrières juridiques, administratives et le conseil.",
    learn: ["Droit civil et droit des affaires", "Droit public et institutions", "Méthodologie juridique"],
    careers: ["Assistant juridique", "Agent administratif", "Poursuite d'études en Master"],
  },
  {
    pole: "Industriel",
    name: "Métiers industriels",
    summary: "Des formations techniques pour l'industrie, l'énergie et la maintenance.",
    learn: ["Électricité et électrotechnique", "Maintenance industrielle", "Hygiène, sécurité et environnement"],
    careers: ["Technicien de maintenance", "Électricien industriel", "Agent HSE"],
  },
  {
    pole: "Agricole & environnement",
    name: "Agriculture et environnement",
    summary: "Les programmes détaillés de ce pôle sont présentés par le service d'information.",
    learn: [],
    careers: [],
  },
];

export const DEGREES = [
  { name: "BTS", duration: "2 ans après le baccalauréat", text: "Un diplôme technique court, pour accéder rapidement à l'emploi." },
  { name: "Licence", duration: "3 ans après le baccalauréat · système LMD", text: "Un diplôme de premier cycle qui ouvre à l'emploi qualifié et à la poursuite d'études en Master." },
];

export const STEPS = [
  { title: "Pré-inscription en ligne", text: "Gratuite, elle réserve votre place et vous met en relation avec le service d'information." },
  { title: "Dépôt du dossier", text: "Le dossier complet se dépose au campus de Moukondo, ou à Pointe-Noire pour les candidats de cette ville." },
  { title: "Entretien", text: "Vous êtes convoqué à un entretien à l'université. Les entretiens se tiennent par vagues successives." },
  { title: "Inscription définitive", text: "Vous finalisez votre inscription et recevez votre matricule au service de la scolarité." },
];

export const FILE_PIECES = [
  "Copie de l'acte de naissance",
  "Demande manuscrite adressée au Directeur général",
  "Deux photos d'identité",
  "Attestation de réussite au baccalauréat",
  "Relevé de notes du baccalauréat",
  "Frais de traitement : 10 000 FCFA",
];

export const SCHOLARSHIPS = [
  { title: "Bourse d'excellence", text: "Elle récompense le mérite des bacheliers retenus à l'issue de l'entretien." },
  { title: "Bourse Premium", text: "Une seconde formule, présentée en détail lors de l'entretien." },
  { title: "Sur trois ans", text: "La bourse accompagne l'étudiant pendant trois années d'études." },
  { title: "Jusqu'à 100 000 FCFA", text: "D'économie sur le coût de la formation." },
];

export const ADVANTAGES = [
  { value: "−30 %", title: "Frais de scolarité", text: "Réduction appliquée à la rentrée 2026-2027." },
  { value: "7", title: "Programme entrepreneur", text: "Parrainez sept amis : s'ils s'inscrivent, vous bénéficiez d'une exemption de frais." },
  { value: "2 + ", title: "Cap sur la France", text: "Un parcours permet de poursuivre ses études en France après deux années à l'IPAIM." },
];

export const FAQ = [
  { q: "Qui peut s'inscrire à l'IPAIM ?", a: "Les titulaires du baccalauréat général, technique ou professionnel. Le service d'information vérifie l'éligibilité selon l'année d'obtention et la filière choisie." },
  { q: "Combien coûte le dépôt d'un dossier de bourse ?", a: "Les frais de traitement s'élèvent à 10 000 FCFA. La pré-inscription en ligne est gratuite." },
  { q: "J'habite Pointe-Noire. Où déposer mon dossier ?", a: "Les dépôts de dossiers de bourse sont ouverts à Pointe-Noire depuis le 1er novembre 2026. Appelez le +242 06 400 04 71 pour connaître le lieu de dépôt." },
  { q: "Où trouver le détail des frais de scolarité ?", a: "Le service d'information remet le détail des frais par filière, sur place ou par téléphone." },
];

export const STUDENT_SERVICES = [
  "Inscriptions et réinscriptions",
  "Matricule et carte d'étudiant",
  "Accès à l'application étudiante",
  "Attestations d'inscription",
  "Relevés de notes et résultats",
  "Calendrier et emplois du temps",
];

export const COMMUNITY = [
  { title: "Ambassadeurs IPAIM", text: "Les étudiants qui font connaître l'université sont distingués et récompensés pour leur engagement." },
  { title: "Octobre Rose", text: "L'université se mobilise pour la sensibilisation et la prévention du cancer du sein." },
  { title: "Débats étudiants", text: "« Peut-on réussir au Congo sans partir à l'étranger ? » Les étudiants prennent la parole sur leur avenir." },
];

export const NEWS = [
  { date: "19 nov. 2026", tag: "Scolarité", title: "Avez-vous retiré votre matricule ?", text: "Le matricule vous identifie tout au long de votre parcours. Il se retire au service de la scolarité." },
  { date: "14 nov. 2026", tag: "Scolarité", title: "L'application étudiante est en service", text: "Les services universitaires sont désormais accessibles depuis un smartphone. Les accès se retirent à la scolarité." },
  { date: "14 nov. 2026", tag: "Bourses", title: "Brazzaville et Pointe-Noire : cap sur la France", text: "Après deux ans à l'IPAIM, un parcours permet de poursuivre ses études en France." },
  { date: "10 nov. 2026", tag: "Rentrée", title: "La rentrée académique est lancée", text: "Les cours ont débuté à Brazzaville, avec 30 % de réduction sur les frais de scolarité." },
  { date: "23 oct. 2026", tag: "Bourses", title: "La bourse arrive à Pointe-Noire", text: "Depuis le 1er novembre, les bacheliers de Pointe-Noire peuvent déposer leur dossier de bourse." },
  { date: "26 sept. 2026", tag: "Vie du campus", title: "Mberi Ange Sephora distinguée", text: "Ambassadrice IPAIM, elle reçoit 30 000 FCFA en reconnaissance de son engagement." },
];

export const TEAM = [
  { initials: "YA", name: "Yindoula Axel Mauriel", role: "Responsable académique" },
  { initials: "DM", name: "Dylanh Missiandot", role: "Responsable administratif" },
];

export const GOVERNANCE = [
  { title: "Direction générale", text: "Fixe la stratégie, les partenariats et le développement de l'université." },
  { title: "Direction académique", text: "Organise les enseignements et accompagne les étudiants vers la réussite." },
  { title: "Direction administrative", text: "Assure la bonne gestion de l'établissement au service de la communauté." },
  { title: "Service de la scolarité", text: "Gère les inscriptions, les matricules et l'accès à l'application étudiante." },
];

export const CAMPUSES = [
  { city: "Brazzaville", status: "Campus ouvert", text: "Moukondo, en face de la station Total de Mazala (Western Union). Accueil et service d'information sur place." },
  { city: "Pointe-Noire", status: "En préparation", text: "L'IPAIM prépare son arrivée. Les dossiers de bourse y sont déjà reçus depuis le 1er novembre 2026." },
];
