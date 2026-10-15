"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { navigateTo, pathForDossier, pathForView } from "@/lib/routes";
import { Person, ViewName, formatDate, formatMoney, fullName } from "@/lib/types";

type DossierItem = { dossierType: "demande-bourse" | "inscription"; dossierId: string; personne?: Person };
type Worklist = {
  relances: { total: number; items: Array<{ id: string; personne?: Person; filiere?: string | null; rappel?: string | null; dernierEchange?: string | null }> };
  entretiens: { total: number; items: Array<DossierItem & { date?: string | null; equipe?: string | null }> };
  incomplets: { total: number; items: Array<DossierItem & { manquants: number }> };
  impayes: { total: number; montant: string; items: Array<DossierItem & { reste: string }> };
};

const dossierLabel = (item: DossierItem) => (item.dossierType === "demande-bourse" ? "Demande de bourse" : "Inscription");

function Card({ title, total, tone, empty, moreLabel, moreView, moreSection, children }: { title: string; total: number; tone?: "alert"; empty: string; moreLabel: string; moreView: ViewName; moreSection?: string; children: React.ReactNode }) {
  return (
    <article className="worklist-card">
      <header>
        <h4>{title}</h4>
        <span className={`worklist-count ${total === 0 ? "zero" : tone ?? ""}`}>{total}</span>
      </header>
      {total === 0 ? <p className="worklist-empty">{empty}</p> : <ul className="worklist-items">{children}</ul>}
      {total > 0 && <button type="button" className="worklist-more" onClick={() => navigateTo(`${pathForView(moreView)}${moreSection ? `?vue=${moreSection}` : ""}`)}>{moreLabel} →</button>}
    </article>
  );
}

function Item({ title, detail, onOpen }: { title: string; detail: string; onOpen: () => void }) {
  return <li><button type="button" className="worklist-item" onClick={onOpen}><strong>{title}</strong><small>{detail}</small></button></li>;
}

export function WorklistPanel({ refreshSignal }: { refreshSignal: number }) {
  const [worklist, setWorklist] = useState<Worklist | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void apiFetch<Worklist>("/rapports/a-faire")
      .then((result) => { if (active) { setWorklist(result); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [refreshSignal]);

  // Sans données (hors ligne avant la première synchronisation), on n'affiche rien plutôt qu'un bloc vide.
  if (!worklist) return failed ? null : <section className="worklist" aria-busy="true"><p className="eyebrow">Admissions · le détail</p><p className="worklist-empty">Chargement de votre liste de travail…</p></section>;

  const openDossier = (item: DossierItem) => navigateTo(pathForDossier({ type: item.dossierType, id: item.dossierId }));
  return (
    <section className="worklist" aria-label="Admissions : le détail">
      <p className="eyebrow">Admissions · le détail</p>
      <div className="worklist-grid">
        <Card title="Prospects à relancer" total={worklist.relances.total} empty="Aucune relance en attente." moreLabel="Voir les prospects" moreView="Prospects">
          {worklist.relances.items.map((item) => (
            <Item key={item.id} title={fullName(item.personne)} detail={item.rappel ? `Rappel prévu le ${formatDate(item.rappel)}` : item.dernierEchange ? `Dernier échange le ${formatDate(item.dernierEchange)}` : "Jamais relancé"} onOpen={() => navigateTo(pathForView("Prospects"))} />
          ))}
        </Card>
        <Card title="Entretiens sous 7 jours" total={worklist.entretiens.total} empty="Aucun entretien programmé cette semaine." moreLabel="Voir les demandes" moreView="Demandes de bourse">
          {worklist.entretiens.items.map((item) => (
            <Item key={item.dossierId} title={fullName(item.personne)} detail={[item.date ? new Date(item.date).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null, item.equipe].filter(Boolean).join(" · ")} onOpen={() => openDossier(item)} />
          ))}
        </Card>
        <Card title="Dossiers incomplets" total={worklist.incomplets.total} empty="Tous les dossiers sont complets." moreLabel="Voir le rapport" moreView="Rapports" moreSection="pieces">
          {worklist.incomplets.items.map((item) => (
            <Item key={item.dossierId} title={fullName(item.personne)} detail={`${dossierLabel(item)} · ${item.manquants} pièce${item.manquants > 1 ? "s" : ""} à fournir`} onOpen={() => openDossier(item)} />
          ))}
        </Card>
        <Card title="Restes à payer" total={worklist.impayes.total} tone="alert" empty="Aucun reste à payer." moreLabel={`${formatMoney(worklist.impayes.montant)} à recouvrer`} moreView="Paiements">
          {worklist.impayes.items.map((item) => (
            <Item key={item.dossierId} title={fullName(item.personne)} detail={`${dossierLabel(item)} · reste ${formatMoney(item.reste)}`} onOpen={() => openDossier(item)} />
          ))}
        </Card>
      </div>
    </section>
  );
}
