export type User = { id?: string; nom: string; prenom?: string | null; email: string; role: string; posteId?: string | null; poste?: { id: string; nom: string } | null; permissions?: string[] };
export type DateOrder = "asc" | "desc";
export type JobPosition = { id: string; nom: string; permissions: string[]; _count?: { utilisateurs: number } };
export type Person = {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  quartier?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  sexe?: string | null;
  matricule?: string | null;
  photoUrl?: string | null;
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
  inscriptionsParType: Array<{ typeBourseId: string | null; typeBourse: string; total: number; inscrits: number; acceptesEnAttente: number }>;
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
  sourceConnaissance?: string | null;
  personne?: Person;
  relances?: ProspectRelance[];
};
export type ProspectRelance = {
  id: string;
  commentaire: string;
  intention?: string | null;
  statutRelance: string;
  date: string;
  dateProchaineRelance?: string | null;
  utilisateurNom: string;
  _offline?: boolean;
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
  dossiers?: Array<{ demandeBourseId: string; personne?: Person; montantPaye: string; resteAPayer: string }>;
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
  /** Renseignés pour un remboursement ou un report de trop-perçu. */
  motif?: string | null;
  saisiParNom?: string | null;
  obligation?: string | null;
  echeance?: string | null;
  affecte: boolean;
  /** Paiement saisi sans connexion, pas encore reçu par le serveur. */
  _offline?: boolean;
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
  _count?: { elementsDossier: number };
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
export type ViewName = "Vue d'ensemble" | "Demandes de bourse" | "Inscriptions" | "Fiche dossier" | "Aide de la page" | "Suppression des dossiers" | "Résumé de la journée" | "Certificats" | "Paiements" | "Dépenses" | "Validation des dépenses" | "Exécution des dépenses" | "Budget" | "Paramètres finances" | "Prospects" | "Personnes" | "Recrutement" | "Référentiels" | "Synchronisation" | "Rapports" | "Corbeille" | "Impressions" | "Structure académique" | "Classes et étudiants" | "Enseignement" | "Notes" | "Délibérations" | "Statistiques académiques" | "Personnel" | "Paie" | "Comptabilité" | "Sauvegardes" | "Audit" | "Profil" | "Paramètres" | "À propos du SGI";

export type DailyActivityReport = {
  date: string;
  total: number;
  parCategorie: Record<string, number>;
  activites: Array<{
    id: string;
    date: string;
    action: string;
    detail: string;
    utilisateur: string | null;
    categorie: string;
    montant?: string;
  }>;
};

export const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  ENTRETIEN_PROGRAMME: "Entretien programmé",
  EN_DELIBERATION: "En délibération",
  ACCEPTEE: "Acceptée",
  REFUSEE: "Refusée",
  EN_COURS: "En cours",
  COMPLETE: "Complète",
  ABANDONNEE: "Abandonnée",
  A_RELANCER: "À relancer",
  RELANCE: "Relancé",
  CONVERTI: "Converti",
  ABANDONNE: "Abandonné",
  ATTENDU: "Attendu",
  FOURNI: "Fourni",
  MANQUANT: "Manquant",
  SUBSTITUE: "Substitué",
  DEPOSE: "Dossier déposé",
  ENTRETIEN_REALISE: "Entretien réalisé",
  RETENU: "Retenu",
  FRAIS_DEPOT: "Frais de dépôt",
  FRAIS_INSCRIPTION: "Frais d'inscription",
  ECHEANCE_BOURSE: "Échéance de bourse",
  REMBOURSEMENT: "Remboursement",
  REPORT: "Report de trop-perçu",
  REFUSE: "Refusé",
};

export const formatDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(date))
    : "-";
export const formatMoney = (value: string | number) =>
  `${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F`;
export const fullName = (person?: Person) =>
  person ? `${person.prenom} ${person.nom}` : "Personne inconnue";
// Les polices standard des PDF ne connaissent pas les espaces insécables du format fr-FR :
// sans ce remplacement, les montants s'impriment avec des caractères parasites.
export const pdfSafe = (text: string) => text.replace(/[\u202f\u00a0]/g, " ");

// ---------- Dépenses ----------
export type ExpenseActions = {
  modifier: boolean;
  soumettre: boolean;
  reprendre: boolean;
  valider: boolean;
  blocageValidation: string | null;
  receptionner: boolean;
  facturer: boolean;
  payer: boolean;
  blocagePaiement: string | null;
  annuler: boolean;
};
export type ExpenseCategory = { id: string; nom: string; livraisonRequise: boolean; actif: boolean; compteNumero?: string | null };
export type Supplier = { id: string; nom: string; telephone?: string | null; email?: string | null; adresse?: string | null; identifiantFiscal?: string | null; actif: boolean };
export type FiscalYear = { id: string; libelle: string; dateDebut: string; dateFin: string; cloture: boolean };
export type FinanceRules = { seuilDoubleValidation: string; budgetBloquant: boolean; separationPaiement: boolean };
export type ExpenseSummary = {
  id: string;
  numero: string;
  objet: string;
  justification: string;
  statut: string;
  montant: string;
  montantFacture?: string | null;
  niveauxRequis: number;
  horsBudget: boolean;
  initiateurId: string;
  initiateurNom: string;
  dateCreation: string;
  dateSoumission?: string | null;
  numeroBonCommande?: string | null;
  dateBonCommande?: string | null;
  categorieId: string;
  categorie: ExpenseCategory;
  fournisseurId?: string | null;
  fournisseur?: Supplier | null;
  totalPaye: string;
  resteAPayer: string;
  actions: ExpenseActions;
};
export type ExpensePiece = { id: string; type: string; nom: string; url: string; ajouteParNom: string; date: string };
export type ExpenseDetail = ExpenseSummary & {
  exercice?: FiscalYear | null;
  validation1ParNom?: string | null;
  dateValidation1?: string | null;
  validation2ParNom?: string | null;
  dateValidation2?: string | null;
  motifRejet?: string | null;
  motifAnnulation?: string | null;
  numeroBonLivraison?: string | null;
  dateReception?: string | null;
  receptionParNom?: string | null;
  receptionConforme?: boolean | null;
  receptionCommentaire?: string | null;
  numeroFacture?: string | null;
  dateFacture?: string | null;
  factureParNom?: string | null;
  lignes: Array<{ id: string; designation: string; quantite: string; prixUnitaire: string }>;
  pieces: ExpensePiece[];
  decaissements: Array<{ id: string; numero: string; montant: string; mode: string; reference?: string | null; datePaiement: string; payeParNom: string }>;
  historique: Array<{ id: string; action: string; statut: string; utilisateurNom: string; commentaire?: string | null; date: string }>;
  budget: { budget: string; disponibleAvant: string } | null;
};
export type ExpensePage = { data: ExpenseSummary[]; meta: { page: number; limit: number; total: number; totalPages: number } };
export type BudgetReport = {
  exercice: FiscalYear | null;
  exercices: FiscalYear[];
  lignes: Array<{ categorieId: string; categorie: string; actif: boolean; budget: string; reserve: string; engage: string; paye: string; disponible: string; taux: number | null }>;
  totaux: { budget: string; reserve: string; engage: string; paye: string; disponible: string; recettes: string; solde: string } | null;
};
