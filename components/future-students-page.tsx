"use client";

import { useState } from "react";
import { Copy, ExternalLink, GraduationCap, PhoneCall, School, UsersRound } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { tablePdf } from "@/lib/pdf-docs";
import { User, formatDate } from "@/lib/types";
import { Badge, Empty, PageBar, PageIntro, Panel, send, useAction, useLoad } from "@/components/ui-kit";

type FutureStudent = {
  id: string;
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  telephone?: string | null;
  ecole: string;
  classe: string;
  serie: string;
  tuteurNom: string;
  tuteurPrenom: string;
  tuteurTelephone: string;
  filiereSouhaitee: string;
  dateEnregistrement: string;
  contacte: boolean;
};
type Page = { data: FutureStudent[]; meta: { page: number; limit: number; total: number; totalPages: number } };
type Summary = { total: number; semaine: number; aContacter: number; filles: number; parFiliere: Array<{ filiere: string; total: number }>; ecoles: number; parEcole: Array<{ ecole: string; total: number }> };

const FORM_PATH = "/enregistrements";
const age = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

// Lycéens qui se sont signalés par le formulaire public : une liste d'information,
// sans lien avec les prospects, les demandes de bourse ni les inscriptions.
export function FutureStudentsPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const canEdit = hasAccess(user, "prospects", "edit");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("");
  const [contacted, setContacted] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), limit: "50", ...(search ? { q: search } : {}), ...(program ? { filiere: program } : {}), ...(contacted ? { contacte: contacted } : {}) }).toString();
  const list = useLoad<Page>(`/futurs-etudiants?${query}`, refreshSignal);
  const summary = useLoad<Summary>("/futurs-etudiants/synthese", refreshSignal);
  const action = useAction();
  const stats = summary.data;
  const link = typeof window === "undefined" ? FORM_PATH : `${window.location.origin}${FORM_PATH}`;
  const reload = () => { list.reload(); summary.reload(); };
  const filter = (apply: () => void) => { apply(); setPage(1); };
  const copy = () =>
    action.run(async () => {
      await navigator.clipboard.writeText(link);
      toast("Lien du formulaire copié : vous pouvez le partager aux lycéens.");
    });
  const mark = (item: FutureStudent) =>
    action.run(async () => {
      await send(`/futurs-etudiants/${item.id}`, "PATCH", { contacte: !item.contacte }, true);
      reload();
    });
  const remove = async (item: FutureStudent) => {
    if (!(await askConfirm({ title: `Supprimer la fiche de ${item.prenom} ${item.nom} ?`, message: "La fiche est retirée définitivement de la liste. À réserver aux envois fantaisistes ou en double.", confirmLabel: "Supprimer", danger: true }))) return;
    void action.run(async () => { await send(`/futurs-etudiants/${item.id}`, "DELETE", undefined, true); toast("Fiche supprimée."); reload(); });
  };
  // Toute la sélection courante, pas seulement la page affichée.
  const exportPdf = () =>
    action.run(async () => {
      const all = await apiFetch<Page>(`/futurs-etudiants?${new URLSearchParams({ page: "1", limit: "200", ...(search ? { q: search } : {}), ...(program ? { filiere: program } : {}), ...(contacted ? { contacte: contacted } : {}) }).toString()}`, { skipCache: true });
      const rows = all.data;
      await tablePdf({
        title: "FUTURS ÉTUDIANTS",
        subtitle: `${rows.length} lycéen(s)${all.meta.total > rows.length ? ` sur ${all.meta.total} (affinez la sélection pour les suivants)` : ""}${program ? ` · ${program}` : ""}`,
        fileName: "futurs-etudiants.pdf",
        columns: [{ label: "Élève", width: 52 }, { label: "Né(e) le", width: 24 }, { label: "Établissement", width: 55 }, { label: "Classe · série", width: 30 }, { label: "Tuteur", width: 46 }, { label: "Téléphone", width: 26 }, { label: "Filière souhaitée", width: 34 }],
        rows: rows.map((item) => [`${item.nom} ${item.prenom} (${item.sexe})`, formatDate(item.dateNaissance), item.ecole, `${item.classe} · ${item.serie}`, `${item.tuteurNom} ${item.tuteurPrenom}`, item.tuteurTelephone, item.filiereSouhaitee]),
      });
    });
  const top = stats?.parFiliere[0];
  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Admissions" title="Futurs étudiants" text="Les lycéens qui se sont signalés par le formulaire public. Une liste d'information : elle ne crée ni personne ni dossier.">
        <button className="outline-button small" disabled={action.busy} onClick={() => void copy()}><Copy size={15} aria-hidden="true" /> Copier le lien du formulaire</button>
        <a className="outline-button small" href={FORM_PATH} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> Voir le formulaire</a>
      </PageIntro>
      {(list.error || summary.error || action.error) && <p className="form-error">{action.error || list.error || summary.error}</p>}
      <div className="stats-grid">
        <article className="stat-card blue"><span><UsersRound size={15} aria-hidden="true" /> Lycéens enregistrés</span><strong>{stats?.total ?? "…"}</strong><p>{stats ? `${stats.semaine} sur les 7 derniers jours · ${stats.filles} fille(s)` : "depuis l'ouverture du formulaire"}</p></article>
        <article className={`stat-card ${stats?.aContacter ? "orange" : "mint"}`}><span><PhoneCall size={15} aria-hidden="true" /> À contacter</span><strong>{stats?.aContacter ?? "…"}</strong><p>fiche(s) pas encore marquée(s) « contacté »</p></article>
        <article className="stat-card violet"><span><GraduationCap size={15} aria-hidden="true" /> Filière la plus demandée</span><strong>{top ? top.total : "…"}</strong><p>{top ? top.filiere : "aucune réponse pour l'instant"}</p></article>
      </div>
      {Boolean(stats?.parFiliere.length) && (
        <Panel eyebrow="Répartition" title="Ce que les lycéens veulent étudier" subtitle={`${stats?.ecoles ?? 0} établissement(s) d'origine. Cliquez une filière pour filtrer la liste.`}>
          <div className="wish-bars">
            {stats?.parFiliere.map((item) => (
              <button type="button" key={item.filiere} className={program === item.filiere ? "active" : ""} aria-pressed={program === item.filiere} onClick={() => filter(() => setProgram(program === item.filiere ? "" : item.filiere))}>
                <span>{item.filiere}</span>
                <span className="wish-bar"><span style={{ width: `${Math.max(4, Math.round((item.total / (stats.total || 1)) * 100))}%` }} /></span>
                <strong>{item.total}</strong>
              </button>
            ))}
          </div>
          {Boolean(stats?.parEcole.length) && <p className="panel-subtitle"><School size={14} aria-hidden="true" /> Établissements les plus représentés : {stats?.parEcole.map((item) => `${item.ecole} (${item.total})`).join(" · ")}</p>}
        </Panel>
      )}
      <Panel
        eyebrow="Liste"
        title={`${list.data?.meta.total ?? "--"} lycéen(s)${program ? ` · ${program}` : ""}`}
        actions={
          <>
            <form className="search-form" onSubmit={(event) => { event.preventDefault(); filter(() => setSearch(draft.trim())); }}>
              <input aria-label="Rechercher un lycéen" placeholder="Nom, lycée, téléphone..." value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button className="outline-button small">Rechercher</button>
            </form>
            <select aria-label="Suivi" value={contacted} onChange={(event) => filter(() => setContacted(event.target.value))}>
              <option value="">Tous</option>
              <option value="non">À contacter</option>
              <option value="oui">Déjà contactés</option>
            </select>
            <button className="outline-button small" disabled={action.busy || !list.data?.data.length} onClick={() => void exportPdf()}>Exporter (PDF)</button>
          </>
        }
      >
        <div className="table-wrap">
          <table>
            <thead><tr><th>Élève</th><th>Établissement</th><th>Tuteur</th><th>Filière souhaitée</th><th>Enregistré le</th><th /></tr></thead>
            <tbody>
              {(list.data?.data ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="strong-cell">{item.nom} {item.prenom}<small className="cell-detail">{item.sexe === "F" ? "Fille" : "Garçon"} · {age(item.dateNaissance)} ans{item.telephone ? ` · ${item.telephone}` : ""}</small></td>
                  <td>{item.ecole}<small className="cell-detail">{item.classe} · série {item.serie}</small></td>
                  <td>{item.tuteurNom} {item.tuteurPrenom}<small className="cell-detail"><a href={`tel:${item.tuteurTelephone}`}>{item.tuteurTelephone}</a></small></td>
                  <td>{item.filiereSouhaitee}</td>
                  <td>{formatDate(item.dateEnregistrement)}<small className="cell-detail">{item.contacte ? <Badge tone="ok">Contacté</Badge> : <Badge tone="wait">À contacter</Badge>}</small></td>
                  <td className="action-group">
                    {canEdit && <button className="row-action" disabled={action.busy} onClick={() => void mark(item)}>{item.contacte ? "Remettre à contacter" : "Marquer contacté"}</button>}
                    {canEdit && <button className="row-action danger-row-action" disabled={action.busy} onClick={() => void remove(item)}>Supprimer</button>}
                  </td>
                </tr>
              ))}
              {!list.data?.data.length && <Empty columns={6}>{!list.data ? "Chargement..." : search || program || contacted ? "Aucun lycéen ne correspond à cette sélection." : "Aucun lycéen ne s'est encore enregistré. Partagez le lien du formulaire."}</Empty>}
            </tbody>
          </table>
        </div>
        {list.data && <PageBar page={list.data.meta.page} pageCount={list.data.meta.totalPages} total={list.data.meta.total} noun="lycéen(s)" onPage={setPage} />}
      </Panel>
    </div>
  );
}
