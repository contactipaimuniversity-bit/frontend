// Contenus de la vitrine publique d'IPAIM University.
// Le carrousel, les actualités et les questions fréquentes se gèrent dans
// l'administration (Site vitrine) ; le reste se met à jour ici.

export const CONTACT = {
  phone: "+242 06 400 04 71",
  phoneHref: "tel:+242064000471",
  phone2: "+242 06 782 09 44",
  phone2Href: "tel:+242067820944",
  whatsapp: "https://wa.me/242064000471",
  facebook: "https://www.facebook.com/profile.php?id=61590977258855",
  instagram: "https://www.instagram.com/IPAIM_University",
  email: "contact.ipaimuniversity@gmail.com",
  address: "Moukondo, en face de la station Total de Mazala (Western Union), Brazzaville",
  maps: "https://www.google.com/maps/search/?api=1&query=Station+Total+Mazala+Moukondo+Brazzaville",
};

// Menu principal : chaque rubrique ouvre un panneau avec ses pages.
export const MENU: Array<{ label: string; intro: string; links: Array<{ href: string; label: string; text: string }> }> = [
  {
    label: "Découvrir l'IPAIM",
    intro: "Un institut polytechnique brazzavillois qui prépare les bacheliers aux métiers de demain.",
    links: [
      { href: "#atouts", label: "Pourquoi l'IPAIM", text: "Ce qui nous distingue" },
      { href: "#institution", label: "L'institution", text: "Mission, direction, équipe" },
      { href: "#equipe", label: "L'équipe", text: "Celles et ceux qui dirigent l'IPAIM" },
      { href: "#rejoindre", label: "Rejoindre l'équipe", text: "Enseignants et personnel" },
    ],
  },
  {
    label: "Formations",
    intro: "Huit filières réparties en quatre pôles, du BTS à la Licence.",
    links: [
      { href: "#formations", label: "Trouver sa filière", text: "Les huit programmes" },
      { href: "#parcours", label: "Parcours d'études", text: "Du bac à la Licence et au-delà" },
      { href: "#formations", label: "Pôle technologique", text: "Informatique, web, réseaux" },
      { href: "#formations", label: "Pôle management", text: "Gestion, logistique, droit" },
    ],
  },
  {
    label: "Admission et financement",
    intro: "Une démarche simple, des frais maîtrisés et des aides pour financer vos études.",
    links: [
      { href: "#admission", label: "Intégrer l'IPAIM", text: "Démarches et dossier" },
      { href: "#financement", label: "Financer ses études", text: "Bourse, réduction, parrainage" },
      { href: "#questions", label: "Questions fréquentes", text: "Les réponses utiles" },
      { href: "/enregistrements", label: "Pré-inscription", text: "Gratuite, en ligne" },
    ],
  },
  {
    label: "Vivre l'IPAIM",
    intro: "Des services numériques, une scolarité attentive et une communauté qui s'implique.",
    links: [
      { href: "#vivre", label: "Services numériques", text: "L'application étudiante" },
      { href: "#vivre", label: "La scolarité", text: "Inscriptions et documents" },
      { href: "/etudiant", label: "Espace étudiant", text: "Se connecter" },
    ],
  },
];

export const NAV = [
  { href: "#atouts", label: "Pourquoi l'IPAIM" },
  { href: "#formations", label: "Formations" },
  { href: "#admission", label: "Admission" },
  { href: "#financement", label: "Financement" },
  { href: "#actualites", label: "Actualités" },
  { href: "#contact", label: "Contact" },
];

// Présentation affichée tant que l'administration n'a publié aucune diapositive.
export const DEFAULT_SLIDES = [
  {
    id: "defaut-1",
    surtitre: "Admissions 2026-2027 ouvertes",
    titre: "Construisez votre avenir professionnel au Congo",
    texte: "Des BTS et des Licences tournés vers l'emploi, dans le numérique, la gestion, le droit et l'industrie.",
    boutonLibelle: "Trouver ma filière",
    boutonLien: "#formations",
    image: null,
  },
  {
    id: "defaut-2",
    surtitre: "Financement des études",
    titre: "Jusqu'à 100 000 FCFA de bourse, et 30 % de frais en moins",
    texte: "Une bourse locale sur trois ans et une réduction appliquée à toute inscription pour l'année 2026-2027.",
    boutonLibelle: "Financer mes études",
    boutonLien: "#financement",
    image: null,
  },
  {
    id: "defaut-3",
    surtitre: "Services numériques",
    titre: "Toute votre scolarité dans votre téléphone",
    texte: "Carte d'étudiant, notes, emploi du temps et paiements, consultables à tout moment depuis l'application IPAIM.",
    boutonLibelle: "Ouvrir l'espace étudiant",
    boutonLien: "/etudiant",
    image: null,
  },
];

