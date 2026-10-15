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
import { WorklistPanel } from "@/components/worklist";
import { navigateTo, pathForView } from "@/lib/routes";
import { MyWorkPanel } from "@/components/my-work";
import { hasAccess } from "@/lib/access";
import { Work } from "@/lib/work";

const ADMISSIONS_WORK = ["prospects-a-relancer", "entretiens", "dossiers-incomplets"];

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
  refreshSignal,
  work,
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
  refreshSignal: number;
  work: Work | null;
}) {
  const canViewActivity = hasAccess(user, "dashboard");
  const cards = [
    {
      label: "Prospects actifs",
      value: summary?.prospectsActifs ?? "--",
      detail: "À relancer ou déjà relancés",
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
      detail: "Personnes ayant une demande ou une inscription",
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
  // Échelle en nombres entiers : un pas rond et quatre intervalles réguliers.
  const tickStep = Math.max(1, Math.ceil(Math.max(...trend.flatMap((item) => [item.demandes, item.inscriptions]), 1) / 4));
  const maxTrend = tickStep * 4;
  const CHART_LEFT = 44;
  const CHART_RIGHT = 740;
  const chartY = (value: number) => 142 - (value / maxTrend) * 118;
  const chartX = (index: number) => trend.length > 1 ? CHART_LEFT + 30 + (index * (CHART_RIGHT - CHART_LEFT - 60)) / (trend.length - 1) : (CHART_LEFT + CHART_RIGHT) / 2;
  const chartTicks = [0, 1, 2, 3, 4].map((index) => index * tickStep);
  const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;
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
          {canViewActivity && <button className="daily-summary-trigger" onClick={onOpenDaily}>Voir le récapitulatif de la journée <span>→</span></button>}
          {hasAccess(user, "scholarships", "edit") && <button className="primary-button compact" onClick={() => onOpen("Demandes de bourse")}>+ Nouvelle demande</button>}
        </div>
      </section>
      {/* Les tâches des admissions sont détaillées, avec les noms, juste en dessous. */}
      <MyWorkPanel work={work} hidden={canViewActivity ? ADMISSIONS_WORK : []} />
      {!canViewActivity ? null : <>
      <WorklistPanel refreshSignal={refreshSignal} />
      <section className="panel trend-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Évolution · 6 derniers mois</p><h3>Nombre de nouveaux dossiers par mois</h3><p className="trend-caption">Chaque point représente le nombre de demandes ou d&apos;inscriptions enregistrées pendant le mois.</p></div>
          <div className="trend-legend"><span className="trend-key applications-key">Demandes de bourse</span><span className="trend-key enrollments-key">Inscriptions</span></div>
        </div>
        {trend.length ? (
          <div className="trend-chart">
            <svg viewBox="0 0 760 206" role="img" aria-label="Évolution mensuelle du nombre de demandes de bourse et d'inscriptions">
              <text className="trend-axis-title" x="0" y="10">Dossiers</text>
              {chartTicks.map((tick) => (
                <g key={tick}>
                  <line x1={CHART_LEFT} y1={chartY(tick)} x2={CHART_RIGHT} y2={chartY(tick)} />
                  <text className="trend-tick" x={CHART_LEFT - 8} y={chartY(tick) + 4} textAnchor="end">{tick}</text>
                </g>
              ))}
              <polyline className="trend-line applications-line" points={trend.map((item, index) => `${chartX(index)},${chartY(item.demandes)}`).join(" ")} />
              <polyline className="trend-line enrollments-line" points={trend.map((item, index) => `${chartX(index)},${chartY(item.inscriptions)}`).join(" ")} />
              {trend.map((item, index) => (
                <g key={item.label}>
                  <circle className="trend-point applications-point" cx={chartX(index)} cy={chartY(item.demandes)} r="4"><title>{`${item.label} : ${plural(item.demandes, "demande")} de bourse`}</title></circle>
                  <circle className="trend-point enrollments-point" cx={chartX(index)} cy={chartY(item.inscriptions)} r="4"><title>{`${item.label} : ${plural(item.inscriptions, "inscription")}`}</title></circle>
                  {/* Mois et valeurs dans le même repère que les points : ils restent alignés à toute largeur. */}
                  <text className="trend-month" x={chartX(index)} y="166" textAnchor="middle">{item.label}</text>
                  <text className="trend-value applications-value" x={chartX(index)} y="183" textAnchor="middle">{plural(item.demandes, "demande")}</text>
                  <text className="trend-value enrollments-value" x={chartX(index)} y="198" textAnchor="middle">{plural(item.inscriptions, "inscription")}</text>
                </g>
              ))}
            </svg>
          </div>
        ) : <p className="empty-state">Aucune tendance disponible.</p>}
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
        <button className="text-button" onClick={() => navigateTo(`${pathForView("Rapports")}?vue=pieces`)}>
          Ouvrir le rapport des pièces manquantes <span>→</span>
        </button>
      </section>
      </>}
    </div>
  );
}
