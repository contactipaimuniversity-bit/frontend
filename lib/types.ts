export type User = { id?: string; nom: string; prenom?: string | null; email: string; role: string };
export type Person = {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  quartier?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  tuteurNom?: string;
  tuteurPrenom?: string;
  tuteurTelephone?: string;
  dateEnregistrement?: string;
};
export type PersonPage = {
  data: Person[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
export type Summary = {
  prospectsActifs: number;
  demandesEnCours: number;
  demandesTotal: number;
  effectifsTotal: number;
  inscriptionsTotal: number;
  inscriptionsParType: Array<{ typeBourseId: string | null; typeBourse: string; total: number }>;
  totalEncaisse: string;
  resteBourses: string;
  resteInscriptions: string;
  totalResteARecouvrer: string;
  tendance: Array<{ label: string; demandes: number; inscriptions: number }>;
};
export type Application = {
  id: string;
  statut: string;
  filiereSouhaitee: string;
  filiereSecondaireSouhaitee?: string | null;
  niveauDemande: string;
  ecoleOrigine?: string | null;
  dateDepot: string;
  dateDecision?: string | null;
  dateEntretien?: string | null;
  equipeEntretien?: string | null;
  personne?: Person;
  typeBourse?: ScholarshipType | null;
  dossierComplet?: boolean;
  elementsManquants?: string[];
  obligationsImpayees?: Array<{ nom: string; reste: string }>;
  paiementEnAttenteSync?: boolean;
};
export type ApplicationPage = {
  data: Application[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
export type Enrollment = {
  id: string;
  statut: string;
  filiere: string;
  niveau: string;
  anneeScolaire: string;
  viaBourse?: boolean;
  dateInscription: string;
  personne?: Person;
  demandeBourse?: { typeBourseId?: string | null } | null;
  dossierComplet?: boolean;
  elementsManquants?: string[];
  obligationsImpayees?: Array<{ nom: string; reste: string }>;
  paiementEnAttenteSync?: boolean;
};
export type EnrollmentPage = {
  data: Enrollment[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
export type Prospect = {
  id: string;
  statutRelance: string;
  filiereSouhaitee?: string;
  intention?: string;
  personne?: Person;
};
export type ProspectPage = {
  data: Prospect[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
export type LatePayment = {
  echeance: {
    id?: string;
    libelle: string;
    dateEcheance?: string;
    typeBourse?: { nom: string };
  };
  montantAttendu: string;
  montantPaye: string;
  resteAPayer: string;
};
export type UnassignedPayment = {
  id: string;
  montant: string | number;
  datePaiement: string;
  typePaiement: string;
  dossierId: string;
  dossierType: "demande-bourse" | "inscription";
  personne?: Person;
};
export type PaymentTransaction = UnassignedPayment & {
  dossier: string;
  obligation?: string | null;
  echeance?: string | null;
  affecte: boolean;
};
export type RequiredElement = {
  id: string;
  nom?: string;
  categorie?: string;
  contexte?: string;
  niveauApplicable?: string;
  obligatoire?: boolean;
  statut: string;
  montantAttendu?: string | number | null;
  paiements?: Array<{ montant: string | number }>;
  elementRequis: {
    id: string;
    nom: string;
    obligatoire?: boolean;
    elementSubstitutId?: string | null;
  };
};
export type CatalogElement = {
  id: string;
  nom: string;
  categorie: string;
  contexte: string;
  niveauApplicable: string;
  obligatoire: boolean;
  montantAttendu?: string | number | null;
  elementSubstitutId?: string | null;
  elementSubstitut?: { id: string; nom: string } | null;
};
export type ScholarshipType = {
  id: string;
  nom: string;
  fraisInscription: string | number;
  tauxReduction?: string | number | null;
  echeances?: Echeance[];
  echeancesAttendues?: number | null;
  echeancesConfigurees?: number;
};
export type Echeance = {
  id: string;
  libelle: string;
  ordre: number;
  dateEcheance?: string | null;
  montantAttendu?: string | number | null;
};
export type IncompleteReport = {
  total: number;
  dossiers: Array<{
    dossierType: "demande-bourse" | "inscription";
    dossierId: string;
    personne: Person;
    dossier: Application | Enrollment;
    elementsManquants: Array<{
      id: string;
      statut: string;
      elementRequis: { id: string; nom: string; obligatoire?: boolean };
    }>;
  }>;
};
export type PersonnelApplication = {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance?: string | null;
  diplome: string;
  fonction: string;
  quartier?: string | null;
  statut: string;
  dateEntretien?: string | null;
  equipeEntretien?: string | null;
  remarques?: string | null;
  dateDepot: string;
  elementsDossier: Array<{ id: string; nom: string; statut: string }>;
};
export type PersonnelApplicationPage = {
  data: PersonnelApplication[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
export type ApplicationFinance = {
  demandeId: string;
  obligations: Array<{
    id: string;
    nom: string;
    categorie: string;
    statut: string;
    montantAttendu: string;
    montantPaye: string;
    resteAPayer: string;
  }>;
  montantPayeNonAffecte: string;
  totalAttendu: string;
  totalPaye: string;
};
export type ViewName = "Vue d'ensemble" | "Demandes de bourse" | "Inscriptions" | "Fiche dossier" | "Suppression des dossiers" | "Certificats" | "Paiements" | "Prospects" | "Personnes" | "Recrutement" | "Référentiels" | "Synchronisation" | "Rapports" | "Profil" | "Paramètres";

export const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  ENTRETIEN_PROGRAMME: "Entretien programme",
  EN_DELIBERATION: "En deliberation",
  ACCEPTEE: "Acceptee",
  REFUSEE: "Refusee",
  EN_COURS: "En cours",
  COMPLETE: "Complete",
  ABANDONNEE: "Abandonnee",
  A_RELANCER: "A relancer",
  RELANCE: "Relance",
  CONVERTI: "Converti",
  ABANDONNE: "Abandonne",
  ATTENDU: "Attendu",
  FOURNI: "Fourni",
  MANQUANT: "Manquant",
  SUBSTITUE: "Substitue",
  DEPOSE: "Dossier déposé",
  ENTRETIEN_REALISE: "Entretien réalisé",
  RETENU: "Retenu",
  REFUSE: "Refusé",
};

export const formatDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
      }).format(new Date(date))
    : "-";
export const formatMoney = (value: string | number) =>
  `${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F`;
export const fullName = (person?: Person) =>
  person ? `${person.prenom} ${person.nom}` : "Personne inconnue";