// Pourquoi choisir l'IPAIM.
export const STRENGTHS = [
  { title: "Une formation tournée vers l'emploi", text: "Chaque programme s'appuie sur les compétences attendues par les entreprises du pays : projets, travaux pratiques et mises en situation." },
  { title: "Des études à la portée des familles", text: "Des frais maîtrisés, une bourse locale et une réduction de 30 % pour la rentrée 2026-2027." },
  { title: "Des diplômes qui s'enchaînent", text: "Un BTS en deux ans, une Licence en trois ans selon le système LMD, et une passerelle vers la France après deux années." },
  { title: "Un accompagnement de proximité", text: "Une équipe joignable, une scolarité organisée et une application pour suivre ses cours et ses notes au quotidien." },
];

export const FIGURES = [
  { value: "8", label: "filières professionnalisantes" },
  { value: "4", label: "pôles d'enseignement" },
  { value: "100 000", label: "FCFA de bourse au maximum" },
  { value: "30 %", label: "de réduction en 2026-2027" },
];

export type Pole = "Technologique" | "Management" | "Industriel" | "Agricole & environnement";
export const POLES: Pole[] = ["Technologique", "Management", "Industriel", "Agricole & environnement"];

export const PROGRAMS: Array<{ pole: Pole; name: string; summary: string; learn: string[]; careers: string[] }> = [
  {
    pole: "Technologique",
    name: "Génie informatique",
    summary: "Maîtriser la programmation, les bases de données et le fonctionnement des systèmes.",
    learn: ["Programmation et algorithmes", "Bases de données et systèmes d'exploitation", "Maintenance du matériel informatique"],
    careers: ["Programmeur", "Technicien de support", "Gestionnaire de bases de données"],
  },
  {
    pole: "Technologique",
    name: "Développement web et mobile",
    summary: "Concevoir puis publier des sites et des applications, du prototype à la mise en service.",
    learn: ["Interfaces et expérience utilisateur", "Programmation côté serveur", "Applications pour smartphone"],
    careers: ["Développeur web", "Développeur d'applications mobiles", "Intégrateur"],
  },
  {
    pole: "Technologique",
    name: "Télécoms, réseaux et cybersécurité",
    summary: "Déployer, administrer et protéger les infrastructures de communication.",
    learn: ["Architecture des réseaux", "Télécommunications", "Sécurité des systèmes d'information"],
    careers: ["Technicien réseaux", "Administrateur systèmes et réseaux", "Analyste sécurité"],
  },
  {
    pole: "Management",
    name: "Management",
    summary: "Acquérir les outils de gestion pour encadrer une équipe ou lancer son activité.",
    learn: ["Comptabilité et gestion financière", "Marketing et vente", "Gestion des ressources humaines"],
    careers: ["Assistant de direction", "Conseiller commercial", "Entrepreneur"],
  },
  {
    pole: "Management",
    name: "Logistique et transport",
    summary: "Organiser l'acheminement et le stockage des marchandises, du port jusqu'à l'entreprise.",
    learn: ["Gestion des stocks et des entrepôts", "Transport et transit", "Commerce international et douane"],
    careers: ["Logisticien", "Déclarant en douane", "Chef d'entrepôt"],
  },
  {
    pole: "Management",
    name: "Droit",
    summary: "Comprendre les règles qui encadrent l'entreprise, l'administration et la vie des citoyens.",
    learn: ["Droit des affaires et droit civil", "Institutions et droit public", "Rédaction et méthode juridiques"],
    careers: ["Assistant juridique", "Agent de l'administration", "Poursuite en Master"],
  },
  {
    pole: "Industriel",
    name: "Métiers industriels",
    summary: "Intervenir sur les installations électriques et les équipements de production.",
    learn: ["Électrotechnique", "Maintenance des équipements", "Santé, sécurité et environnement"],
    careers: ["Technicien de maintenance", "Électricien d'installation", "Animateur HSE"],
  },
  {
    pole: "Agricole & environnement",
    name: "Agriculture et environnement",
    summary: "Un pôle consacré aux métiers de la terre et de l'environnement, dont le programme est présenté sur demande.",
    learn: [],
    careers: [],
  },
];

// Du baccalauréat à la suite du parcours.
export const PATHWAY = [
  { step: "Baccalauréat", detail: "Général, technique ou professionnel : toutes les séries sont admises." },
  { step: "BTS · 2 ans", detail: "Un diplôme technique court, conçu pour une entrée rapide dans la vie active." },
  { step: "Licence · 3 ans", detail: "Le premier grade du système LMD, qui ouvre à l'emploi qualifié." },
  { step: "Et ensuite", detail: "Insertion professionnelle, Master, ou poursuite d'études en France après deux années à l'IPAIM." },
];

