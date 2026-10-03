"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DailyActivityReport } from "@/lib/types";

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function DailySummaryPage({ onBack }: { onBack: () => void }) {
  const [date, setDate] = useState(() => localDateValue(new Date()));
  const [report, setReport] = useState<DailyActivityReport | null>(null);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [error, setError] = useState<{ request: string; message: string } | null>(null);
  const requestKey = `daily-recap:${date}`;
  const loading = loadedRequest !== requestKey;
  const currentReport = report?.date === date ? report : null;
  const currentError = error?.request === requestKey ? error.message : "";

  useEffect(() => {
    let active = true;
    void apiFetch<DailyActivityReport>(`/rapports/activite-journee?date=${encodeURIComponent(date)}`)
      .then((result) => {
        if (active) {
          setReport(result);
          setLoadedRequest(requestKey);
        }
      })
      .catch((failure) => {
        if (active) {
          setError({ request: requestKey, message: failure instanceof Error ? failure.message : "Le récapitulatif est indisponible." });
          setLoadedRequest(requestKey);
        }
      });
    return () => { active = false; };
  }, [date, requestKey]);

  const categories = Object.entries(currentReport?.parCategorie ?? {}).sort((left, right) => right[1] - left[1]);

  return (
    <div className="content-scroll daily-summary-page">
      <div className="page-intro daily-summary-intro">
        <div><p className="eyebrow">Vue d’ensemble · Activité</p><h2>Récapitulatif de la journée</h2><p>{displayDate(date)}</p></div>
        <div className="daily-summary-controls"><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="outline-button small" onClick={onBack}>Retour à la vue d’ensemble</button></div>
      </div>
      {currentError && <div className="api-error" role="alert">{currentError}</div>}
      <section className="daily-summary-banner">
        <div><p className="eyebrow">Journal d’activité</p><h3>{loading ? "Actualisation des opérations…" : `${currentReport?.total ?? 0} opération(s) enregistrée(s)`}</h3><p>Les événements sont classés du plus récent au plus ancien.</p></div>
        <span className="daily-summary-date-mark" aria-hidden="true">{date.slice(-2)}</span>
      </section>
      <section className="daily-summary-stats" aria-label="Nombre d'opérations par catégorie">
        {loading ? <div className="daily-summary-stat"><span>Opérations</span><strong>…</strong></div> : categories.length ? categories.map(([category, count]) => <div className="daily-summary-stat" key={category}><span>{category}</span><strong>{count}</strong></div>) : <div className="daily-summary-stat"><span>Opérations</span><strong>0</strong></div>}
      </section>
      <section className="panel daily-activity-panel">
        <div className="panel-heading"><div><p className="eyebrow">Chronologie</p><h3>Tout ce qui a été enregistré</h3></div><span className="daily-activity-count">{loading ? "…" : currentReport?.total ?? 0}</span></div>
        {loading ? <p className="empty-state">Chargement des activités de la journée…</p> : currentReport?.activites.length ? (
          <ol className="daily-activity-list">
            {currentReport.activites.map((activity) => (
              <li key={activity.id} className="daily-activity-item">
                <time dateTime={activity.date}>{displayTime(activity.date)}</time>
                <span className="daily-activity-marker" aria-hidden="true" />
                <div className="daily-activity-copy"><div><strong>{activity.action}</strong><span>{activity.categorie}</span></div><p>{activity.detail}</p><small>{activity.utilisateur ? `Par ${activity.utilisateur}` : "Activité enregistrée"}</small></div>
                {activity.montant && <strong className="daily-activity-amount">{activity.montant} F</strong>}
              </li>
            ))}
          </ol>
        ) : <div className="daily-activity-empty"><span aria-hidden="true">✓</span><h3>Aucune activité pour cette date</h3><p>Les opérations apparaîtront ici au fil de la journée.</p></div>}
      </section>
      <p className="daily-summary-footnote">Le journal des modifications est conservé à partir de sa mise en service; les créations antérieures sont reconstituées à partir des dates enregistrées dans les dossiers.</p>
    </div>
  );
}