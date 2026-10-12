"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { navigateTo, pathForDossier } from "@/lib/routes";
import { AuditChange, ChangesTable, ValuesList, flattenValues, summarizeChanges } from "@/components/audit-values";
import { DailyActivityReport } from "@/lib/types";

type Activity = DailyActivityReport["activites"][number] & {
  modifications?: AuditChange[];
  valeurs?: unknown;
  supprime?: unknown;
  dossier?: { type: "demande-bourse" | "inscription"; id: string } | null;
};

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayTime(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();
const capitalize = (value: string) => value.replace(/^./, (letter) => letter.toUpperCase());

// Une ligne qui dit ce qui a changé, sans ouvrir le détail.
function summary(activity: Activity) {
  const changes = activity.modifications ?? [];
  if (changes.length) return summarizeChanges(changes, 3);
  const values = [...flattenValues(activity.valeurs), ...flattenValues(activity.supprime)];
  return values.slice(0, 3).map(([label, value]) => `${label} : ${value}`).join(" · ") + (values.length > 3 ? ` · +${values.length - 3}` : "");
}

const hasDetail = (activity: Activity) =>
  Boolean((activity.modifications ?? []).length || flattenValues(activity.valeurs).length || flattenValues(activity.supprime).length);

export function DailySummaryPage({ onBack }: { onBack: () => void }) {
  const [date, setDate] = useState(() => localDateValue(new Date()));
  const [report, setReport] = useState<DailyActivityReport | null>(null);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [error, setError] = useState<{ request: string; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
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
  const term = normalize(search.trim());
  const activities = ((currentReport?.activites ?? []) as Activity[]).filter((activity) =>
    (!category || activity.categorie === category) &&
    (!term || normalize([activity.action, activity.detail, activity.utilisateur, activity.categorie, summary(activity)].filter(Boolean).join(" ")).includes(term)),
  );
  const filtered = Boolean(term || category);

  return (
    <div className="content-scroll daily-summary-page">
      <div className="page-intro daily-summary-intro">
        <div><p className="eyebrow">Vue d’ensemble · Activité</p><h2>Récapitulatif de la journée</h2><p>{displayDate(date)}</p></div>
        <div className="daily-summary-controls"><label>Date<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setCategory(""); setExpanded(null); }} /></label><button className="outline-button small" onClick={onBack}>Retour à la vue d’ensemble</button></div>
      </div>
      {currentError && <div className="api-error" role="alert">{currentError}</div>}
      <section className="daily-summary-banner">
        <div><p className="eyebrow">Journal d’activité</p><h3>{loading ? "Actualisation des opérations…" : `${currentReport?.total ?? 0} opération(s) enregistrée(s)`}</h3><p>Chaque ligne indique qui a fait quoi, sur quel dossier et avec quelles valeurs.</p></div>
        <span className="daily-summary-date-mark" aria-hidden="true">{date.slice(-2)}</span>
      </section>
      <section className="daily-summary-stats" aria-label="Filtrer par catégorie">
        {loading ? <div className="daily-summary-stat"><span>Opérations</span><strong>…</strong></div> : categories.length ? categories.map(([name, count]) => {
          const elements = currentReport?.elementsParCategorie?.[name] ?? count;
          return (
            <button type="button" className={`daily-summary-stat ${category === name ? "active" : ""}`} aria-pressed={category === name} key={name} onClick={() => setCategory(category === name ? "" : name)}>
              <span>{capitalize(name)}</span><strong>{elements}</strong>{elements !== count && <small>{count} opérations</small>}
            </button>
          );
        }) :<div className="daily-summary-stat"><span>Opérations</span><strong>0</strong></div>}
      </section>
      <section className="panel daily-activity-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Chronologie</p><h3>Tout ce qui a été enregistré</h3></div>
          <div className="toolbar">
            <label className="report-search certificate-search">
              <Search aria-hidden="true" focusable="false" />
              <input type="search" value={search} placeholder="Nom, action, utilisateur, valeur…" aria-label="Rechercher dans la journée" onChange={(event) => setSearch(event.target.value)} />
            </label>
            <span className="daily-activity-count">{loading ? "…" : filtered ? `${activities.length} sur ${currentReport?.total ?? 0}` : currentReport?.total ?? 0}</span>
          </div>
        </div>
        {loading ? <p className="empty-state">Chargement des activités de la journée…</p> : activities.length ? (
          <ol className="daily-activity-list">
            {activities.map((activity) => {
              const open = expanded === activity.id;
              const line = summary(activity);
              return (
                <li key={activity.id} className={`daily-activity-item ${open ? "open" : ""}`}>
                  <time dateTime={activity.date}>{displayTime(activity.date)}</time>
                  <span className="daily-activity-marker" aria-hidden="true" />
                  <div className="daily-activity-copy">
                    <div><strong>{activity.action}</strong><span>{capitalize(activity.categorie)}</span></div>
                    <p>{activity.detail}</p>
                    {line && <p className="daily-activity-summary">{line}</p>}
                    <small>{activity.utilisateur ? `Par ${activity.utilisateur}` : "Activité enregistrée"}</small>
                    <div className="daily-activity-links">
                      {hasDetail(activity) && (
                        <button type="button" className="daily-activity-toggle" aria-expanded={open} onClick={() => setExpanded(open ? null : activity.id)}>
                          {open ? "Masquer le détail" : "Voir le détail"} <ChevronDown aria-hidden="true" focusable="false" />
                        </button>
                      )}
                      {activity.dossier && <button type="button" className="daily-activity-toggle" onClick={() => navigateTo(pathForDossier(activity.dossier!))}>Ouvrir le dossier →</button>}
                    </div>
                    {open && (
                      <div className="audit-detail daily-activity-detail">
                        <ChangesTable changes={activity.modifications ?? []} />
                        <ValuesList title="Valeurs saisies" values={activity.valeurs} />
                        <ValuesList title="Enregistrement supprimé" values={activity.supprime} />
                      </div>
                    )}
                  </div>
                  {activity.montant && <strong className="daily-activity-amount">{activity.montant} F</strong>}
                </li>
              );
            })}
          </ol>
        ) : <p className="empty-state">{filtered ? "Aucune opération ne correspond à ce filtre." : "Aucune activité enregistrée pour cette date."}</p>}
      </section>
    </div>
  );
}
