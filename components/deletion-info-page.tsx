"use client";

export function DeletionInfoPage({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Action définitive</p>
          <h2>Comprendre la suppression</h2>
          <p>Prenez le temps de vérifier les conséquences avant de confirmer.</p>
        </div>
        <button className="secondary-button" onClick={onBack}>
          Retour à la liste
        </button>
      </div>
      <section className="panel full-panel deletion-info-page">
        <h3>Demande de bourse</h3>
        <p>La suppression d’une demande efface définitivement :</p>
        <ul>
          <li>la demande et les éléments de son dossier ;</li>
          <li>les inscriptions qui lui sont rattachées, avec leurs éléments de dossier ;</li>
          <li>les paiements enregistrés pour la demande, ses inscriptions et leurs éléments.</li>
        </ul>

        <h3>Inscription</h3>
        <p>La suppression d’une inscription efface définitivement :</p>
        <ul>
          <li>l’inscription et les éléments de son dossier ;</li>
          <li>les paiements enregistrés pour cette inscription et ses éléments.</li>
        </ul>
        <p>La demande de bourse liée, si elle existe, n’est pas supprimée.</p>

        <h3>Données conservées</h3>
        <p>
          La fiche de la personne, les autres dossiers de cette personne et les référentiels
          partagés sont conservés. La suppression n’est exécutée que lorsque vous la confirmez
          et nécessite une connexion au serveur.
        </p>
        <button className="danger-solid-button" onClick={onBack}>
          J’ai compris, retour à la liste
        </button>
      </section>
    </div>
  );
}