"use client";

import {
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
import { AccessArea, DASHBOARD_WORKLIST_AREAS, canAccessView, hasAccess } from "@/lib/access";
import { Work } from "@/lib/work";

// Tâches des admissions détaillées, avec les noms, par la liste de travail.
const ADMISSIONS_WORK: Array<[string, AccessArea]> = [
  ["prospects-a-relancer", "dashboard-followups"],
  ["entretiens", "dashboard-interviews"],
  ["dossiers-incomplets", "dashboard-incomplete"],
];

export function DashboardHome({
  summary,
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
  user: User | null;
  loading: boolean;
  onOpen: (view: "Demandes de bourse" | "Inscriptions" | "Paiements") => void;
  onOpenDaily: () => void;
  scholarshipTypes: ScholarshipType[];
  onOpenScholarship: (typeBourseId: string) => void;
  refreshSignal: number;
  work: Work | null;
}) {
  const sees = (area: AccessArea) => hasAccess(user, area);
  const canOpenEnrollments = canAccessView(user, "Inscriptions");
  const cards = ([
    {
      area: "dashboard-prospects",
      label: "Prospects actifs",
      value: summary?.prospectsActifs ?? "--",
      detail: "À relancer ou déjà relancés",
      tone: "orange",
    },
    {
      area: "dashboard-applications",
      label: "Demandes de bourse",
      value: summary?.demandesTotal ?? "--",
      detail: "Total des dossiers déposés",
      tone: "blue",
    },
    {
      area: "dashboard-applications-open",
      label: "Demandes en cours",
      value: summary?.demandesEnCours ?? "--",
      detail: "À traiter ou en délibération",
      tone: "orange",
    },
    {
      area: "dashboard-people",
      label: "Effectif total",
      value: summary?.effectifsTotal ?? "--",
      detail: "Personnes ayant une demande ou une inscription",
      tone: "violet",
    },
    {
      area: "dashboard-enrollments",
      label: "Inscriptions",
      value: summary?.inscriptionsTotal ?? "--",
      detail: "Dossiers enregistrés",
      tone: "mint",
    },
    {
      area: "dashboard-collected",
      label: "Total encaissé",
      value: summary
        ? `${Number(summary.totalEncaisse).toLocaleString("fr-FR")} F`
        : "--",
      detail: "Tous paiements confondus",
      tone: "violet",
    },
    {
      area: "dashboard-receivables",
      label: "Reste à recouvrer",
      value: summary ? `${Number(summary.totalResteARecouvrer).toLocaleString("fr-FR")} F` : "--",
      detail: "Bourses, inscriptions et scolarité",
      tone: "orange",
    },
  ] satisfies Array<{ area: AccessArea; label: string; value: string | number; detail: string; tone: string }>).filter((card) => sees(card.area));
  const scholarshipCounts = summary?.inscriptionsParType ?? [];
  const recentApplications = summary?.dernieresDemandes ?? [];
  const recentEnrollments = summary?.dernieresInscriptions ?? [];
  // Rien d'attribué : on le dit plutôt que d'afficher une page vide.
  const nothingAssigned = !sees("dashboard-my-work") && !sees("dashboard-trend") && !cards.length && !sees("dashboard-scholarship-types") && !sees("dashboard-recent-applications") && !sees("dashboard-recent-enrollments") && !sees("dashboard-incomplete-note") && !DASHBOARD_WORKLIST_AREAS.some(sees);
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
          {sees("daily-summary") && <button className="daily-summary-trigger" onClick={onOpenDaily}>Voir le récapitulatif de la journée <span>→</span></button>}
          {hasAccess(user, "scholarships", "edit") && <button className="primary-button compact" onClick={() => onOpen("Demandes de bourse")}>+ Nouvelle demande</button>}
        </div>
      </section>
      {nothingAssigned && <p className="empty-state">Aucun élément de la vue d&apos;ensemble n&apos;est attribué à votre poste. Utilisez le menu pour accéder à vos rubriques.</p>}
      {/* Les tâches des admissions sont détaillées, avec les noms, juste en dessous. */}
      {sees("dashboard-my-work") && <MyWorkPanel work={work} hidden={ADMISSIONS_WORK.filter(([, area]) => sees(area)).map(([key]) => key)} />}
      {DASHBOARD_WORKLIST_AREAS.some(sees) && <WorklistPanel refreshSignal={refreshSignal} />}
      {sees("dashboard-trend") && <section className="panel trend-panel">
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
      </section>}
      {cards.length > 0 && <section className="stats-grid">
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
      </section>}
      {sees("dashboard-scholarship-types") && <section className="panel scholarship-type-panel">
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
                  disabled={!canOpenEnrollments}
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
      </section>}
      {(sees("dashboard-recent-applications") || sees("dashboard-recent-enrollments")) && <section className="dashboard-grid">
        {sees("dashboard-recent-applications") && <article className="panel applications-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Derniers dossiers</p>
              <h3>Demandes de bourse</h3>
            </div>
            {canAccessView(user, "Demandes de bourse") && <button
              className="text-button"
              onClick={() => onOpen("Demandes de bourse")}
            >
              Voir tout <span>→</span>
            </button>}
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
                {recentApplications.map((item) => (
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
                {!recentApplications.length && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Aucune demande à afficher.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>}
        {sees("dashboard-recent-enrollments") && <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Suivi rapide</p>
              <h3>Inscriptions récentes</h3>
            </div>
            <span className="panel-dot">●</span>
          </div>
          <div className="activity-list">
            {recentEnrollments.map((item) => (
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
            {!recentEnrollments.length && (
              <p className="empty-state">Aucune inscription à afficher.</p>
            )}
          </div>
          {canOpenEnrollments && <button
            className="outline-button"
            onClick={() => onOpen("Inscriptions")}
          >
            Gérer les inscriptions <span>→</span>
          </button>}
        </article>}
      </section>}
      {sees("dashboard-incomplete-note") && <section className="bottom-note">
        <span className="note-icon">!</span>
        <div>
          <strong>Gardez un œil sur les dossiers incomplets</strong>
          <p>
            Le rapport des pièces manquantes vous aide à prioriser les relances.
          </p>
        </div>
        {canAccessView(user, "Rapports") && <button className="text-button" onClick={() => navigateTo(`${pathForView("Rapports")}?vue=pieces`)}>
          Ouvrir le rapport des pièces manquantes <span>→</span>
        </button>}
      </section>}
    </div>
  );
}
