"use client";

import {
  Application,
  Enrollment,
  Summary,
  ScholarshipType,
  User,
  formatDate,
  fullName,
  statusLabels,
} from "@/lib/types";

export function DashboardHome({
  summary,
  applications,
  enrollments,
  user,
  loading,
  onOpen,
  onOpenDaily,
  scholarshipTypes,
  onOpenScholarship,
}: {
  summary: Summary | null;
  applications: Application[];
  enrollments: Enrollment[];
  user: User | null;
  loading: boolean;
  onOpen: (view: "Demandes de bourse" | "Inscriptions" | "Paiements") => void;
  onOpenDaily: () => void;
  scholarshipTypes: ScholarshipType[];
  onOpenScholarship: (typeBourseId: string) => void;
}) {
  const cards = [
    {
      label: "Prospects actifs",
      value: summary?.prospectsActifs ?? "--",
      detail: "A relancer ou relances",
      tone: "orange",
    },
    {
      label: "Demandes de bourse",
      value: summary?.demandesTotal ?? "--",
      detail: "Total des dossiers déposés",
      tone: "blue",
    },
    {
      label: "Demandes en cours",
      value: summary?.demandesEnCours ?? "--",
      detail: "À traiter ou en délibération",
      tone: "orange",
    },
    {
      label: "Effectif total",
      value: summary?.effectifsTotal ?? "--",
      detail: "Demandes + inscriptions",
      tone: "violet",
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
    {
      label: "Reste à recouvrer",
      value: summary ? `${Number(summary.totalResteARecouvrer).toLocaleString("fr-FR")} F` : "--",
      detail: "Bourses + inscriptions",
      tone: "orange",
    },
  ];
  const scholarshipCounts = summary?.inscriptionsParType ?? [];
    const displayedScholarshipTypes = scholarshipTypes.length
      ? scholarshipTypes
      : scholarshipCounts.flatMap((item) => item.typeBourseId ? [{ id: item.typeBourseId, nom: item.typeBourse }] : []);
  const trend = summary?.tendance ?? [];
  const maxTrend = Math.max(1, ...trend.flatMap((item) => [item.demandes, item.inscriptions]));
  const chartY = (value: number) => 142 - (value / maxTrend) * 118;
  const chartTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxTrend * ratio));
  return (
    <div className="content-scroll">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Vue générale</p>
          <h2>Bonjour {user ? `${user.prenom ? `${user.prenom} ` : ""}${user.nom}` : "votre équipe"}, votre activité.</h2>
          <p>
            Voici ce qui se passe dans votre établissement aujourd&apos;hui.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="daily-summary-trigger" onClick={onOpenDaily}>Voir le récapitulatif de la journée <span>→</span></button>
          <button className="primary-button compact" onClick={() => onOpen("Demandes de bourse")}>+ Nouvelle demande</button>
        </div>
      </section>
      <section className="panel trend-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Évolution · 6 derniers mois</p><h3>Nombre de nouveaux dossiers par mois</h3><p className="trend-caption">Chaque point représente le nombre de demandes ou d&apos;inscriptions enregistrées pendant le mois.</p></div>
          <div className="trend-legend"><span className="trend-key applications-key">Demandes de bourse</span><span className="trend-key enrollments-key">Inscriptions</span></div>
        </div>
        {trend.length ? <div className="trend-chart"><svg viewBox="0 0 540 190" role="img" aria-label="Évolution mensuelle du nombre de demandes de bourse et d'inscriptions"><text className="trend-axis-title" x="0" y="10">Dossiers</text>{chartTicks.map((tick, index) => { const y = 142 - index * 29.5; return <g key={`${tick}-${index}`}><line x1="34" y1={y} x2="530" y2={y} /><text className="trend-tick" x="27" y={y + 4} textAnchor="end">{tick}</text></g>; })}<polyline className="trend-line applications-line" points={trend.map((item, index) => `${34 + index * 99.2},${chartY(item.demandes)}`).join(" ")} /><polyline className="trend-line enrollments-line" points={trend.map((item, index) => `${34 + index * 99.2},${chartY(item.inscriptions)}`).join(" ")} />{trend.map((item, index) => <g key={item.label}><circle className="trend-point applications-point" cx={34 + index * 99.2} cy={chartY(item.demandes)} r="4"><title>{`${item.label} : ${item.demandes} demande(s) de bourse`}</title></circle><circle className="trend-point enrollments-point" cx={34 + index * 99.2} cy={chartY(item.inscriptions)} r="4"><title>{`${item.label} : ${item.inscriptions} inscription(s)`}</title></circle><text className="trend-month" x={34 + index * 99.2} y="166" textAnchor="middle">{item.label}</text></g>)}</svg><div className="trend-counts">{trend.map((item) => <div key={item.label}><strong>{item.demandes} demande(s)</strong><span>{item.inscriptions} inscription(s)</span></div>)}</div></div> : <p className="empty-state">Aucune tendance disponible.</p>}
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
      <section className="panel scholarship-type-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Répartition des étudiants</p>
            <h3>Effectifs par type de bourse</h3>
          </div>
        </div>
          {displayedScholarshipTypes.length ? (
          <div className="scholarship-type-grid">
              {displayedScholarshipTypes.map((type) => {
              const count = scholarshipCounts.find((item) => item.typeBourseId === type.id);
              const inscrits = count?.inscrits ?? count?.total ?? 0;
              const acceptesEnAttente = count?.acceptesEnAttente ?? 0;
              return (
                <button
                  className="scholarship-type-card"
                  key={type.id}
                  onClick={() => onOpenScholarship(type.id)}
                  aria-label={`${type.nom} : ${inscrits} inscrit(s), ${acceptesEnAttente} accepté(s) en attente d'inscription`}
                >
                  <span>{type.nom}</span>
                  <div className="scholarship-type-metrics">
                    <div><strong>{loading && !summary ? "..." : inscrits}</strong><small>{inscrits === 1 ? "inscrit" : "inscrits"}</small></div>
                    <div><strong>{loading && !summary ? "..." : acceptesEnAttente}</strong><small>acceptés · en attente d’inscription</small></div>
                  </div>
                  <span className="scholarship-card-arrow" aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">Aucun type de bourse n&apos;est configuré dans les référentiels.</p>
        )}
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
