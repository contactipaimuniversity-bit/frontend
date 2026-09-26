"use client";

import {
  Application,
  Enrollment,
  Summary,
  formatDate,
  fullName,
  statusLabels,
} from "@/lib/types";

export function DashboardHome({
  summary,
  applications,
  enrollments,
  loading,
  onOpen,
}: {
  summary: Summary | null;
  applications: Application[];
  enrollments: Enrollment[];
  loading: boolean;
  onOpen: (view: "Demandes de bourse" | "Inscriptions" | "Paiements") => void;
}) {
  const cards = [
    {
      label: "Prospects actifs",
      value: summary?.prospectsActifs ?? "--",
      detail: "A relancer ou relances",
      tone: "orange",
    },
    {
      label: "Demandes en cours",
      value: summary?.demandesEnCours ?? "--",
      detail: "Bourses à traiter",
      tone: "blue",
    },
    {
      label: "Inscriptions",
      value: summary?.inscriptionsTotal ?? "--",
      detail: "Dossiers enregistrés",
      tone: "mint",
    },
    {
      label: "Total encaissé",
      value: summary
        ? `${Number(summary.totalEncaisse).toLocaleString("fr-FR")} F`
        : "--",
      detail: "Tous paiements confondus",
      tone: "violet",
    },
  ];
  return (
    <div className="content-scroll">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Vue générale</p>
          <h2>Bonjour, votre activité.</h2>
          <p>
            Voici ce qui se passe dans votre établissement aujourd&apos;hui.
          </p>
        </div>
        <button
          className="primary-button compact"
          onClick={() => onOpen("Demandes de bourse")}
        >
          + Nouvelle demande
        </button>
      </section>
      <section className="stats-grid">
        {cards.map((card) => (
          <article className={`stat-card ${card.tone}`} key={card.label}>
            <div className="stat-top">
              <span>{card.label}</span>
              <span className="stat-arrow">↗</span>
            </div>
            <strong>{loading && !summary ? "..." : card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel applications-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Derniers dossiers</p>
              <h3>Demandes de bourse</h3>
            </div>
            <button
              className="text-button"
              onClick={() => onOpen("Demandes de bourse")}
            >
              Voir tout <span>→</span>
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Candidat</th>
                  <th>Filière</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar">
                          {fullName(item.personne).slice(0, 1)}
                        </span>
                        {fullName(item.personne)}
                      </div>
                    </td>
                    <td>{item.filiereSouhaitee}</td>
                    <td>
                      <span
                        className={`status status-${item.statut.toLowerCase()}`}
                      >
                        {statusLabels[item.statut]}
                      </span>
                    </td>
                    <td>{formatDate(item.dateDepot)}</td>
                  </tr>
                ))}
                {!applications.length && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Aucune demande à afficher.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Suivi rapide</p>
              <h3>Inscriptions récentes</h3>
            </div>
            <span className="panel-dot">●</span>
          </div>
          <div className="activity-list">
            {enrollments.slice(0, 4).map((item) => (
              <div className="activity-item" key={item.id}>
                <span className="activity-avatar">
                  {fullName(item.personne).slice(0, 1)}
                </span>
                <div>
                  <strong>{fullName(item.personne)}</strong>
                  <p>
                    {item.filiere} · {item.anneeScolaire}
                  </p>
                </div>
                <span className="activity-date">
                  {formatDate(item.dateInscription)}
                </span>
              </div>
            ))}
            {!enrollments.length && (
              <p className="empty-state">Aucune inscription à afficher.</p>
            )}
          </div>
          <button
            className="outline-button"
            onClick={() => onOpen("Inscriptions")}
          >
            Gérer les inscriptions <span>→</span>
          </button>
        </article>
      </section>
      <section className="bottom-note">
        <span className="note-icon">!</span>
        <div>
          <strong>Gardez un œil sur les dossiers incomplets</strong>
          <p>
            Le rapport des pièces manquantes vous aide à prioriser les relances.
          </p>
        </div>
        <button className="text-button" onClick={() => onOpen("Paiements")}>
          Ouvrir les paiements <span>→</span>
        </button>
      </section>
    </div>
  );
}
