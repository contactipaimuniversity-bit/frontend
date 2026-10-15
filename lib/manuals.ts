import { ManualSection } from "@/lib/routes";
import { ViewName } from "@/lib/types";

export type ManualCase = {
  title: string;
  /** Qui fait l'opération (caissier, comptable...). */
  who: string;
  situation: string;
  steps: string[];
  result: string;
  open?: ViewName;
};

export type Manual = {
  /** Nom de la section du menu. */
  title: string;
  summary: string;
  /** Les écrans de la section et le rôle de chacun. */
  screens: Array<{ view: ViewName; role: string }>;
  /** Le circuit principal, étape par étape. */
  flow?: { title: string; steps: string[] };
  roles?: Array<{ role: string; tasks: string }>;
  /** Ce qu'on règle une seule fois, dans l'ordre. */
  setup: Array<{ title: string; detail: string; open?: ViewName }>;
  routine: Array<{ when: string; tasks: string[] }>;
  cases: ManualCase[];
  mistakes: Array<{ problem: string; solution: string }>;
  glossary?: Array<{ term: string; definition: string }>;
};

// Les manuels d'utilisation, un par section du menu : de la mise en place
// au travail de tous les jours, avec des cas tirés de la vie de l'établissement.
export const MANUALS: Record<ManualSection, Manual> = {
  finances: {
    title: "Finances",
    summary: "Tout l'argent de l'établissement, de l'entrée à la sortie : encaisser les étudiants, faire valider et payer les dépenses, suivre le budget et tenir la comptabilité. Ce manuel vous accompagne de A à Z, avec des cas réels.",
    screens: [
      { view: "Paiements", role: "L'argent qui entre : encaissements des étudiants, reçus, annulations, remboursements et contrôle de caisse." },
      { view: "États de besoin", role: "L'argent qui sort commence ici : chaque achat fait l'objet d'un état de besoin avec ses pièces (lettre, devis). Dans le menu, l'entrée « Dépenses » réunit trois onglets : États de besoin, À valider, À exécuter." },
      { view: "Validation des dépenses", role: "Les responsables acceptent ou refusent les états de besoin. La validation finale émet le bon de commande." },
      { view: "Exécution des dépenses", role: "Après validation : réception de la livraison, saisie de la facture, puis paiement du fournisseur." },
      { view: "Budget", role: "Le budget voté par catégorie, comparé à ce qui est réservé, engagé et réellement payé." },
      { view: "Comptabilité", role: "Le journal, la balance, le grand livre et les états financiers. Les écritures se créent seules à partir des opérations." },
      { view: "Paramètres finances", role: "Les règles du circuit (seuil, budget bloquant), les catégories, les fournisseurs et les exercices." },
    ],
    flow: {
      title: "Le circuit d'une dépense",
      steps: ["État de besoin", "Validation", "Validation finale (si besoin)", "Bon de commande", "Réception", "Facture", "Paiement", "Écriture comptable"],
    },
    roles: [
      { role: "Caissier(ère)", tasks: "Encaisse les étudiants depuis leur dossier, remet le reçu, présente sa caisse en fin de journée." },
      { role: "Demandeur", tasks: "Crée l'état de besoin, joint la lettre et le devis, le soumet." },
      { role: "Valideur", tasks: "Contrôle l'état de besoin et le budget, valide ou rejette avec un motif." },
      { role: "Valideur final", tasks: "Donne la seconde validation au-delà du seuil ou hors budget. Ce n'est jamais la même personne que le premier valideur." },
      { role: "Trésorier / payeur", tasks: "Réceptionne, enregistre la facture et paie le fournisseur." },
      { role: "Comptable", tasks: "Relit le journal, saisit les opérations exceptionnelles, rapproche banque et caisse, produit la balance et les états." },
    ],
    setup: [
      { title: "Fixer les règles du circuit", detail: "Paramètres finances › Règles. Indiquez le seuil de double validation (par exemple 500 000 F), cochez « Bloquer les demandes qui dépassent le budget » si le budget doit être strict, et laissez cochée la séparation « celui qui paie ne peut pas avoir validé ». Cliquez « Enregistrer les règles ».", open: "Paramètres finances" },
      { title: "Créer les catégories de dépense", detail: "Paramètres finances › Catégories. Exemples : Fournitures de bureau, Électricité et eau, Entretien et réparations, Matériel pédagogique, Transport et missions. Cochez « livraison requise » pour les achats de biens (le fournisseur livre avant de facturer) ; laissez décoché pour les services comme l'électricité.", open: "Paramètres finances" },
      { title: "Enregistrer les fournisseurs habituels", detail: "Paramètres finances › Fournisseurs › « + Nouveau fournisseur » : nom, téléphone, adresse et identifiant fiscal. Une librairie, la compagnie d'électricité, le garage, l'imprimeur...", open: "Paramètres finances" },
      { title: "Ouvrir l'exercice budgétaire", detail: "Paramètres finances › Exercices : libellé (ex. 2026-2027), date de début et date de fin, puis « Ouvrir l'exercice ». Sans exercice ouvert aujourd'hui, aucune dépense ne peut être soumise.", open: "Paramètres finances" },
      { title: "Saisir le budget de chaque catégorie", detail: "Budget : choisissez l'exercice, puis cliquez le crayon sur chaque catégorie et saisissez le montant voté (ex. Fournitures de bureau : 1 200 000 F).", open: "Budget" },
      { title: "Vérifier les frais demandés aux étudiants", detail: "Les montants des frais de dépôt, d'inscription et des échéances de bourse se règlent dans Référentiels. Ce sont eux qui deviennent les « obligations » à encaisser dans chaque dossier.", open: "Référentiels" },
      { title: "Contrôler le plan comptable", detail: "Comptabilité › Plan comptable : les comptes usuels sont déjà créés (571 Caisse, 521 Banques, 552 Mobile money, 401 Fournisseurs, 7061 à 7063 pour les frais des étudiants...). Ajoutez seulement ceux qui manquent.", open: "Comptabilité" },
      { title: "Donner les bons accès à chacun", detail: "Un administrateur règle les postes dans Paramètres › Postes et accès : « Paiements » pour la caisse, « Dépenses · états de besoin », « Dépenses · validation », « Dépenses · validation finale », « Dépenses · exécution et paiement », « Comptabilité ». Le droit « Paiements · annulation d'un encaissement » est à réserver à un responsable." },
    ],
    routine: [
      { when: "Chaque jour", tasks: [
        "Encaisser les étudiants depuis leur dossier (bouton « Finance » puis « Encaisser ») et remettre le reçu.",
        "Vérifier « Paiements à affecter » : aucun versement ne doit rester sans obligation.",
        "Valider les dépenses en attente et payer celles qui sont facturées.",
        "En fin de journée : « Contrôle de caisse », comparer la ligne « Espèces » de chaque caissier à l'argent remis.",
      ] },
      { when: "Chaque semaine", tasks: [
        "Ouvrir « Échéances en retard » et appeler les familles concernées.",
        "Exécution des dépenses : relancer les livraisons attendues et les factures manquantes.",
        "Jeter un œil au Budget : une catégorie au-delà de 80 % mérite une alerte à la direction.",
      ] },
      { when: "Chaque mois", tasks: [
        "Comptabilité › Journal : relire les écritures du mois et valider les écritures manuelles en brouillon.",
        "Saisir les opérations que le système ne connaît pas : frais bancaires, agios, dons, apports.",
        "Rapprocher la banque : Grand livre du compte 521 comparé au relevé bancaire, ligne par ligne.",
        "Après la paie validée et versée : vérifier les écritures « Paie du mois » et « Versement des salaires ».",
        "Éditer la balance et les états financiers en PDF pour la direction.",
      ] },
      { when: "En fin d'exercice", tasks: [
        "Vérifier qu'il ne reste ni dépense facturée non payée ni paiement à affecter.",
        "Éditer la balance, le compte de résultat et le bilan de l'exercice.",
        "Ouvrir le nouvel exercice et saisir son budget, puis clôturer l'ancien (Paramètres finances › Exercices).",
      ] },
    ],
    cases: [
      {
        title: "Encaisser les frais d'inscription d'un nouvel étudiant",
        who: "Caissier(ère)",
        situation: "Aïcha Traoré vient s'inscrire en Licence 1 Gestion. Ses frais d'inscription s'élèvent à 75 000 F. Elle paie en espèces au guichet.",
        steps: [
          "Ouvrez Inscriptions et recherchez « Traoré ». Si l'inscription n'existe pas encore, faites-la créer par la scolarité (ou créez-la si vous en avez le droit).",
          "Sur la ligne d'Aïcha, cliquez « Finance » : la fenêtre montre chaque obligation avec l'attendu, le payé et le reste.",
          "Sur la ligne « Frais d'inscription », cliquez « Encaisser ».",
          "Saisissez 75 000, choisissez le mode « Espèces » et confirmez.",
          "Le reçu s'affiche avec son numéro (RC-2026-000154 par exemple) : imprimez-le et remettez-le à Aïcha.",
        ],
        result: "Le reste à payer passe à 0 F. La comptabilité inscrit d'elle-même 75 000 F au débit de la caisse (571) et au crédit des frais d'inscription (7062).",
        open: "Inscriptions",
      },
      {
        title: "Un parent paie une partie de l'échéance par mobile money",
        who: "Caissier(ère)",
        situation: "Le père de Moussa Diallo envoie 50 000 F par mobile money pour l'échéance de janvier de la bourse (150 000 F attendus). Il réglera le reste en mars.",
        steps: [
          "Ouvrez le dossier de Moussa (Demandes de bourse ou Inscriptions, selon le dossier concerné) puis « Finance ».",
          "Sur l'échéance de janvier, cliquez « Encaisser ».",
          "Saisissez 50 000, mode « Mobile money », et indiquez la référence de la transaction si elle est demandée.",
          "Imprimez ou envoyez le reçu : il rappelle qu'il reste 100 000 F à payer sur cette échéance.",
        ],
        result: "L'échéance reste ouverte avec 100 000 F de reste. Si mars passe sans paiement, elle apparaîtra dans « Échéances en retard ». L'argent est inscrit sur le compte mobile money (552), pas dans la caisse.",
        open: "Paiements",
      },
      {
        title: "Fermer la caisse le soir",
        who: "Caissier(ère) et responsable financier",
        situation: "Il est 17 h. Deux caissiers ont travaillé aujourd'hui ; chacun remet son argent au responsable.",
        steps: [
          "Ouvrez Paiements › « Contrôle de caisse » et choisissez la date du jour.",
          "Pour chaque caissier, lisez la ligne « Espèces » : c'est le montant exact qu'il doit remettre.",
          "Comptez l'argent de chaque caissier et comparez. Les lignes « Mobile money » et « Virement » ne sont pas dans le tiroir : elles se vérifient sur le téléphone ou le relevé.",
          "En cas d'écart, ouvrez le « Journal des encaissements » : chaque ligne indique le mode et la personne qui a encaissé, ce qui permet de retrouver la ligne en cause.",
        ],
        result: "La caisse physique correspond au système. Un écart non expliqué se signale le jour même, pas en fin de mois.",
        open: "Paiements",
      },
      {
        title: "Corriger un paiement saisi sur le mauvais étudiant",
        who: "Responsable (droit « annulation d'un encaissement »)",
        situation: "Ce matin, 40 000 F ont été encaissés sur le dossier de Fatou Konaté alors que c'est Fatou Koné qui a payé.",
        steps: [
          "Ouvrez Paiements › « Journal des encaissements » et recherchez « Konaté ».",
          "Sur la ligne du paiement, cliquez l'icône d'annulation, et écrivez le motif : « Saisi sur le mauvais dossier, paiement de Fatou Koné ».",
          "Une ligne « Annulation » de −40 000 F apparaît et le paiement d'origine est marqué « Annulé » : rien n'est effacé.",
          "Ouvrez maintenant le dossier de Fatou Koné › « Finance » › « Encaisser » et saisissez le bon paiement de 40 000 F.",
          "Remettez le nouveau reçu et récupérez l'ancien si possible.",
        ],
        result: "Les deux dossiers sont justes, et l'historique montre qui a corrigé, quand et pourquoi. La comptabilité passe d'elle-même l'écriture inverse.",
        open: "Paiements",
      },
      {
        title: "Un étudiant a trop payé",
        who: "Caissier(ère) ou responsable financier",
        situation: "Ibrahim Sawadogo a payé 100 000 F de frais d'inscription au lieu de 75 000 F. Il reste 25 000 F de trop.",
        steps: [
          "Ouvrez son dossier puis « Finance » : un encadré « Trop-perçu » apparaît en haut, avec la mention « +25 000 F en trop » sur la ligne.",
          "Choix 1, il a d'autres frais à payer : cliquez « Reporter sur une autre obligation » et choisissez par exemple la première échéance de scolarité. L'argent reste dans la caisse.",
          "Choix 2, il veut récupérer son argent : cliquez « Rembourser l'étudiant », saisissez le motif et le mode, puis imprimez le reçu de remboursement en deux exemplaires, signés par l'étudiant ou son parent.",
          "On peut aussi combiner : reporter 15 000 F et rembourser 10 000 F.",
        ],
        result: "Le trop-perçu revient à 0 F. Un report ne change pas la caisse ; un remboursement fait sortir l'argent et diminue le produit en comptabilité.",
        open: "Paiements",
      },
      {
        title: "Un versement arrive sans savoir à quoi il correspond",
        who: "Caissier(ère)",
        situation: "Un virement de 60 000 F arrive pour Kadiatou Camara, sans précision. Il a été enregistré comme paiement non affecté.",
        steps: [
          "Ouvrez Paiements › « Paiements à affecter ».",
          "Appelez la famille si besoin pour savoir ce qu'elle voulait régler.",
          "Sur la ligne, cliquez « Affecter » et choisissez l'obligation du dossier : le montant ne peut pas dépasser son reste à payer.",
        ],
        result: "Le paiement disparaît de la liste à affecter et vient diminuer le reste du bon frais.",
        open: "Paiements",
      },
      {
        title: "Relancer les familles en retard de paiement",
        who: "Responsable financier",
        situation: "Nous sommes le 15 février ; plusieurs échéances de janvier ne sont pas réglées.",
        steps: [
          "Ouvrez Paiements › « Échéances en retard » : chaque échéance montre l'attendu, le payé, le reste et les dossiers concernés.",
          "Pour une liste à appeler ou à afficher, ouvrez Rapports › « Recouvrement » et exportez le PDF.",
          "Appelez les tuteurs (le numéro est dans la fiche du dossier), notez l'engagement de date pris.",
          "Si le blocage des impayés est activé, rappelez que bulletins et relevés restent retenus jusqu'au paiement.",
        ],
        result: "Le reste à recouvrer diminue au fil des encaissements ; le tableau de bord le montre dans « Reste à recouvrer ».",
        open: "Rapports",
      },
      {
        title: "Acheter des rames de papier, du début à la fin",
        who: "Demandeur, valideur, trésorier",
        situation: "Le secrétariat a besoin de 20 rames de papier A4 à 3 500 F, soit 70 000 F, chez la Librairie Le Savoir.",
        steps: [
          "Le demandeur ouvre États de besoin › « + Nouvel état de besoin » : objet « Papier A4 pour le secrétariat », justification, catégorie « Fournitures de bureau », fournisseur « Librairie Le Savoir », ligne « Rame A4 · 20 × 3 500 F ».",
          "Il joint la lettre de demande d'achat et le devis de la librairie (PDF ou photo), puis « Soumettre pour validation ».",
          "Le valideur ouvre Validation des dépenses, contrôle le devis et le budget restant de la catégorie, puis « Valider ». Le montant étant sous le seuil, une seule validation suffit : le bon de commande est émis et le budget est engagé.",
          "Le trésorier imprime le bon de commande (« Imprimer le bon de commande ») et le remet à la librairie.",
          "À la livraison : Exécution des dépenses › « À réceptionner » › « Réceptionner la livraison », avec la date et la conformité ; joignez le bon de livraison.",
          "À la réception de la facture : « Enregistrer la facture » avec son numéro, sa date et son montant (70 000 F au maximum), facture jointe.",
          "Le trésorier, qui n'a pas validé la dépense, clique « Enregistrer un paiement » : 70 000 F, mode « Espèces », date du jour.",
        ],
        result: "La dépense passe à « Payée ». Le budget « Fournitures de bureau » montre 70 000 F payés. La comptabilité contient la facture (charge 6047 / fournisseur 401) puis le règlement (401 / caisse 571).",
        open: "États de besoin",
      },
      {
        title: "Une grosse dépense qui demande deux validations",
        who: "Valideur et valideur final",
        situation: "Réparation de la toiture du bloc B : 1 800 000 F. Le seuil de double validation est fixé à 500 000 F.",
        steps: [
          "L'état de besoin est créé et soumis comme d'habitude, avec deux devis si possible.",
          "Le premier valideur la valide : elle passe en « En attente de validation finale ».",
          "Une autre personne (par exemple le directeur) ouvre Validation des dépenses et donne la « Validation finale ». Le premier valideur ne peut pas le faire à sa place.",
          "Le bon de commande est émis seulement après cette seconde validation.",
        ],
        result: "Aucune grosse dépense ne part sur la seule décision d'une personne. Le circuit est signé et daté dans l'historique de la dépense.",
        open: "Validation des dépenses",
      },
      {
        title: "L'état de besoin est rejeté : le corriger et le renvoyer",
        who: "Demandeur",
        situation: "L'état de besoin pour 5 ventilateurs a été rejeté avec le motif « Devis manquant ».",
        steps: [
          "Ouvrez États de besoin et cliquez l'état de besoin : le motif de rejet figure dans « Circuit de la dépense ».",
          "Cliquez « Reprendre pour correction », puis « Modifier / joindre les pièces » et ajoutez le devis.",
          "« Soumettre pour validation » : l'état de besoin repart au début du circuit.",
        ],
        result: "L'état de besoin est de nouveau en attente de validation, avec l'historique complet du premier rejet.",
        open: "États de besoin",
      },
      {
        title: "Payer une facture en deux fois",
        who: "Trésorier",
        situation: "L'imprimeur facture 400 000 F pour les brochures. On lui verse 250 000 F par chèque aujourd'hui et le reste le mois prochain.",
        steps: [
          "Exécution des dépenses › « À payer » › ouvrez la dépense.",
          "« Enregistrer un paiement » : modifiez le montant proposé à 250 000, mode « Chèque », numéro du chèque en référence, date du jour.",
          "La dépense passe à « Payée en partie » ; le reste de 150 000 F reste visible.",
          "Le mois suivant, refaites « Enregistrer un paiement » pour 150 000 F.",
        ],
        result: "La dépense passe à « Payée ». Les paiements ne peuvent jamais dépasser la facture. Le chèque est inscrit en banque (521), pas en caisse.",
        open: "Exécution des dépenses",
      },
      {
        title: "Préparer le budget de la nouvelle année",
        who: "Responsable financier",
        situation: "L'exercice 2026-2027 commence le 1er octobre. La direction a voté 12 000 000 F de budget de fonctionnement.",
        steps: [
          "Paramètres finances › Exercices : libellé « 2026-2027 », du 01/10/2026 au 30/09/2027, « Ouvrir l'exercice ».",
          "Budget : choisissez « 2026-2027 », puis saisissez le montant de chaque catégorie avec le crayon (Fournitures 1 200 000 F, Électricité 2 400 000 F, Entretien 3 000 000 F...).",
          "Vérifiez que le total correspond au budget voté.",
          "Quand toutes les opérations de l'ancien exercice sont terminées, clôturez-le dans Paramètres finances › Exercices.",
        ],
        result: "Les nouveaux états de besoin sont rattachés au nouvel exercice et contrôlées par rapport à son budget.",
        open: "Budget",
      },
      {
        title: "Enregistrer les frais bancaires du mois",
        who: "Comptable",
        situation: "Le relevé bancaire de mars montre 12 500 F de frais de tenue de compte, que le système ne peut pas connaître.",
        steps: [
          "Comptabilité › Journal › « + Nouvelle écriture ».",
          "Journal « Banque », date du relevé, libellé « Frais de tenue de compte mars ».",
          "Ligne 1 : compte 631 Frais bancaires, débit 12 500. Ligne 2 : compte 521 Banques, crédit 12 500.",
          "Enregistrez : l'écriture est en brouillon. Relisez-la puis « Valider ».",
        ],
        result: "Le solde du compte 521 baisse de 12 500 F et correspond de nouveau au relevé de la banque.",
        open: "Comptabilité",
      },
      {
        title: "Corriger une écriture déjà validée",
        who: "Comptable",
        situation: "Les frais bancaires ont été saisis sur le compte 638 au lieu du 631, et l'écriture est validée.",
        steps: [
          "Dans le Journal, retrouvez l'écriture et cliquez « Extourner », avec le motif « Mauvais compte de charge ».",
          "Une écriture inverse est créée : l'erreur est neutralisée sans rien effacer.",
          "Saisissez la bonne écriture (631 au débit, 521 au crédit) et validez-la.",
        ],
        result: "Les comptes sont justes et l'erreur reste lisible pour un contrôleur. Une écriture encore en brouillon, elle, se supprime simplement.",
        open: "Comptabilité",
      },
      {
        title: "Vérifier que la comptabilité correspond à l'argent réel",
        who: "Comptable",
        situation: "Fin de mois : la direction veut savoir combien il y a en caisse, en banque et sur le compte mobile money.",
        steps: [
          "Comptabilité › « États financiers », période du mois : le bloc trésorerie donne caisse, banque et mobile money.",
          "Comparez la caisse à l'argent compté, la banque au relevé, le mobile money au solde du téléphone.",
          "En cas d'écart, ouvrez le « Grand livre » du compte concerné (571, 521 ou 552) et pointez les opérations une à une.",
          "Exportez la balance en PDF pour le dossier du mois.",
        ],
        result: "Vous savez exactement d'où vient chaque franc, et vous disposez d'un état signé à présenter.",
        open: "Comptabilité",
      },
    ],
    mistakes: [
      { problem: "« Aucun exercice ouvert » : l'état de besoin ne peut pas être soumis.", solution: "Ouvrez un exercice qui couvre la date du jour dans Paramètres finances › Exercices." },
      { problem: "L'état de besoin est refusé pour dépassement de budget.", solution: "Le budget est bloquant : augmentez le budget de la catégorie (si la direction l'accepte) ou réduisez le besoin." },
      { problem: "Je ne peux pas valider ou payer une dépense.", solution: "Vous l'avez initiée, ou vous l'avez validée et la séparation des tâches est active. Demandez à un collègue : c'est voulu." },
      { problem: "Le bouton « Enregistrer un paiement » n'apparaît pas sur la dépense.", solution: "Il faut d'abord la facture, et pour une catégorie avec livraison, la réception." },
      { problem: "Un encaissement a été fait sur le mauvais dossier.", solution: "Ne le compensez pas par un faux paiement : annulez-le depuis le Journal des encaissements avec un motif, puis ressaisissez-le." },
      { problem: "Mon écriture manuelle est refusée.", solution: "Le total des débits doit être égal au total des crédits, et la date ne doit pas tomber dans un exercice clôturé." },
      { problem: "Je saisis un encaissement dans la comptabilité.", solution: "Inutile : chaque paiement d'étudiant, facture, règlement et paie génère son écriture tout seul. Une double saisie fausserait les comptes." },
      { problem: "La caisse du système ne correspond pas à l'argent compté.", solution: "Vérifiez le mode de paiement des encaissements du jour : un paiement mobile money saisi en « Espèces » fausse la caisse. Annulez et ressaisissez avec le bon mode." },
    ],
    glossary: [
      { term: "État de besoin", definition: "La demande d'achat d'un service : ce dont il a besoin, pourquoi, chez quel fournisseur et pour combien. Une fois validé, il devient une dépense engagée." },
      { term: "Obligation", definition: "Ce qu'un dossier doit payer : frais de dépôt, frais d'inscription ou échéance de bourse. Chaque paiement est rattaché à une obligation." },
      { term: "Échéance", definition: "Une tranche datée d'un type de bourse (ex. janvier : 150 000 F). Elle passe « en retard » une fois sa date dépassée sans paiement complet." },
      { term: "Paiement non affecté", definition: "Un versement reçu mais pas encore rattaché à une obligation. À traiter vite dans « Paiements à affecter »." },
      { term: "Trop-perçu", definition: "Ce qui a été payé en plus du montant d'une obligation. Il se reporte ou se rembourse." },
      { term: "Annulation", definition: "Une ligne inverse qui neutralise un encaissement saisi par erreur, sans l'effacer." },
      { term: "Réservé", definition: "Le montant des états de besoin en cours de validation : il n'est pas encore dépensé mais n'est plus disponible." },
      { term: "Engagé", definition: "Le montant des dépenses validées avec bon de commande : l'établissement s'est engagé auprès du fournisseur." },
      { term: "Bon de commande", definition: "Le document émis à la validation finale, à remettre au fournisseur. Il porte un numéro unique." },
      { term: "Séparation des tâches", definition: "Une même personne ne peut pas demander, valider et payer la même dépense." },
      { term: "Journal", definition: "Le registre où sont classées les écritures : CA Caisse, BQ Banque, MM Mobile money, AC Achats, PA Paie, OD Opérations diverses." },
      { term: "Débit / crédit", definition: "Les deux colonnes d'une écriture. Pour une entrée d'argent, la trésorerie est au débit ; pour une sortie, au crédit. Le total des deux doit être égal." },
      { term: "Extourne", definition: "Une écriture inverse qui annule une écriture validée, pour la corriger sans rien effacer." },
      { term: "Balance", definition: "La liste de tous les comptes avec leurs totaux débit, crédit et leur solde sur la période." },
      { term: "Grand livre", definition: "Toutes les opérations d'un seul compte, ligne par ligne, avec le solde après chacune." },
    ],
  },

  admissions: {
    title: "Admissions",
    summary: "Le parcours d'un futur étudiant, du premier contact jusqu'à son inscription : lycéens intéressés, prospects, demandes de bourse, inscriptions, certificats, et la fiche unique de chaque personne.",
    screens: [
      { view: "Futurs étudiants", role: "Les lycéens qui se signalent par le formulaire public. Une liste d'information, à appeler." },
      { view: "Prospects", role: "Les personnes intéressées que l'on suit et que l'on relance." },
      { view: "Demandes de bourse", role: "Les candidatures à une bourse : pièces, entretien, délibération, décision." },
      { view: "Inscriptions", role: "L'inscription d'un étudiant pour une année, directe ou après une bourse accordée." },
      { view: "Certificats", role: "Les certificats PDF de bourse accordée et d'inscription réglée." },
      { view: "Personnes", role: "Rechercher, créer, corriger une personne et voir tout son historique." },
    ],
    flow: {
      title: "Le parcours d'un futur étudiant",
      steps: ["Formulaire lycéen", "Prospect", "Demande de bourse", "Entretien", "Décision", "Inscription", "Paiement", "Certificat"],
    },
    setup: [
      { title: "Prendre le bon réflexe", detail: "Avant toute création de dossier, cherchez la personne (recherche en haut de l'écran, ou page Personnes) par nom ou téléphone : on évite ainsi les doublons.", open: "Personnes" },
      { title: "Vérifier les pièces et frais demandés", detail: "Référentiels : les documents, fournitures et frais exigés selon le contexte (bourse ou inscription directe) et le niveau. Ce sont eux qui forment la liste « Pièces » de chaque dossier.", open: "Référentiels" },
      { title: "Créer les types de bourse", detail: "Référentiels › Types de bourse : nom, frais d'inscription, taux de réduction et échéances (libellé, date, montant).", open: "Référentiels" },
      { title: "Partager le formulaire lycéen", detail: "Futurs étudiants › « Copier le lien du formulaire » : envoyez-le sur les réseaux sociaux, affichez-le avec un QR code dans les lycées partenaires.", open: "Futurs étudiants" },
    ],
    routine: [
      { when: "Chaque jour", tasks: [
        "Futurs étudiants : appeler les nouveaux lycéens, puis « Marquer contacté ».",
        "Prospects : faire les relances prévues aujourd'hui et noter la réponse.",
        "Mettre à jour les pièces reçues dans les dossiers.",
      ] },
      { when: "Chaque semaine", tasks: [
        "Programmer les entretiens des demandes complètes.",
        "Rapports › « Pièces manquantes » : relancer les dossiers incomplets.",
      ] },
      { when: "À chaque session de délibération", tasks: [
        "Passer les dossiers en délibération, décider, choisir le type de bourse des demandes acceptées.",
        "Inscrire les boursiers acceptés (« Inscription via une bourse »).",
      ] },
    ],
    cases: [
      {
        title: "Un lycéen remplit le formulaire en ligne",
        who: "Chargé(e) des admissions",
        situation: "Mariam, élève de Terminale série H2 au Lycée Municipal, s'est signalée hier soir et s'intéresse à l'Informatique de gestion.",
        steps: [
          "Ouvrez Futurs étudiants : sa fiche apparaît en tête, avec son lycée, sa classe, sa série et le téléphone de son tuteur.",
          "Cliquez le numéro du tuteur pour l'appeler depuis un téléphone, présentez l'établissement et les dates de dépôt.",
          "Cliquez « Marquer contacté ».",
          "Si la famille est vraiment intéressée, cliquez « Créer le prospect » : son identité, son tuteur et sa filière sont repris, et il apparaît dans Prospects, à relancer.",
        ],
        result: "Mariam ne figure plus dans « À contacter ». La répartition par filière aide la direction à prévoir les effectifs.",
        open: "Futurs étudiants",
      },
      {
        title: "Suivre un prospect jusqu'à son dépôt de dossier",
        who: "Chargé(e) des admissions",
        situation: "Koffi a appelé pour se renseigner sur la Licence Comptabilité. Il hésite et demande à être rappelé dans une semaine.",
        steps: [
          "Prospects › « Nouveau prospect » : nom, téléphone, filière souhaitée, intention et source (« Bouche à oreille »).",
          "Sur sa ligne, enregistrez la relance : « Rappeler après discussion avec ses parents », prochaine date dans 7 jours.",
          "Le jour venu, il confirme : créez sa demande de bourse en choisissant la personne existante.",
          "Repassez le prospect en « Converti ».",
        ],
        result: "Toute l'histoire de Koffi reste sur une seule fiche personne, de son premier appel à sa demande.",
        open: "Prospects",
      },
      {
        title: "Traiter une demande de bourse de A à Z",
        who: "Service des admissions",
        situation: "Awa Ouédraogo dépose une demande de bourse pour la Licence 1 Banque-Finance et paie 10 000 F de frais de dépôt.",
        steps: [
          "Demandes de bourse › « Nouvelle demande » : cochez « Créer une nouvelle personne », saisissez son identité, son tuteur, le niveau, la filière et son école d'origine. Prenez sa photo si possible.",
          "Cochez les pièces déjà reçues et saisissez le paiement des frais de dépôt (10 000 F) : le reçu est produit.",
          "Quand le dossier est complet : « Entretien » pour fixer la date et le jury.",
          "Après l'entretien : « Décider » › « En délibération », puis « Acceptée » en choisissant le type de bourse (ex. Bourse 50 %).",
          "Certificats › « Bourses accordées » : générez son certificat d'attribution.",
        ],
        result: "La demande est acceptée et apparaît dans la liste des bourses qu'on peut inscrire.",
        open: "Demandes de bourse",
      },
      {
        title: "Inscrire un boursier accepté",
        who: "Scolarité",
        situation: "La bourse d'Awa est acceptée. Elle revient pour s'inscrire pour l'année 2026-2027.",
        steps: [
          "Inscriptions › « Nouvelle inscription » › « Inscription via une bourse ».",
          "Choisissez la demande d'Awa : le niveau et la filière sont repris.",
          "Indiquez l'année scolaire 2026-2027, cochez les pièces fournies et encaissez le premier versement.",
          "Quand tout est fourni et payé, passez l'inscription à « Complète ».",
        ],
        result: "Awa pourra être affectée dans sa classe et recevoir son matricule. Une fois tout payé, son certificat d'inscription est disponible.",
        open: "Inscriptions",
      },
      {
        title: "Inscription directe d'un étudiant sans bourse",
        who: "Scolarité",
        situation: "Yao, titulaire du bac série F3, s'inscrit directement en BTS Électrotechnique.",
        steps: [
          "Inscriptions › « Nouvelle inscription » › « Inscription directe ».",
          "Saisissez son identité, l'année scolaire, le niveau et la filière : les pièces et frais exigés s'affichent.",
          "Cochez les pièces apportées, encaissez les frais et remettez le reçu.",
        ],
        result: "L'inscription est « En cours » jusqu'à ce que toutes les pièces soient fournies et les frais réglés.",
        open: "Inscriptions",
      },
      {
        title: "Corriger le nom mal orthographié d'un étudiant",
        who: "Scolarité",
        situation: "Le certificat de « Seydou Coulibali » doit porter « Seydou Coulibaly ».",
        steps: [
          "Personnes : recherchez « Seydou ».",
          "Cliquez l'action de modification, corrigez le nom et enregistrez.",
          "Régénérez son certificat dans Certificats.",
        ],
        result: "La correction s'applique à tous ses dossiers et à tous les documents produits ensuite.",
        open: "Personnes",
      },
      {
        title: "Retrouver tout l'historique d'un ancien étudiant",
        who: "Scolarité",
        situation: "Un ancien étudiant demande une attestation de son parcours.",
        steps: [
          "Personnes : recherchez-le par nom ou matricule.",
          "Ouvrez son historique : prospect, demandes, inscriptions ; avec un matricule, son parcours académique complet.",
          "Depuis le parcours, téléchargez le relevé cumulé en PDF.",
        ],
        result: "Toute sa scolarité est réunie en une seule page.",
        open: "Personnes",
      },
    ],
    mistakes: [
      { problem: "La même personne existe deux fois.", solution: "Cherchez toujours la personne avant d'en créer une nouvelle (nom, téléphone). Une fiche unique garde tous ses dossiers ensemble." },
      { problem: "La demande de bourse ne s'accepte pas.", solution: "Le type de bourse est obligatoire au moment d'accepter." },
      { problem: "La bourse acceptée n'est pas proposée à l'inscription.", solution: "Vérifiez que la décision est bien « Acceptée » dans Demandes de bourse." },
      { problem: "Le certificat d'inscription n'apparaît pas.", solution: "L'inscription doit être entièrement payée et ne pas être abandonnée." },
      { problem: "La suppression d'une personne est refusée.", solution: "Une personne ayant une scolarité enregistrée (classe, notes) ne peut pas être supprimée." },
    ],
    glossary: [
      { term: "Futur étudiant", definition: "Un lycéen qui s'est signalé par le formulaire public. Ce n'est pas encore une personne du répertoire." },
      { term: "Prospect", definition: "Une personne intéressée qu'on suit et qu'on relance." },
      { term: "Pièce substituée", definition: "Une pièce remplacée par une autre acceptée à sa place (prévue dans les Référentiels)." },
    ],
  },

  academique: {
    title: "Académique",
    summary: "La vie pédagogique de l'année : cadre académique, classes, emplois du temps, présences, notes sous anonymat et délibérations.",
    screens: [
      { view: "Tableau de bord académique", role: "Ce qui demande une action aujourd'hui : cours à émarger, notes à valider, absences." },
      { view: "Structure académique", role: "Années, pôles, filières, salles, maquettes et règles de calcul." },
      { view: "Classes et étudiants", role: "Les classes, l'affectation des étudiants, les cours et l'assiduité." },
      { view: "Contrôle des cartes", role: "Scanner la carte d'un étudiant à l'entrée ou à la scolarité : valable ou non, avec sa photo." },
      { view: "Enseignement", role: "Emploi du temps, cahier de textes avec l'appel, émargement des enseignants." },
      { view: "Évaluations et notes", role: "Évaluations, fiches d'anonymat, saisie et validation des notes." },
      { view: "Délibérations", role: "Calcul et clôture des résultats, procès-verbaux et bulletins." },
      { view: "Statistiques académiques", role: "Effectifs, réussite et assiduité de l'année." },
    ],
    flow: {
      title: "Une année académique",
      steps: ["Structure", "Classes", "Affectation", "Emploi du temps", "Séances et appel", "Évaluations", "Notes validées", "Délibération", "Bulletins"],
    },
    setup: [
      { title: "Ouvrir l'année académique", detail: "Structure académique › Années : même libellé que l'année des inscriptions (ex. 2026-2027).", open: "Structure académique" },
      { title: "Filières, salles et pôles", detail: "Structure académique : créez ou chargez les pôles et filières, puis les salles disponibles.", open: "Structure académique" },
      { title: "Bâtir les maquettes", detail: "Par filière et niveau : unités d'enseignement par semestre, matières, coefficients, crédits et volumes horaires.", open: "Structure académique" },
      { title: "Régler les règles de calcul", detail: "Poids du contrôle continu, moyenne de validation, compensation, note éliminatoire, seuil d'absences, anonymat obligatoire.", open: "Structure académique" },
      { title: "Créer les classes", detail: "Classes et étudiants : année, filière, niveau, groupe et capacité.", open: "Classes et étudiants" },
    ],
    routine: [
      { when: "Chaque jour", tasks: [
        "Tableau de bord académique : vérifier les cours du jour et émarger les enseignants.",
        "Faire déclarer les séances (contenu et absents) dans le cahier de textes.",
      ] },
      { when: "Chaque semaine", tasks: [
        "Suivre les étudiants en alerte d'absences.",
        "Préparer les fiches d'anonymat des épreuves de la semaine suivante.",
      ] },
      { when: "En fin de semestre", tasks: [
        "Vérifier que toutes les notes sont saisies et validées.",
        "Délibérer, clôturer et éditer procès-verbaux et bulletins.",
      ] },
    ],
    cases: [
      {
        title: "Mettre les nouveaux inscrits dans leur classe",
        who: "Scolarité",
        situation: "La Licence 1 Gestion groupe A vient d'être créée ; 42 étudiants sont inscrits en L1 Gestion pour 2026-2027.",
        steps: [
          "Classes et étudiants › ouvrez la classe › carte « Étudiants ».",
          "Sélectionnez les inscrits à placer dans le groupe A et validez.",
          "Carte « Cours et enseignants » : associez un enseignant à chaque matière de la maquette.",
        ],
        result: "Chaque étudiant reçoit son matricule à sa première affectation ; les cours sont prêts pour l'emploi du temps.",
        open: "Classes et étudiants",
      },
      {
        title: "Éditer les cartes d'étudiant de la classe",
        who: "Scolarité",
        situation: "Les 42 étudiants de la Licence 1 Gestion A sont affectés et ont leur matricule. Il faut leur remettre leur carte de l'année 2026-2027.",
        steps: [
          "Classes et étudiants › ouvrez la classe › carte « Étudiants ».",
          "Cliquez « Cartes d'étudiant (PDF) » : une carte par étudiant, avec photo, matricule, filière, niveau, année et QR code.",
          "Le PDF alterne une page de rectos et une page de versos. Imprimez en recto verso, retournement sur le bord long, sur papier cartonné.",
          "Découpez au fin contour de chaque carte, puis plastifiez si possible.",
        ],
        result: "Chaque étudiant a une carte valable jusqu'à la fin de l'année académique. Réimprimer la même carte redonne le même QR code ; chaque impression est tracée.",
        open: "Classes et étudiants",
      },
      {
        title: "Contrôler les cartes à l'entrée",
        who: "Agent d'accueil",
        situation: "Le matin, les étudiants présentent leur carte à l'entrée du campus.",
        steps: [
          "Ouvrez « Contrôle des cartes ». Le curseur est déjà dans le champ.",
          "Passez la carte devant la douchette (ou « Scanner avec la caméra »).",
          "Vert « Carte valide » : comparez la photo au porteur, puis laissez passer.",
          "Rouge (désactivée, expirée, inscription abandonnée ou code inconnu) : retenez la carte si elle est désactivée et orientez l'étudiant vers la scolarité.",
        ],
        result: "Seules les cartes IPAIM en cours de validité passent. Un QR code fabriqué ou copié ailleurs est refusé.",
        open: "Contrôle des cartes",
      },
      {
        title: "Un étudiant a perdu sa carte",
        who: "Scolarité",
        situation: "Ibrahim signale la perte de sa carte d'étudiant.",
        steps: [
          "Classes et étudiants › sa classe › Étudiants : sur sa ligne, cliquez « Nouvelle carte » et confirmez.",
          "L'ancienne carte est désactivée aussitôt ; la nouvelle porte un autre QR code.",
          "Imprimez et remettez-lui la nouvelle carte.",
        ],
        result: "Si quelqu'un présente l'ancienne carte au contrôle, elle apparaît en rouge « Carte désactivée ».",
        open: "Classes et étudiants",
      },
      {
        title: "Organiser un examen sous anonymat",
        who: "Scolarité et enseignant",
        situation: "Examen de Comptabilité générale le 12 décembre pour la L1 Gestion A.",
        steps: [
          "L'enseignant ou la scolarité crée l'évaluation : type Examen, date, barème sur 20.",
          "Quelques jours avant, la scolarité clique « Générer les fiches d'anonymat » puis « Imprimer les fiches » et les découpe.",
          "Le jour J, chaque étudiant reçoit sa fiche, détache le talon nominatif et colle le code sur sa copie.",
          "Le correcteur saisit les notes en scannant le QR code ou en tapant les quatre derniers caractères du code.",
          "La scolarité valide : les notes sont verrouillées et les noms réapparaissent.",
        ],
        result: "Le correcteur n'a jamais su à qui appartenait chaque copie ; les notes sont prêtes pour la délibération.",
        open: "Évaluations et notes",
      },
      {
        title: "Un enseignant fait un cours de rattrapage",
        who: "Scolarité",
        situation: "Le cours de mardi a été annulé ; l'enseignant le rattrape samedi matin.",
        steps: [
          "Enseignement › « Cahier de textes et appel ».",
          "Choisissez le cours et la date de samedi, cochez « Séance exceptionnelle ».",
          "Écrivez le contenu traité et cochez les absents.",
        ],
        result: "La séance est comptée dans les heures de l'enseignant (et donc dans sa paie s'il est payé à la séance).",
        open: "Enseignement",
      },
      {
        title: "Délibérer le premier semestre",
        who: "Responsable des délibérations",
        situation: "Toutes les épreuves du semestre 1 de la L1 Gestion A sont passées.",
        steps: [
          "Délibérations › choisissez la classe et le semestre 1.",
          "Vérifiez qu'aucune note ne manque ; relisez moyennes, crédits et décisions.",
          "Indiquez le président, les membres et les observations, puis clôturez.",
          "Téléchargez le procès-verbal et les bulletins.",
        ],
        result: "Les résultats sont figés. Si le blocage des impayés est actif, les bulletins des étudiants non soldés restent retenus.",
        open: "Délibérations",
      },
    ],
    mistakes: [
      { problem: "Un inscrit n'apparaît pas dans la liste à affecter.", solution: "Son inscription doit avoir la même année, la même filière et le même niveau que la classe." },
      { problem: "L'émargement est refusé.", solution: "Le cours n'a pas de créneau à cette heure-là dans l'emploi du temps. Corrigez l'emploi du temps ou déclarez une séance exceptionnelle." },
      { problem: "La délibération ne se clôture pas.", solution: "Toutes les notes du semestre doivent être saisies et validées." },
    ],
  },

  "ressources-humaines": {
    title: "Ressources humaines",
    summary: "Le personnel de l'établissement : recrutement, dossiers et contrats, pointage, émargement des enseignants et paie mensuelle.",
    screens: [
      { view: "Recrutement", role: "Les candidatures d'enseignants et d'administratifs, jusqu'à la décision." },
      { view: "Personnel", role: "Dossiers des employés, contrats, congés, pointage et émargement." },
      { view: "Paie", role: "Calcul, validation et versement de la paie du mois." },
    ],
    flow: {
      title: "Du recrutement à la paie",
      steps: ["Candidature", "Entretien", "Retenu", "Fiche employé", "Contrat", "Pointage / émargement", "Paie calculée", "Validation", "Versement"],
    },
    setup: [
      { title: "Régler les rubriques de paie", detail: "Paie › Rubriques : primes, retenues et charges patronales (CNSS, impôts) avec leurs taux.", open: "Paie" },
      { title: "Créer les fiches du personnel", detail: "Personnel › « + Nouvel employé », puis son contrat (CDI, CDD ou Vacation pour un enseignant payé à la séance).", open: "Personnel" },
      { title: "Fixer les horaires", detail: "Personnel › Pointage › « Horaires » : heures de travail attendues et tolérance de retard.", open: "Personnel" },
    ],
    routine: [
      { when: "Chaque jour", tasks: ["Pointer les arrivées et départs des administratifs.", "Émarger les enseignants sur leurs créneaux."] },
      { when: "Chaque mois", tasks: ["Créer la paie du mois, contrôler les bulletins, saisir les variables (primes, avances).", "Faire valider par une autre personne, puis enregistrer le versement."] },
      { when: "Régulièrement", tasks: ["Surveiller l'alerte des contrats qui se terminent dans les 30 jours.", "Traiter les demandes de congé."] },
    ],
    cases: [
      {
        title: "Embaucher un enseignant vacataire",
        who: "Ressources humaines",
        situation: "M. Kaboré est retenu pour enseigner l'anglais à 2 400 F la séance de 1 h 30, payé tous les deux mois.",
        steps: [
          "Recrutement : passez sa candidature à « Retenu ».",
          "Personnel › « + Nouvel employé » : identité, catégorie Enseignant, fonction, date d'embauche, mode de paiement.",
          "Onglet « Contrats » : type « Vacation », tarif 2 400 F pour 1 h 30, rythme « tous les 2 mois ».",
          "La scolarité lui attribue ses cours dans Classes et étudiants.",
        ],
        result: "Chaque séance émargée s'ajoute à ses heures ; elles lui seront versées dans la paie du deuxième mois.",
        open: "Personnel",
      },
      {
        title: "Faire la paie d'octobre",
        who: "Préparateur de paie, puis valideur",
        situation: "Fin octobre : 18 administratifs et 25 enseignants vacataires à payer.",
        steps: [
          "Paie › Paies mensuelles : créez octobre ; les bulletins se calculent seuls.",
          "Contrôlez les bulletins ; « Variables » pour une prime exceptionnelle ou une avance.",
          "Une autre personne valide la paie : les heures payées sont figées et la comptabilité enregistre la paie.",
          "Le jour du versement, indiquez la date et le mode, puis éditez les bulletins.",
        ],
        result: "Les écritures « Paie du mois » et « Versement des salaires » apparaissent dans le journal comptable.",
        open: "Paie",
      },
    ],
    mistakes: [
      { problem: "Un employé n'apparaît pas dans la paie.", solution: "Il lui faut un contrat actif sur le mois concerné." },
      { problem: "Je ne peux pas valider la paie que j'ai préparée.", solution: "C'est voulu : préparer et valider sont faits par deux personnes différentes." },
      { problem: "Un vacataire n'a pas de bulletin ce mois-ci.", solution: "Ses heures attendent leur échéance : voir « Heures de cours en attente d'échéance », ou « Payer dans cette paie »." },
    ],
  },

  pilotage: {
    title: "Pilotage",
    summary: "Suivre l'activité de l'établissement en un coup d'œil et sortir les états de synthèse pour la direction.",
    screens: [
      { view: "Vue d'ensemble", role: "Les chiffres clés, les derniers dossiers et ce qui demande votre attention." },
      { view: "Rapports", role: "Pièces manquantes, recouvrement des retards et activité d'une période, en PDF." },
    ],
    setup: [
      { title: "Vérifier vos accès", detail: "Chaque bloc de la vue d'ensemble suit vos droits : demandez à l'administrateur les rubriques dont vous avez besoin." },
    ],
    routine: [
      { when: "Chaque matin", tasks: ["Traiter « Mon travail du jour » en haut de la vue d'ensemble : chaque ligne mène à l'écran concerné.", "Lire la vue d'ensemble : encaissé, reste à recouvrer, demandes en cours.", "Ouvrir le résumé de la journée précédente si besoin."] },
      { when: "Chaque semaine", tasks: ["Rapports › Recouvrement : point sur les retards.", "Rapports › Pièces manquantes : relance des dossiers incomplets."] },
      { when: "Chaque mois", tasks: ["Rapports › Activité sur une période : rapport PDF du mois pour la direction."] },
    ],
    cases: [
      {
        title: "Préparer le point mensuel de la direction",
        who: "Direction ou assistant(e)",
        situation: "Réunion de direction le 5 novembre sur le mois d'octobre.",
        steps: [
          "Rapports › « Activité sur une période » : du 1er au 31 octobre, générez le PDF.",
          "Rapports › « Recouvrement » : exportez la liste des retards.",
          "Ajoutez les états financiers d'octobre (Comptabilité) si la direction les demande.",
        ],
        result: "Un dossier complet de trois PDF, à jour, sans aucune ressaisie.",
        open: "Rapports",
      },
    ],
    mistakes: [
      { problem: "Les chiffres ne bougent pas.", solution: "Cliquez « Actualiser » en haut à droite : ils sont calculés au chargement." },
    ],
  },

  administration: {
    title: "Administration",
    summary: "Les outils de l'administrateur : référentiels, synchronisation hors ligne, corbeille, audit, impressions et sauvegardes.",
    screens: [
      { view: "Référentiels", role: "Pièces, fournitures et frais exigés, types de bourse et échéances." },
      { view: "Synchronisation", role: "Les saisies faites hors ligne et leur envoi au serveur." },
      { view: "Corbeille", role: "Les éléments supprimés, à restaurer ou purger." },
      { view: "Audit", role: "Qui a fait quoi, quand et avec quelles valeurs." },
      { view: "Impressions", role: "L'historique de chaque document imprimé ou exporté." },
      { view: "Sauvegardes", role: "Copies de sécurité, tests de restauration et restauration." },
    ],
    setup: [
      { title: "Suivre la mise en route", detail: "Paramètres › Mise en route liste tout ce qui doit être réglé, module par module, et indique en direct ce qui est fait. Chaque ligne en orange a un bouton « Régler »." },
      { title: "Créer les postes et les comptes", detail: "Paramètres › Postes et accès : un poste par métier (caissier, comptable, scolarité...), avec lecture ou modification par rubrique. Puis Paramètres › Utilisateurs." },
      { title: "Créer le poste des agents d'accueil", detail: "Un poste « Agent d'accueil » avec le seul droit « Cartes d'étudiant · contrôle à l'entrée » : l'agent ne voit que l'écran de contrôle des cartes." },
      { title: "Configurer les référentiels", detail: "Pièces et frais par contexte et niveau, types de bourse et leurs échéances.", open: "Référentiels" },
      { title: "Vérifier les sauvegardes", detail: "Sauvegardes : contrôlez la sauvegarde quotidienne et sa copie hors du serveur, puis testez-en une.", open: "Sauvegardes" },
    ],
    routine: [
      { when: "Chaque jour", tasks: ["Vérifier que la sauvegarde de la nuit a réussi.", "Synchronisation : aucune saisie ne doit rester bloquée."] },
      { when: "Chaque semaine", tasks: ["Audit : parcourir les suppressions et annulations.", "Corbeille : traiter les éléments supprimés."] },
      { when: "Chaque mois", tasks: ["Tester une sauvegarde (« Tester »).", "Revoir les accès des personnes qui ont changé de poste."] },
    ],
    cases: [
      {
        title: "Restaurer un dossier supprimé par erreur",
        who: "Administrateur",
        situation: "Une secrétaire a supprimé la demande de bourse de Rokia Sangaré au lieu d'une autre.",
        steps: [
          "Corbeille : recherchez « Sangaré » ; lisez le motif et l'auteur.",
          "Cliquez « Restaurer ».",
          "Vérifiez dans Demandes de bourse que le dossier, ses pièces et ses paiements sont revenus.",
        ],
        result: "Le dossier est rétabli comme avant ; l'audit garde trace de la suppression et de la restauration.",
        open: "Corbeille",
      },
      {
        title: "Savoir qui a annulé un encaissement",
        who: "Administrateur",
        situation: "La comptable constate une annulation de 60 000 F qu'elle ne s'explique pas.",
        steps: [
          "Audit : choisissez la période, filtrez sur la rubrique des paiements.",
          "Ouvrez l'événement d'annulation : utilisateur, date, heure, motif et valeurs.",
        ],
        result: "Vous savez qui a agi, quand et pourquoi.",
        open: "Audit",
      },
      {
        title: "Changer le montant des frais de dépôt",
        who: "Administrateur",
        situation: "À la rentrée, les frais de dépôt passent de 10 000 F à 15 000 F.",
        steps: [
          "Référentiels › Dossiers : ouvrez l'élément « Frais de dépôt ».",
          "Modifiez le montant attendu à 15 000 F et enregistrez.",
        ],
        result: "Les nouveaux dossiers demandent 15 000 F ; les dossiers existants gardent l'ancien montant.",
        open: "Référentiels",
      },
    ],
    mistakes: [
      { problem: "Une purge a effacé un élément nécessaire.", solution: "La purge est définitive : seule une sauvegarde permet de le retrouver. Purgez avec prudence." },
      { problem: "Un utilisateur ne voit pas ses nouveaux accès.", solution: "Il doit se déconnecter et se reconnecter." },
    ],
  },
};

// Section du menu → manuel correspondant.
export const MANUAL_BY_GROUP: Record<string, ManualSection> = {
  Pilotage: "pilotage",
  Admissions: "admissions",
  Académique: "academique",
  Finances: "finances",
  "Ressources humaines": "ressources-humaines",
  Administration: "administration",
};