export const FUNDING = [
  { value: "100 000 FCFA", title: "Bourse locale 2026-2027", text: "Attribuée après entretien et maintenue sur trois années d'études. Deux formules existent : Excellence et Premium." },
  { value: "−30 %", title: "Réduction des frais", text: "Appliquée à toute inscription pour l'année universitaire 2026-2027." },
  { value: "7 amis inscrits", title: "Programme de parrainage", text: "Faites découvrir l'IPAIM autour de vous : si sept de vos amis s'inscrivent, vous êtes exonéré de vos frais de scolarité." },
];

export const ADMISSION_STEPS = [
  { title: "Se pré-inscrire en ligne", text: "Une démarche gratuite de quelques minutes, qui réserve votre place." },
  { title: "Constituer son dossier", text: "À déposer au campus de Moukondo, à Brazzaville, auprès du service d'information." },
  { title: "Passer l'entretien", text: "Sur convocation, lors de l'une des sessions organisées à l'université." },
  { title: "Finaliser l'inscription", text: "Le règlement des frais confirme votre place et vous donne votre matricule." },
];

export const FILE_PIECES = [
  "Copie de l'acte de naissance",
  "Lettre de demande adressée au Directeur général",
  "Deux photos d'identité",
  "Attestation de réussite et relevé de notes du baccalauréat",
  "Frais de dossier : 10 000 FCFA",
];

export const DIGITAL_SERVICES = [
  "Carte d'étudiant dématérialisée",
  "Emploi du temps à jour",
  "Notes et résultats",
  "Suivi des paiements",
  "Annonces de l'administration",
  "Attestations et documents",
];

export const COMMUNITY = [
  { title: "Ambassadeurs", text: "Les étudiants qui font rayonner l'université autour d'eux voient leur engagement distingué et récompensé." },
  { title: "Engagement solidaire", text: "Campagnes de sensibilisation et actions collectives rythment l'année universitaire." },
  { title: "Prises de parole", text: "Débats et témoignages donnent aux étudiants l'occasion d'exprimer leur vision de l'avenir." },
];

export const LEADERSHIP = [
  { title: "Direction générale", text: "Fixe les grandes orientations de l'université, noue ses partenariats avec les entreprises et les institutions, et statue sur les demandes de bourse." },
  { title: "Direction académique", text: "Conçoit l'offre de formation, organise les enseignements et les examens, encadre le corps enseignant et veille à la réussite de chaque étudiant." },
  { title: "Direction administrative", text: "Assure le bon fonctionnement de l'établissement au quotidien : accueil, scolarité, gestion des dossiers et suivi des ressources humaines." },
  { title: "Direction des systèmes d'information et de la communication", text: "Fait vivre les outils numériques de l'université (plateforme de gestion, application étudiante, réseau) et porte sa communication auprès du public." },
];

// L'équipe de direction : photo (facultative, dans public/site/equipe), nom, fonction et rôle.
export const TEAM: Array<{ name: string; role: string; text: string; photo?: string; initials: string }> = [
  { name: "Pascale M'VOULA", role: "Directrice générale", initials: "PM", text: "Définit la stratégie de l'université, conduit ses partenariats et porte sa vision auprès des institutions et des familles." },
  { name: "Axel Mauriel YINDOULA", role: "Responsable académique", initials: "AY", photo: "/site/equipe/yindoula.jpg", text: "Organise l'offre de formation, coordonne les enseignants et suit la progression pédagogique des étudiants." },
  { name: "Dylanh MISSIANDOT", role: "Responsable administratif", initials: "DM", photo: "/site/equipe/missiandot.jpg", text: "Veille au bon fonctionnement quotidien de l'établissement : accueil, dossiers, organisation et relations avec les usagers." },
  { name: "Rebecca LOUVOUMBOU", role: "Responsable financière", initials: "RL", text: "Pilote le budget, suit les encaissements et les dépenses, et garantit une gestion rigoureuse des ressources." },
  { name: "Louange MICK", role: "Responsable financière adjointe", initials: "LM", text: "Seconde la responsable financière dans le suivi des paiements, de la caisse et des opérations comptables." },
  { name: "Juvena POHO", role: "Responsable informatique", initials: "JP", photo: "/site/equipe/poho.jpg", text: "Conçoit et administre les systèmes numériques de l'université : plateforme de gestion, application étudiante et infrastructure." },
];
