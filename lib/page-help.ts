import { HelpedView } from "@/lib/routes";

export type PageHelp = {
  /** Une phrase : ce que l'écran permet de faire. */
  summary: string;
  purpose: string[];
  steps: Array<{ title: string; detail: string }>;
  tips?: string[];
  faq: Array<{ question: string; answer: string }>;
};

const OFFLINE_FAQ = {
  question: "Puis-je travailler sans connexion ?",
  answer: "Oui pour créer et modifier les dossiers : l'enregistrement est gardé sur l'appareil puis envoyé automatiquement au retour de la connexion (voir la page Synchronisation). Les suppressions, les fichiers et les photos demandent une connexion.",
};
const REFRESH_FAQ = {
  question: "Je ne vois pas ce que je viens d'enregistrer, que faire ?",
  answer: "Cliquez sur « Actualiser » en haut à droite. Si une recherche ou un filtre est actif, effacez-le : l'élément peut simplement être masqué.",
};
const ACCESS_FAQ = {
  question: "Un bouton est absent ou une action est refusée, pourquoi ?",
  answer: "Les droits dépendent de votre poste. Un accès en lecture seule montre les données sans permettre de les modifier. Demandez à un administrateur d'ajuster vos accès dans Paramètres › Postes et accès.",
};

// Le contenu d'aide de chaque écran : à quoi il sert, comment s'en servir, questions fréquentes.
export const PAGE_HELP: Record<HelpedView, PageHelp> = {
  "Vue d'ensemble": {
    summary: "Le tableau de bord : l'état de l'activité en un coup d'œil et les raccourcis vers ce qui demande votre attention.",
    purpose: [
      "Afficher les chiffres clés : prospects actifs, demandes de bourse en cours, inscriptions, montant encaissé et reste à recouvrer.",
      "Montrer les dernières demandes de bourse, les inscriptions récentes, les effectifs par type de bourse et l'évolution mensuelle des nouveaux dossiers.",
      "Lister ce qu'il reste à faire pour vous amener directement sur le bon écran.",
    ],
    steps: [
      { title: "Lire les indicateurs", detail: "Les cartes du haut résument l'activité. Elles sont recalculées à chaque chargement de la page." },
      { title: "Ouvrir une liste", detail: "Cliquez sur un bloc ou sur son lien pour ouvrir la page correspondante (demandes, inscriptions, paiements...)." },
      { title: "Filtrer par type de bourse", detail: "Dans « Effectifs par type de bourse », un clic sur un type ouvre les inscriptions de ce type uniquement." },
      { title: "Consulter la journée", detail: "Le résumé de la journée détaille tout ce qui a été enregistré aujourd'hui, et par qui." },
    ],
    tips: ["Le bouton « Actualiser » recharge les chiffres sans vous déconnecter."],
    faq: [
      { question: "Pourquoi certains blocs n'apparaissent-ils pas chez moi ?", answer: "Chaque bloc suit vos droits d'accès : vous ne voyez que les rubriques ouvertes à votre poste." },
      { question: "Les chiffres sont-ils en temps réel ?", answer: "Ils sont à jour au moment du chargement. Cliquez sur « Actualiser » pour les recalculer." },
      { question: "Que représente le reste à recouvrer ?", answer: "La somme des montants attendus sur les dossiers (bourses et inscriptions) qui n'ont pas encore été payés." },
    ],
  },
  "Demandes de bourse": {
    summary: "Le suivi de chaque candidature à une bourse, du dépôt du dossier jusqu'à la décision.",
    purpose: [
      "Enregistrer les demandes de bourse et retrouver un dossier par nom, téléphone, filière ou école d'origine.",
      "Suivre les pièces fournies, l'entretien, la délibération et la décision (acceptée ou refusée).",
      "Voir pour chaque dossier ce qui manque et ce qui reste à payer.",
    ],
    steps: [
      { title: "Créer une demande", detail: "Cliquez sur « Nouvelle demande ». Choisissez un candidat existant ou cochez « Créer une nouvelle personne », puis indiquez le niveau, la filière souhaitée, éventuellement une filière secondaire et l'école d'origine." },
      { title: "Ajouter la photo (facultatif)", detail: "Dans le formulaire, « Ouvrir la caméra » prend la photo sur place ; « Galerie / Parcourir » choisit une image existante. Sans photo, l'enregistrement fonctionne normalement : vous pourrez l'ajouter plus tard depuis la fiche." },
      { title: "Préparer le dossier", detail: "Marquez les pièces déjà reçues et, si le candidat paie tout de suite, saisissez le montant et l'obligation concernée (frais de dépôt)." },
      { title: "Suivre le dossier", detail: "Sur chaque ligne : « Pièces » met à jour les éléments fournis, « Finance » montre les montants, « Entretien » fixe la date et l'équipe, « Décider » passe en délibération, accepte ou refuse." },
      { title: "Ouvrir la fiche", detail: "Cliquez sur le nom du candidat pour afficher la fiche complète du dossier, avec la photo, les pièces et les paiements." },
    ],
    tips: [
      "Le type de bourse est obligatoire au moment d'accepter une demande.",
      "Les filtres par statut et par type de bourse se combinent avec la recherche.",
    ],
    faq: [
      { question: "La photo est-elle obligatoire ?", answer: "Non. Elle est facultative : un dossier sans photo est enregistré et traité exactement comme les autres." },
      { question: "Comment corriger une erreur sur l'identité du candidat ?", answer: "Ouvrez la fiche du dossier puis « Modifier les informations » dans la section Personne. La correction s'applique à tous les dossiers de cette personne." },
      { question: "Que devient une demande supprimée ?", answer: "Elle part à la corbeille avec le motif saisi, ainsi que les inscriptions et paiements qui lui sont rattachés. Un administrateur peut la restaurer." },
      OFFLINE_FAQ,
    ],
  },
  Inscriptions: {
    summary: "L'enregistrement et le suivi des inscriptions, directes ou issues d'une bourse accordée.",
    purpose: [
      "Inscrire un étudiant pour une année scolaire, un niveau et une filière.",
      "Suivre les pièces et les frais du dossier jusqu'à ce qu'il soit complet.",
      "Relier une inscription à la demande de bourse qui l'a précédée.",
    ],
    steps: [
      { title: "Choisir le type", detail: "« Nouvelle inscription », puis « Inscription directe » (nouvelle personne) ou « Inscription via une bourse » (vous choisissez alors le dossier de bourse accepté : le niveau et la filière sont repris)." },
      { title: "Renseigner l'inscription", detail: "Saisissez l'année scolaire, le niveau (L1 ou L2) et la filière. Les pièces et frais applicables s'affichent dès que le niveau est choisi." },
      { title: "Ajouter la photo (facultatif)", detail: "Prenez la photo avec la caméra ou choisissez une image dans la galerie. Vous pouvez enregistrer sans photo et la joindre plus tard." },
      { title: "Préparer le dossier", detail: "Marquez les pièces déjà fournies et saisissez le premier versement s'il a lieu à l'inscription." },
      { title: "Suivre et clôturer", detail: "Cliquez sur le nom de l'étudiant pour ouvrir sa fiche, ou utilisez « Pièces » et « Finance » sur la ligne. « Modifier » change le statut : En cours, Complète ou Abandonnée." },
    ],
    tips: ["Une inscription liée à une demande encore non décidée demande une confirmation explicite."],
    faq: [
      { question: "Pourquoi le dossier de bourse que je cherche n'est-il pas proposé ?", answer: "Seules les demandes acceptées sont proposées. Vérifiez la décision dans « Demandes de bourse »." },
      { question: "La photo est-elle obligatoire ?", answer: "Non. L'inscription s'enregistre avec ou sans photo." },
      { question: "Quand l'étudiant reçoit-il son matricule ?", answer: "À sa première affectation dans une classe, depuis « Classes et étudiants »." },
      OFFLINE_FAQ,
    ],
  },
  "Fiche dossier": {
    summary: "Toutes les informations d'un dossier réunies sur une seule page : la personne et sa photo, les pièces, les paiements et les actions à mener.",
    purpose: [
      "Consulter l'identité de la personne, sa photo et les informations du dossier.",
      "Voir pièce par pièce ce qui est fourni, attendu, payé et restant.",
      "Agir sans quitter la page : décision, entretien, pièces, paiements, pièces numérisées.",
    ],
    steps: [
      { title: "Gérer la photo", detail: "Dans la section Personne, l'emplacement à gauche affiche la photo. « Ouvrir la caméra » ou « Galerie / Parcourir » l'ajoute ou la remplace ; « Retirer » la supprime. Sans photo, l'emplacement reste simplement vide." },
      { title: "Corriger la personne", detail: "« Modifier les informations » ouvre le formulaire d'identité, tuteur compris." },
      { title: "Mettre à jour les pièces", detail: "« Pièces » ou « Gérer les pièces » : indiquez pour chaque élément s'il est attendu, fourni, manquant ou substitué." },
      { title: "Suivre les paiements", detail: "« Finance » détaille chaque obligation : attendu, payé, reste, ainsi que les versements non affectés. Si une obligation a reçu plus que son montant, un encadré « Trop-perçu » permet de reporter la différence ou de la rembourser."},
      { title: "Archiver les scans", detail: "Dans « Pièces numérisées », indiquez la nature de la pièce, choisissez le fichier (PDF ou image, 10 Mo maximum) puis « Archiver »." },
      { title: "Suivre « À faire »", detail: "Le bas de la page liste les prochaines actions : pièces manquantes, paiements en attente, entretien, décision." },
    ],
    tips: ["La photo appartient à la personne : elle apparaît sur tous ses dossiers."],
    faq: [
      { question: "La photo ne s'affiche pas, pourquoi ?", answer: "Soit aucune photo n'a été ajoutée, soit vous êtes hors ligne : les images sont chargées depuis le serveur et demandent une connexion." },
      { question: "Quels formats de photo sont acceptés ?", answer: "JPG, PNG ou WEBP. La photo est automatiquement allégée avant l'envoi." },
      { question: "La caméra ne s'ouvre pas, que faire ?", answer: "Autorisez l'accès à la caméra quand le navigateur le demande (icône de cadenas dans la barre d'adresse). À défaut, utilisez « Galerie / Parcourir »." },
      { question: "Peut-on supprimer le dossier depuis cette page ?", answer: "Oui, avec le bouton corbeille et un motif. Le dossier est déplacé vers la corbeille, où un administrateur peut le restaurer." },
    ],
  },
  "Suppression des dossiers": {
    summary: "L'explication de ce qu'entraîne la suppression d'une demande de bourse ou d'une inscription.",
    purpose: [
      "Détailler ce qui est retiré avec un dossier : éléments, inscriptions rattachées, paiements.",
      "Rappeler ce qui est conservé : la fiche de la personne, ses autres dossiers, les référentiels.",
    ],
    steps: [
      { title: "Lire avant de confirmer", detail: "Vérifiez la liste des éléments concernés par la suppression que vous vous apprêtez à faire." },
      { title: "Revenir à la liste", detail: "Le bouton de retour vous ramène à la liste d'où vous venez ; rien n'est supprimé tant que vous n'avez pas confirmé avec un motif." },
    ],
    faq: [
      { question: "Une suppression est-elle récupérable ?", answer: "Le dossier est déplacé vers la corbeille avec son motif. Un administrateur peut le restaurer tant qu'il n'a pas été purgé." },
      { question: "Pourquoi un motif est-il exigé ?", answer: "Il garde la trace de la raison de la suppression, visible dans la corbeille et le journal d'audit." },
      { question: "Peut-on supprimer hors ligne ?", answer: "Non, la suppression demande une connexion au serveur." },
    ],
  },
  "Résumé de la journée": {
    summary: "Le récapitulatif de tout ce qui a été enregistré aujourd'hui : qui a fait quoi, sur quel dossier.",
    purpose: [
      "Faire le point en fin de journée sur les créations, modifications, paiements et suppressions.",
      "Contrôler rapidement une saisie : auteur, heure et valeurs enregistrées.",
    ],
    steps: [
      { title: "Parcourir la liste", detail: "Chaque ligne indique l'action, le dossier concerné, l'auteur et l'heure." },
      { title: "Voir le détail", detail: "Ouvrez une ligne pour afficher les valeurs saisies ou l'enregistrement supprimé." },
      { title: "Revenir", detail: "« Retour à la vue d'ensemble » ramène au tableau de bord." },
    ],
    faq: [
      { question: "Puis-je voir un autre jour ?", answer: "Cette page couvre la journée en cours. Pour une autre période, utilisez Rapports ou, pour les administrateurs, Audit." },
      { question: "Les montants affichés sont-ils des encaissements ?", answer: "Oui, lorsqu'une ligne concerne un paiement, son montant est rappelé." },
      REFRESH_FAQ,
    ],
  },
  Certificats: {
    summary: "L'édition des certificats PDF : bourse accordée et inscription réglée.",
    purpose: [
      "Produire le certificat d'attribution de bourse pour les demandes acceptées.",
      "Produire le certificat d'inscription pour les inscriptions entièrement réglées.",
    ],
    steps: [
      { title: "Choisir l'onglet", detail: "« Bourses accordées » ou « Inscriptions réglées »." },
      { title: "Trouver le dossier", detail: "Utilisez la recherche et l'ordre des dates pour retrouver la personne." },
      { title: "Générer le certificat", detail: "Le dossier et le solde sont revérifiés auprès du serveur, puis le PDF A4 est produit avec le logo et une référence IPAIM." },
    ],
    tips: ["Chaque certificat produit est inscrit dans l'historique des impressions."],
    faq: [
      { question: "Pourquoi un dossier n'apparaît-il pas ?", answer: "Une bourse doit être acceptée avec un type de bourse ; une inscription doit avoir un montant attendu entièrement payé et ne pas être abandonnée." },
      { question: "Le certificat peut-il être refait ?", answer: "Oui, autant de fois que nécessaire. Il reprend toujours les informations à jour du dossier." },
      { question: "Comment corriger un nom mal orthographié ?", answer: "Corrigez la fiche de la personne (page Personnes ou fiche du dossier), puis régénérez le certificat." },
    ],
  },
  Paiements: {
    summary: "L'enregistrement des versements, leur affectation aux obligations des dossiers et l'édition des reçus.",
    purpose: [
      "Enregistrer un paiement sur une demande de bourse ou une inscription.",
      "Affecter chaque versement à une obligation précise (frais de dépôt, frais d'inscription, échéance de bourse).",
      "Consulter l'historique des transactions, éditer un reçu et suivre les échéances en retard.",
    ],
    steps: [
      { title: "Enregistrer un paiement", detail: "Ouvrez le formulaire de paiement, choisissez le type de dossier puis le dossier, saisissez le montant et l'obligation ou l'échéance concernée." },
      { title: "Affecter un versement", detail: "Les paiements non affectés sont listés à part : « Affecter » les rattache à une obligation du même dossier, dans la limite du reste à payer." },
      { title: "Éditer un reçu", detail: "Dans l'historique, ouvrez la transaction pour afficher l'aperçu du reçu, puis téléchargez le PDF ou imprimez-le." },
      { title: "Suivre les retards", detail: "La liste des échéances en retard indique le montant attendu, payé et restant par échéance de bourse." },
      { title: "Régulariser un trop-perçu", detail: "Quand un étudiant a payé plus que le montant d'une obligation, la fenêtre « Finance » de son dossier l'affiche dans un encadré. Deux boutons : « Reporter sur une autre obligation » (l'argent reste en caisse) ou « Rembourser l'étudiant » (l'argent sort de la caisse, avec un motif et un reçu à faire signer)." },
    ],
    tips: ["Un paiement peut être partiel : le reste à payer est recalculé automatiquement."],
    faq: [
      { question: "Un étudiant a trop payé, que faire ?", answer: "Ouvrez son dossier puis « Finance ». L'encadré « Trop-perçu » propose de reporter la somme sur une autre obligation du dossier ou de la rembourser. Décidez avec l'étudiant ou son parent. On peut faire les deux : reporter une partie et rembourser le reste." },
      { question: "Comment réimprimer un reçu de remboursement ?", answer: "Dans le journal des encaissements, la ligne « Remboursement » (montant négatif) a une icône d'impression : elle rouvre le reçu. Imprimez-le en deux exemplaires, signés par l'étudiant ou son parent." },
      { question: "Que signifient les lignes « Report de trop-perçu » ?", answer: "Un report crée deux lignes : une négative sur l'obligation trop payée, une positive sur celle qui reçoit la somme. Leur total est nul : la caisse ne change pas." },
      { question: "Je me suis trompé d'obligation, comment corriger ?", answer: "Tant que le paiement est non affecté, utilisez « Affecter ». Sinon, signalez l'erreur à un administrateur : chaque correction est tracée dans l'audit." },
      { question: "Pourquoi l'échéance est-elle demandée ?", answer: "Pour un paiement d'échéance de bourse, l'échéance doit appartenir au type de bourse du dossier ; le serveur le vérifie." },
      { question: "Le reçu mentionne-t-il la situation du dossier ?", answer: "Oui : il rappelle ce qui reste à payer et à fournir à la date du reçu." },
      OFFLINE_FAQ,
    ],
  },
  Dépenses: {
    summary: "La création et le suivi des demandes de dépense, de la demande initiale jusqu'au paiement.",
    purpose: [
      "Initier une dépense avec sa justification, sa catégorie, son fournisseur et ses lignes.",
      "Joindre les pièces exigées : lettre de demande d'achat et devis.",
      "Suivre l'avancement : soumise, validée, réceptionnée, facturée, payée.",
    ],
    steps: [
      { title: "Créer la demande", detail: "« + Nouvelle demande » : objet, justification, catégorie, fournisseur et lignes (désignation, quantité, prix unitaire)." },
      { title: "Joindre les pièces", detail: "Ajoutez la lettre de demande et le devis (PDF ou image, 10 Mo maximum)." },
      { title: "Soumettre", detail: "Une fois soumise, la demande n'est plus modifiable et part en validation." },
      { title: "Suivre le circuit", detail: "Ouvrez la dépense pour voir son historique : chaque étape est horodatée et signée." },
    ],
    tips: ["Aucune dépense n'est supprimée : elle est annulée avec un motif, tant que rien n'est payé."],
    faq: [
      { question: "Ma demande est rejetée, que faire ?", answer: "Lisez le motif du rejet, corrigez la demande puis soumettez-la à nouveau : elle repart du début du circuit." },
      { question: "Pourquoi ma demande est-elle bloquée par le budget ?", answer: "Si le budget est bloquant, une demande qui dépasse le disponible de sa catégorie est refusée. Sinon elle passe « hors budget » et exige une double validation." },
      { question: "Puis-je valider ma propre demande ?", answer: "Non. Personne ne valide ni ne paie une dépense qu'il a lui-même initiée." },
      ACCESS_FAQ,
    ],
  },
  "Validation des dépenses": {
    summary: "Le contrôle et la validation des demandes de dépense avant tout engagement.",
    purpose: [
      "Examiner chaque demande soumise, ses pièces et le budget disponible.",
      "Valider ou rejeter avec un motif.",
      "Assurer la double validation au-delà du seuil fixé.",
    ],
    steps: [
      { title: "Ouvrir une demande", detail: "La liste présente les dépenses en attente de votre validation." },
      { title: "Contrôler", detail: "Vérifiez la justification, la lettre de demande, le devis et le budget restant de la catégorie." },
      { title: "Décider", detail: "Validez, ou rejetez en indiquant le motif. La validation finale émet le bon de commande et réserve le budget." },
    ],
    faq: [
      { question: "Pourquoi ne puis-je pas faire la seconde validation ?", answer: "Elle est toujours faite par une autre personne que la première, et jamais par l'initiateur." },
      { question: "À partir de quel montant faut-il deux validations ?", answer: "À partir du seuil réglé dans « Paramètres finances », ou dès qu'une dépense est hors budget." },
      { question: "Peut-on annuler une validation ?", answer: "Une dépense validée peut être annulée avec un motif tant que rien n'est payé." },
    ],
  },
  "Exécution des dépenses": {
    summary: "La suite d'une dépense validée : réception, facture et paiement.",
    purpose: [
      "Constater la livraison, enregistrer la facture puis les décaissements.",
      "Garantir que commande, livraison et facture concordent avant de payer.",
    ],
    steps: [
      { title: "Réceptionner", detail: "Enregistrez le bon de livraison et indiquez si la livraison est conforme (catégories avec livraison)." },
      { title: "Facturer", detail: "Saisissez le numéro, la date et le montant de la facture, et joignez-la." },
      { title: "Payer", detail: "Enregistrez le décaissement : montant, mode (espèces, mobile money, virement, chèque), référence et date. Les paiements partiels sont possibles." },
    ],
    tips: ["La facture ne dépasse jamais le montant validé, et les paiements ne dépassent jamais la facture."],
    faq: [
      { question: "Pourquoi le paiement est-il bloqué ?", answer: "Il faut une facture enregistrée et, si la séparation des tâches est active, que le payeur ne soit pas l'un des valideurs." },
      { question: "Une même facture peut-elle être saisie deux fois ?", answer: "Non, une facture d'un fournisseur ne s'enregistre qu'une fois." },
      { question: "Où retrouver les pièces de la dépense ?", answer: "Dans la fenêtre de la dépense : toutes les pièces jointes y sont listées et consultables." },
    ],
  },
  Budget: {
    summary: "Le suivi du budget par catégorie : voté, réservé, engagé, payé et disponible.",
    purpose: [
      "Comparer le budget voté à ce qui est engagé et réellement payé.",
      "Repérer les catégories proches du dépassement.",
    ],
    steps: [
      { title: "Choisir l'exercice", detail: "Sélectionnez l'exercice budgétaire à consulter." },
      { title: "Lire le tableau", detail: "Pour chaque catégorie : budget, réservé, engagé, payé, disponible et taux de consommation." },
      { title: "Ajuster le budget", detail: "Si vos droits le permettent, saisissez ou modifiez le montant alloué à une catégorie." },
    ],
    faq: [
      { question: "Aucun budget ne s'affiche, pourquoi ?", answer: "Aucun exercice budgétaire n'existe encore : créez-en un dans « Paramètres finances »." },
      { question: "Quelle différence entre réservé, engagé et payé ?", answer: "Réservé : demandes en cours de validation. Engagé : dépenses validées avec bon de commande. Payé : décaissements effectivement enregistrés." },
      { question: "D'où viennent les recettes affichées ?", answer: "Des paiements encaissés sur les dossiers pendant l'exercice." },
    ],
  },
  "Paramètres finances": {
    summary: "Les règles du circuit de dépense et les référentiels financiers.",
    purpose: [
      "Fixer le seuil de double validation, le caractère bloquant du budget et la séparation ordonnateur / payeur.",
      "Gérer les catégories de dépense, les fournisseurs et les exercices budgétaires.",
    ],
    steps: [
      { title: "Régler les règles", detail: "Modifiez le seuil et les options, puis « Enregistrer les règles ». Elles s'appliquent ensuite à toutes les dépenses." },
      { title: "Gérer les catégories", detail: "Ajoutez une catégorie et précisez si une livraison est exigée avant la facture." },
      { title: "Gérer les fournisseurs", detail: "« + Nouveau fournisseur » : nom, contacts et identifiant fiscal." },
      { title: "Ouvrir un exercice", detail: "Indiquez le libellé et les dates, puis « Ouvrir l'exercice »." },
    ],
    faq: [
      { question: "Que change le budget bloquant ?", answer: "Coché, une demande qui dépasse le budget de sa catégorie est refusée. Décoché, elle reste possible mais signalée hors budget, avec double validation." },
      { question: "Peut-on désactiver la séparation des tâches ?", answer: "Oui, mais seulement si l'équipe est trop réduite : elle évite qu'une même personne décide et paie." },
      { question: "Les changements s'appliquent-ils aux dépenses en cours ?", answer: "Le nombre de validations est figé à la soumission ; les nouvelles règles valent pour les demandes soumises ensuite." },
    ],
  },
  Prospects: {
    summary: "Le suivi des personnes intéressées par l'IPAIM et de leurs relances.",
    purpose: [
      "Enregistrer un prospect, sa filière souhaitée, son intention et la façon dont il a connu l'IPAIM.",
      "Tracer chaque relance et programmer la suivante.",
      "Suivre le statut : à relancer, relancé, converti ou abandonné.",
    ],
    steps: [
      { title: "Créer un prospect", detail: "« Nouveau prospect » : nom, prénom, téléphone, filière souhaitée, intention et source." },
      { title: "Relancer", detail: "Sur la ligne, enregistrez une relance : ce que la personne a dit, le nouveau statut et la date du prochain rappel." },
      { title: "Mettre à jour", detail: "« Modifier » corrige les informations ou le statut du prospect." },
      { title: "Filtrer", detail: "Combinez la recherche et le filtre de statut pour préparer vos appels." },
    ],
    faq: [
      { question: "Que faire quand un prospect s'inscrit ?", answer: "Créez sa demande de bourse ou son inscription en choisissant la personne existante, puis passez le prospect en « Converti »." },
      { question: "Où voir l'historique des relances ?", answer: "Dans la fenêtre de relance du prospect : chaque échange est daté et signé." },
      OFFLINE_FAQ,
    ],
  },
  Personnes: {
    summary: "Le répertoire de toutes les personnes connues de l'établissement.",
    purpose: [
      "Tenir une identité unique par personne, partagée par ses prospects, demandes de bourse et inscriptions.",
      "Corriger les coordonnées et consulter le parcours d'une personne.",
    ],
    steps: [
      { title: "Rechercher", detail: "Par nom, prénom, téléphone ou quartier." },
      { title: "Ajouter ou modifier", detail: "« Ajouter » crée une fiche ; l'action de modification corrige identité, naissance et tuteur." },
      { title: "Voir l'historique", detail: "L'historique présente le prospect, les demandes de bourse et les inscriptions de la personne." },
    ],
    tips: ["Avant de créer une personne, cherchez-la : un doublon disperse ses dossiers."],
    faq: [
      { question: "Que supprime la mise à la corbeille d'une personne ?", answer: "La personne et tous ses dossiers (prospect, demandes, inscriptions, paiements) partent ensemble à la corbeille, avec un motif." },
      { question: "Pourquoi la suppression est-elle refusée ?", answer: "Une personne ayant une scolarité enregistrée (classe, notes, résultats) ne peut pas être supprimée." },
      { question: "Où ajouter la photo d'un étudiant ?", answer: "Dans le formulaire de demande de bourse ou d'inscription, ou depuis la fiche du dossier." },
    ],
  },
  Recrutement: {
    summary: "Le suivi des candidatures d'enseignants et de personnel administratif.",
    purpose: [
      "Enregistrer un dossier de candidature : identité, diplôme, fonction souhaitée et pièces.",
      "Suivre le statut : déposé, entretien programmé, entretien réalisé, retenu ou refusé.",
    ],
    steps: [
      { title: "Créer le dossier", detail: "« Nouveau dossier » : informations du candidat et éléments du dossier, un par ligne." },
      { title: "Suivre", detail: "« Suivre » change le statut ; pour un entretien programmé, indiquez la date, l'équipe et vos remarques." },
      { title: "Pointer les pièces", detail: "Marquez chaque élément du dossier comme attendu, fourni ou manquant." },
    ],
    faq: [
      { question: "Que se passe-t-il quand un candidat est retenu ?", answer: "Le recrutement s'arrête à la décision. La suite (fiche de l'employé, contrat, paie) se gère dans « Personnel »." },
      { question: "Où noter le compte rendu d'entretien ?", answer: "Dans les remarques du suivi : elles sont conservées avec la candidature." },
      OFFLINE_FAQ,
    ],
  },
  Référentiels: {
    summary: "La configuration des éléments exigés dans les dossiers et des types de bourse.",
    purpose: [
      "Définir les pièces, fournitures et frais demandés selon le contexte (bourse, inscription directe) et le niveau.",
      "Définir les types de bourse, leurs frais d'inscription, leur taux de réduction et leurs échéances.",
    ],
    steps: [
      { title: "Ajouter un élément requis", detail: "Nom, catégorie (document, fourniture, frais), contexte, niveau, caractère obligatoire et montant attendu pour un frais." },
      { title: "Prévoir un substitut", detail: "Un élément peut en accepter un autre à sa place (statut « Substitué » dans les dossiers)." },
      { title: "Créer un type de bourse", detail: "Nom, frais d'inscription, taux de réduction, puis ses échéances (libellé, date, montant)." },
      { title: "Retirer un référentiel", detail: "L'icône corbeille demande un motif, puis déplace l'élément ou le type de bourse vers la corbeille. La fenêtre indique dans combien de dossiers l'élément figure." },
    ],
    tips: ["Les changements s'appliquent aux nouveaux dossiers ; les dossiers existants gardent leurs éléments."],
    faq: [
      { question: "Pourquoi ne puis-je rien modifier ?", answer: "Les référentiels ne se modifient qu'en ligne et avec un accès en modification sur cette rubrique." },
      { question: "Comment changer le montant des frais de dépôt ?", answer: "Modifiez le montant attendu de l'élément correspondant : il s'appliquera aux prochains dossiers." },
      { question: "Que se passe-t-il quand je mets un élément requis à la corbeille ?", answer: "Il est retiré du référentiel et de tous les dossiers où il figurait. Les paiements enregistrés dessus restent sur leur dossier, en « non affecté » : affectez-les à la bonne obligation depuis Paiements. Un administrateur peut restaurer l'élément depuis la corbeille." },
      { question: "Pourquoi un type de bourse refuse-t-il d'aller à la corbeille ?", answer: "Parce qu'il est déjà attribué à une demande ou qu'une de ses échéances a été payée. Attribuez d'abord un autre type aux demandes concernées." },
    ],
  },
  Synchronisation: {
    summary: "Le suivi des enregistrements faits hors ligne et de leur envoi vers le serveur.",
    purpose: [
      "Voir ce qui attend encore d'être envoyé.",
      "Comprendre et traiter un envoi en échec.",
    ],
    steps: [
      { title: "Consulter la file", detail: "« Enregistrements locaux » liste chaque saisie en attente." },
      { title: "Laisser faire", detail: "Dès que la connexion revient, l'envoi reprend automatiquement, dans l'ordre des saisies." },
      { title: "Se reconnecter si demandé", detail: "En session locale, « Se reconnecter » avec vos identifiants autorise l'envoi vers le serveur." },
    ],
    faq: [
      { question: "Mes saisies hors ligne peuvent-elles être perdues ?", answer: "Elles restent sur cet appareil tant qu'elles ne sont pas envoyées. Ne videz pas les données du navigateur et utilisez le même appareil pour synchroniser." },
      { question: "Que signifie « Tout est à jour » ?", answer: "Aucun enregistrement local n'attend : tout ce que vous avez saisi est sur le serveur." },
      { question: "Les photos et fichiers se synchronisent-ils ?", answer: "Non, ils ne sont pas mis en attente : ajoutez-les une fois la connexion revenue." },
    ],
  },
  Rapports: {
    summary: "Les états de synthèse : dossiers incomplets, retards de paiement et activité sur une période.",
    purpose: [
      "Lister les dossiers incomplets avec leurs pièces manquantes.",
      "Suivre les échéances en retard et les montants à recouvrer.",
      "Extraire l'activité d'une période pour l'analyser dans Excel.",
    ],
    steps: [
      { title: "Dossiers incomplets", detail: "Filtrez par type de dossier, ouvrez les pièces manquantes ou le dossier lui-même." },
      { title: "Paiements en retard", detail: "Chaque échéance indique l'attendu, le payé, le reste et les dossiers concernés." },
      { title: "Activité sur une période", detail: "Choisissez les dates puis exportez les paiements, demandes, inscriptions et prospects en CSV." },
    ],
    faq: [
      { question: "Comment ouvrir l'export dans Excel ?", answer: "Le fichier CSV s'ouvre directement dans Excel ; les colonnes sont séparées par des points-virgules." },
      { question: "Un dossier reste « incomplet » alors que tout est fourni ?", answer: "Vérifiez que chaque pièce obligatoire est bien au statut Fourni ou Substitué, puis actualisez." },
      REFRESH_FAQ,
    ],
  },
  Corbeille: {
    summary: "Les dossiers et référentiels supprimés, consultables et restaurables jusqu'à leur purge définitive.",
    purpose: [
      "Retrouver un dossier supprimé, son motif et l'auteur de la suppression.",
      "Restaurer un dossier supprimé par erreur ou le purger définitivement.",
    ],
    steps: [
      { title: "Consulter", detail: "Chaque entrée indique le type, la personne, le motif, l'auteur et la date." },
      { title: "Restaurer", detail: "« Restaurer » remet le dossier et ses éléments à leur place." },
      { title: "Purger", detail: "La purge efface définitivement l'entrée : cette action est irréversible." },
    ],
    faq: [
      { question: "Qui a accès à la corbeille ?", answer: "Les administrateurs uniquement." },
      { question: "Une restauration peut-elle échouer ?", answer: "Oui, si un élément lié a disparu entre-temps (par exemple la personne). Le message indique alors la cause." },
      { question: "Une purge est-elle réversible ?", answer: "Non. Après la purge, seule une sauvegarde permettrait de retrouver les données." },
    ],
  },
  Impressions: {
    summary: "L'historique de chaque document imprimé ou exporté en PDF.",
    purpose: [
      "Savoir quel document a été produit, pour quel dossier, par qui et quand.",
      "Contrôler la délivrance des reçus et certificats.",
    ],
    steps: [
      { title: "Rechercher", detail: "Filtrez par document, personne ou utilisateur." },
      { title: "Lire une ligne", detail: "Type de document, mode (impression ou PDF), dossier, référence, auteur, date et heure." },
    ],
    faq: [
      { question: "Les impressions faites hors ligne sont-elles comptées ?", answer: "Oui, elles sont déclarées dès la reconnexion." },
      { question: "Peut-on effacer une ligne de l'historique ?", answer: "Non, l'historique est conservé tel quel pour le contrôle." },
      { question: "Qui voit cette page ?", answer: "Les administrateurs uniquement." },
    ],
  },
  "Structure académique": {
    summary: "Le cadre académique : années, filières, salles, maquettes et règles de calcul.",
    purpose: [
      "Ouvrir les années académiques et tenir la liste des filières et des salles.",
      "Construire les maquettes : unités d'enseignement, matières, crédits et coefficients.",
      "Fixer les règles : poids du contrôle continu, moyenne de validation, compensation, crédits de passage.",
    ],
    steps: [
      { title: "Ouvrir l'année", detail: "Créez l'année avec le même libellé que l'année scolaire des inscriptions (ex. 2026-2027)." },
      { title: "Créer filières et salles", detail: "Ajoutez chaque filière (code et nom) et les salles disponibles." },
      { title: "Bâtir la maquette", detail: "Par filière et niveau, ajoutez les unités d'enseignement par semestre, puis leurs matières avec coefficient et volume horaire." },
      { title: "Enregistrer les règles", detail: "Réglez les paramètres de calcul puis « Enregistrer les règles »." },
    ],
    tips: ["Posez ce cadre une fois : classes, notes et délibérations s'appuient dessus."],
    faq: [
      { question: "Puis-je modifier une maquette en cours d'année ?", answer: "Oui, mais les résultats déjà clôturés restent figés : ils ne sont pas recalculés." },
      { question: "À quoi sert la note éliminatoire ?", answer: "Sous cette note, une matière ne peut pas être compensée par les autres. Laissez vide pour ne pas en appliquer." },
      ACCESS_FAQ,
    ],
  },
  "Classes et étudiants": {
    summary: "La constitution des classes, l'affectation des étudiants et le suivi de leur assiduité.",
    purpose: [
      "Créer les classes de l'année par filière, niveau et groupe.",
      "Affecter les étudiants inscrits et attribuer les cours aux enseignants.",
      "Suivre les absences par étudiant.",
    ],
    steps: [
      { title: "Créer une classe", detail: "Choisissez l'année, la filière, le niveau, le groupe et la capacité." },
      { title: "Affecter les étudiants", detail: "Onglet « Étudiants » : sélectionnez les inscrits à placer dans la classe. Le matricule est attribué à la première affectation." },
      { title: "Attribuer les cours", detail: "Onglet « Cours et enseignants » : associez un enseignant à chaque matière de la maquette." },
      { title: "Suivre l'assiduité", detail: "Onglet « Assiduité » : heures d'absence et étudiants au-delà du seuil." },
    ],
    faq: [
      { question: "Un étudiant inscrit n'apparaît pas dans la liste à affecter ?", answer: "Vérifiez que son inscription porte la même année scolaire, la même filière et le même niveau que la classe." },
      { question: "Aucune année académique n'est proposée ?", answer: "Ouvrez d'abord l'année dans « Structure académique »." },
      ACCESS_FAQ,
    ],
  },
  Enseignement: {
    summary: "L'emploi du temps des classes et le cahier de textes avec l'appel.",
    purpose: [
      "Planifier les créneaux hebdomadaires de chaque classe.",
      "Déclarer chaque séance tenue, son contenu et les absents.",
    ],
    steps: [
      { title: "Composer l'emploi du temps", detail: "Onglet « Emploi du temps » : ajoutez un créneau (cours, jour, heures, salle)." },
      { title: "Déclarer une séance", detail: "Onglet « Cahier de textes et appel » : date, durée, contenu traité, puis cochez les absents." },
      { title: "Justifier une absence", detail: "Indiquez si l'absence est justifiée et son motif." },
    ],
    tips: ["Les heures déclarées servent au calcul de la paie des enseignants vacataires."],
    faq: [
      { question: "Pourquoi déclarer chaque séance ?", answer: "C'est ce qui alimente l'assiduité des étudiants et le décompte des heures des vacataires." },
      { question: "Un cours manque dans la liste ?", answer: "Il doit d'abord être attribué à la classe dans « Classes et étudiants »." },
      ACCESS_FAQ,
    ],
  },
  Notes: {
    summary: "La création des évaluations et la saisie des notes.",
    purpose: [
      "Créer contrôles, examens et rattrapages pour chaque matière.",
      "Saisir les notes, éventuellement sous anonymat, puis les faire valider.",
    ],
    steps: [
      { title: "Créer l'évaluation", detail: "Choisissez la classe et la matière, le type, le libellé, la date et le barème." },
      { title: "Saisir les notes", detail: "Entrez la note de chaque étudiant, ou marquez-le absent (compte zéro)." },
      { title: "Faire valider", detail: "La validation verrouille les notes ; seule une personne habilitée peut rouvrir l'évaluation." },
    ],
    faq: [
      { question: "Pourquoi ne vois-je pas toutes les matières ?", answer: "Un enseignant ne voit que ses propres matières." },
      { question: "Comment fonctionne l'anonymat ?", answer: "Les copies sont corrigées sous numéro d'anonymat ; les noms ne sont rattachés qu'à la validation." },
      { question: "Je ne peux plus modifier une note, pourquoi ?", answer: "L'évaluation est validée. Demandez sa réouverture au responsable des délibérations." },
    ],
  },
  Délibérations: {
    summary: "Le calcul des résultats par classe, leur clôture et l'édition des procès-verbaux et bulletins.",
    purpose: [
      "Calculer moyennes, crédits, rangs, mentions et décisions par semestre et sur l'année.",
      "Clôturer la délibération pour figer les résultats.",
      "Éditer le procès-verbal et les bulletins.",
    ],
    steps: [
      { title: "Ouvrir la délibération", detail: "Choisissez la classe et le semestre (ou l'année)." },
      { title: "Contrôler", detail: "Vérifiez que toutes les notes sont saisies et validées, puis relisez les résultats." },
      { title: "Clôturer", detail: "Indiquez le président, les membres et les observations, puis clôturez." },
      { title: "Éditer", detail: "Téléchargez le procès-verbal et les bulletins." },
    ],
    faq: [
      { question: "Pourquoi la clôture est-elle refusée ?", answer: "Une délibération ne se clôture que lorsque toutes les notes du semestre sont saisies et validées." },
      { question: "Les résultats changent-ils après la clôture ?", answer: "Non, ils sont figés, même si la maquette évolue ensuite." },
      { question: "Un bulletin est retenu, pourquoi ?", answer: "Si le blocage des impayés est activé, bulletins et relevés sont retenus tant que la scolarité n'est pas soldée." },
    ],
  },
  "Statistiques académiques": {
    summary: "Les chiffres de l'année : effectifs, réussite, assiduité et encadrement.",
    purpose: [
      "Suivre la répartition des étudiants par filière, niveau et sexe.",
      "Mesurer la réussite par classe et préparer les déclarations au ministère.",
    ],
    steps: [
      { title: "Choisir l'année", detail: "Sélectionnez l'année académique à analyser." },
      { title: "Lire les tableaux", detail: "Répartition des étudiants, résultats par classe, inscriptions par année." },
      { title: "Exporter", detail: "« Exporter (Excel) » télécharge les chiffres." },
    ],
    faq: [
      { question: "Pourquoi les taux de réussite sont-ils vides ?", answer: "Ils sont calculés à partir des délibérations clôturées uniquement." },
      { question: "Pourquoi la répartition par sexe est-elle incomplète ?", answer: "Le sexe doit être renseigné sur la fiche de chaque personne." },
      REFRESH_FAQ,
    ],
  },
  Personnel: {
    summary: "Les dossiers du personnel : fiche, contrats, congés, absences et documents.",
    purpose: [
      "Tenir le dossier de chaque employé, enseignant ou administratif.",
      "Gérer contrats, congés et absences, qui alimentent directement la paie.",
      "Archiver les documents numérisés du dossier.",
    ],
    steps: [
      { title: "Embaucher", detail: "« + Nouvel employé » : identité, catégorie, fonction, date d'embauche et mode de paiement." },
      { title: "Ajouter un contrat", detail: "Onglet « Contrats » : type, dates, salaire de base ou taux horaire." },
      { title: "Gérer les congés", detail: "Onglet « Congés » : saisissez la demande, puis approuvez ou refusez. Le solde est tenu à jour." },
      { title: "Saisir une absence", detail: "Onglet « Absences » : date, nombre de jours, justifiée ou non." },
      { title: "Archiver un document", detail: "Onglet « Documents » : nature de la pièce et fichier (PDF ou image)." },
    ],
    faq: [
      { question: "Un employé n'apparaît pas dans la paie ?", answer: "Il lui faut un contrat actif sur le mois concerné." },
      { question: "Que signifie l'alerte de contrats ?", answer: "Elle liste les contrats qui se terminent dans les 30 jours, à renouveler ou clôturer." },
      ACCESS_FAQ,
    ],
  },
  Paie: {
    summary: "Le calcul, la validation et le versement de la paie mensuelle.",
    purpose: [
      "Calculer la paie à partir des contrats, des heures de cours déclarées et des absences.",
      "Séparer la préparation, la validation et le versement.",
      "Régler les rubriques de paie : gains, retenues et charges patronales.",
    ],
    steps: [
      { title: "Ouvrir le mois", detail: "Onglet « Paies mensuelles » : créez la période ; les bulletins sont calculés automatiquement." },
      { title: "Vérifier et ajuster", detail: "Contrôlez chaque bulletin et saisissez les montants des rubriques variables." },
      { title: "Valider", detail: "Une autre personne que le préparateur valide la paie." },
      { title: "Enregistrer le versement", detail: "Indiquez la date et le mode de paiement, puis éditez les bulletins." },
    ],
    faq: [
      { question: "Pourquoi ne puis-je pas valider la paie que j'ai préparée ?", answer: "Préparer et valider sont deux rôles distincts, tenus par deux personnes différentes." },
      { question: "Comment sont payés les vacataires ?", answer: "Au taux horaire de leur contrat, multiplié par les heures de séances déclarées dans le cahier de textes." },
      { question: "Une paie validée peut-elle être corrigée ?", answer: "Elle doit d'abord être rouverte par la personne habilitée à valider." },
    ],
  },
  Comptabilité: {
    summary: "Le journal, la balance, le grand livre, les états financiers et le plan comptable.",
    purpose: [
      "Consulter les écritures générées automatiquement par les encaissements, factures, paiements et paies.",
      "Saisir les opérations exceptionnelles à la main.",
      "Produire la balance et les états financiers.",
    ],
    steps: [
      { title: "Consulter le journal", detail: "Onglet « Journal » : recherchez et filtrez les écritures." },
      { title: "Saisir une écriture", detail: "« + Nouvelle écriture » : journal, date, libellé et lignes dont le débit égale le crédit." },
      { title: "Analyser", detail: "« Balance », « Grand livre » et « États financiers » présentent les soldes par compte et par période." },
      { title: "Tenir le plan comptable", detail: "Onglet « Plan comptable » : ajoutez les comptes nécessaires." },
    ],
    faq: [
      { question: "Dois-je saisir les encaissements des étudiants ?", answer: "Non, chaque paiement enregistré génère automatiquement son écriture." },
      { question: "Comment corriger une écriture validée ?", answer: "Elle ne se modifie pas : on l'annule par une écriture d'extourne, puis on saisit la bonne." },
      { question: "Mon écriture est refusée, pourquoi ?", answer: "Le total des débits doit être égal au total des crédits." },
    ],
  },
  Sauvegardes: {
    summary: "Les copies de sécurité de la base : création, test de restauration et restauration.",
    purpose: [
      "Vérifier que la sauvegarde quotidienne a bien eu lieu.",
      "Tester qu'une sauvegarde se restaure réellement.",
      "Restaurer en cas d'incident.",
    ],
    steps: [
      { title: "Contrôler la liste", detail: "Chaque sauvegarde indique sa date, sa taille, son statut et sa copie hors du serveur." },
      { title: "Sauvegarder maintenant", detail: "Lancez une sauvegarde manuelle avant une opération sensible." },
      { title: "Tester", detail: "« Tester » vérifie que le fichier se restaure sans toucher aux données réelles." },
      { title: "Restaurer", detail: "À n'utiliser qu'en cas d'incident : les données actuelles sont remplacées par celles de la sauvegarde." },
    ],
    tips: ["Conservez la phrase secrète de la copie externe ailleurs que sur le serveur."],
    faq: [
      { question: "À quelle fréquence tester ?", answer: "Régulièrement : une sauvegarde jamais testée n'est pas une garantie." },
      { question: "À quoi sert la copie hors du serveur ?", answer: "Si le serveur est perdu, c'est la seule copie qui survit. Elle est chiffrée." },
      { question: "Qui peut restaurer ?", answer: "Les administrateurs uniquement." },
    ],
  },
  Audit: {
    summary: "La supervision de l'activité : qui fait quoi, où, quand et avec quelles valeurs.",
    purpose: [
      "Retracer chaque action : création, modification, suppression, connexion.",
      "Suivre le temps passé par écran et l'activité de chaque utilisateur.",
    ],
    steps: [
      { title: "Choisir la période", detail: "Aujourd'hui ou une période personnalisée." },
      { title: "Filtrer", detail: "Par utilisateur, rubrique ou type d'action." },
      { title: "Ouvrir un événement", detail: "Affichez les valeurs saisies, les modifications ou l'enregistrement supprimé." },
      { title: "Voir un utilisateur", detail: "Son profil d'activité détaille son parcours récent et ses écrans." },
      { title: "Exporter", detail: "Téléchargez les événements au format CSV." },
    ],
    faq: [
      { question: "Comment est mesuré le temps actif ?", answer: "Onglet visible, avec arrêt du décompte après 5 minutes sans interaction." },
      { question: "Les valeurs saisies sont-elles enregistrées ?", answer: "Oui pour les enregistrements. Les clics ne retiennent que le libellé de l'élément, jamais une valeur saisie." },
      { question: "Qui voit l'audit ?", answer: "Les administrateurs uniquement." },
    ],
  },
  Profil: {
    summary: "Vos informations personnelles et la sécurité de votre compte.",
    purpose: [
      "Consulter votre nom, votre email et votre poste.",
      "Modifier vos informations et votre mot de passe.",
    ],
    steps: [
      { title: "Vérifier vos informations", detail: "Nom, prénom, email et poste sont affichés en haut de la page." },
      { title: "Mettre à jour", detail: "Corrigez votre nom, prénom ou email dans « Votre profil », puis « Enregistrer les modifications »." },
      { title: "Changer le mot de passe", detail: "Sous « Changer le mot de passe », saisissez l'ancien mot de passe, puis le nouveau (8 caractères minimum) et sa confirmation." },
      { title: "Se déconnecter", detail: "Le bloc « Accès sécurisé » ferme votre session sur cet appareil." },
    ],
    faq: [
      { question: "J'ai oublié mon mot de passe, que faire ?", answer: "Adressez-vous à un administrateur : lui seul gère les comptes, dans Paramètres › Utilisateurs." },
      { question: "Pourquoi suis-je arrivé ici au lieu d'une autre page ?", answer: "La page demandée n'est pas ouverte à votre poste : vous êtes redirigé vers votre profil." },
      { question: "Comment changer mon poste ?", answer: "Seul un administrateur peut modifier votre poste et vos accès." },
    ],
  },
  Paramètres: {
    summary: "Les réglages de l'application : apparence, postes et accès, utilisateurs.",
    purpose: [
      "Personnaliser couleurs, mode clair ou sombre, police et taille du texte.",
      "Définir les postes et leurs accès par rubrique.",
      "Créer et gérer les comptes des utilisateurs.",
    ],
    steps: [
      { title: "Apparence", detail: "Choisissez les couleurs de l'interface, la police et la taille du texte : le réglage est mémorisé sur cet appareil." },
      { title: "Postes et accès", detail: "Créez un poste et cochez, rubrique par rubrique, la lecture et la modification." },
      { title: "Utilisateurs", detail: "Créez un compte, attribuez-lui un poste, ou retirez un utilisateur." },
    ],
    faq: [
      { question: "Je ne vois que « Apparence », pourquoi ?", answer: "La gestion des postes et des utilisateurs est réservée aux administrateurs." },
      { question: "Un changement d'accès est-il immédiat ?", answer: "L'utilisateur concerné doit se reconnecter pour que ses nouveaux accès s'appliquent." },
      { question: "Quelle différence entre lecture et modification ?", answer: "La lecture permet de consulter une rubrique ; la modification permet d'y créer, corriger ou supprimer." },
    ],
  },
  "À propos du SGI": {
    summary: "La présentation du système de gestion intégré de l'IPAIM et de sa version.",
    purpose: [
      "Présenter l'ambition et les principes du SGI.",
      "Confirmer que vous utilisez la dernière version stable.",
    ],
    steps: [
      { title: "Lire la présentation", detail: "La page décrit les quatre principes du système." },
      { title: "Revenir", detail: "« Retour à mon espace » ramène à la vue d'ensemble." },
    ],
    faq: [
      { question: "Comment obtenir de l'aide sur un écran ?", answer: "Chaque écran a un bouton « Info sur la page », en haut à droite : il explique son rôle, son utilisation et les questions fréquentes." },
      { question: "À qui signaler un problème ?", answer: "À votre administrateur, en précisant l'écran, l'action tentée et le message affiché." },
    ],
  },
};
