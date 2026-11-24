"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { Badge, FormActions, LoadingBlock, Modal, Panel, messageOf, send, useAction, useLoad } from "@/components/ui-kit";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/connectivity";
import { formatDate } from "@/lib/types";

type News = {
  id: string;
  categorie: string;
  titre: string;
  resume: string;
  contenu: string | null;
  datePublication: string;
  lienLibelle: string | null;
  lien: string | null;
  aLaUne: boolean;
  actif: boolean;
  image: string | null;
  creeParNom: string;
  modifieLe: string;
};
type Question = { id: string; question: string; reponse: string; ordre: number; actif: boolean };

// Pages proposées pour le lien d'une actualité.
const NEWS_LINKS: Array<[string, string]> = [
  ["/enregistrements", "Pré-inscription en ligne"],
  ["/site#formations", "Nos filières"],
  ["/site#financement", "Financer ses études"],
  ["/site#admission", "Intégrer l'IPAIM"],
  ["/site#contact", "Contact"],
  ["/etudiant", "Espace étudiant"],
];
const CATEGORIES = ["Vie académique", "Scolarité", "Financement", "Formations", "Vie de l'université", "Services numériques", "Partenariats", "Institution", "Recrutement", "Événement"];
const today = () => new Date().toISOString().slice(0, 10);

function NewsForm({ item, onClose, onSaved }: { item: News | "new"; onClose: () => void; onSaved: (list: News[]) => void }) {
  const initial = item === "new"
    ? { categorie: "", titre: "", resume: "", contenu: "", datePublication: today(), lienLibelle: "", lien: "", aLaUne: false, actif: true }
    : { categorie: item.categorie, titre: item.titre, resume: item.resume, contenu: item.contenu ?? "", datePublication: item.datePublication.slice(0, 10), lienLibelle: item.lienLibelle ?? "", lien: item.lien ?? "", aLaUne: item.aLaUne, actif: item.actif };
  const [values, setValues] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [customLink, setCustomLink] = useState(Boolean(initial.lien) && !NEWS_LINKS.some(([value]) => value === initial.lien));
  const action = useAction();
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : item !== "new" && item.image && !removeImage ? `${API_URL}${item.image}` : null), [file, item, removeImage]);
  useEffect(() => () => { if (file && preview) URL.revokeObjectURL(preview); }, [file, preview]);
  const set = (key: "categorie" | "titre" | "resume" | "contenu" | "datePublication" | "lienLibelle" | "lien") => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) form.append(key, String(value));
      if (file) form.append("image", file);
      if (removeImage && !file) form.append("retirerImage", "true");
      const list = await apiFetch<News[]>(item === "new" ? "/vitrine/gestion/actualites" : `/vitrine/gestion/actualites/${item.id}`, { method: item === "new" ? "POST" : "PATCH", body: form, silent: true });
      toast(item === "new" ? "Actualité publiée." : "Actualité enregistrée.");
      onSaved(list);
    });
  };

  return (
    <Modal wide title={item === "new" ? "Nouvelle actualité" : `Modifier · ${item.titre}`} onClose={onClose}>
      <form className="entity-form news-form" onSubmit={submit}>
        <div className="news-form-image">
          {preview ? <span className="news-form-preview" style={{ backgroundImage: `url("${preview}")` }} /> : <span className="news-form-preview is-empty"><ImagePlus size={26} aria-hidden="true" /></span>}
          <div>
            <label>Image (facultative)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveImage(false); }} /></label>
            <small className="cell-detail">Format paysage conseillé (1600 × 900 px), JPG, PNG ou WEBP, 10 Mo au plus.</small>
            {item !== "new" && item.image && !file && <label className="check-row"><input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} /><span>Retirer l&apos;image actuelle</span></label>}
          </div>
        </div>
        <div className="form-grid">
          <label>Catégorie<input required list="categories-actualites" maxLength={40} placeholder="Ex. Vie de l'université" value={values.categorie} onChange={set("categorie")} /></label>
          <label>Date de publication<input required type="date" value={values.datePublication} onChange={set("datePublication")} /></label>
        </div>
        <datalist id="categories-actualites">{CATEGORIES.map((item) => <option key={item} value={item} />)}</datalist>
        <label>Titre<input required maxLength={140} value={values.titre} onChange={set("titre")} /></label>
        <label>Résumé<textarea required rows={2} maxLength={320} placeholder="Une ou deux phrases, affichées sur la carte de l'actualité." value={values.resume} onChange={set("resume")} /><small className="cell-detail">{values.resume.length} / 320</small></label>
        <label>Texte complet (facultatif)<textarea rows={6} maxLength={6000} placeholder="Affiché quand le visiteur ouvre l'actualité. Laissez une ligne vide entre deux paragraphes." value={values.contenu} onChange={set("contenu")} /></label>
        <div className="form-grid">
          <label>Lien (facultatif)<input maxLength={40} placeholder="Ex. Je m'inscris" value={values.lienLibelle} onChange={set("lienLibelle")} /></label>
          <label>Le lien mène à
            <select disabled={!values.lienLibelle} value={customLink ? "autre" : values.lien} onChange={(event) => { if (event.target.value === "autre") { setCustomLink(true); setValues((current) => ({ ...current, lien: "" })); } else { setCustomLink(false); setValues((current) => ({ ...current, lien: event.target.value })); } }}>
              <option value="">Choisir une page</option>
              {NEWS_LINKS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              <option value="autre">Autre adresse…</option>
            </select>
          </label>
        </div>
        {customLink && values.lienLibelle && <label>Adresse du lien<input required placeholder="https://… ou /…" value={values.lien} onChange={set("lien")} /></label>}
        <label className="check-row"><input type="checkbox" checked={values.aLaUne} onChange={(event) => setValues((current) => ({ ...current, aLaUne: event.target.checked }))} /><span>À la une<small>Affichée en grand, en tête des actualités. Une seule actualité peut l&apos;être.</small></span></label>
        <label className="check-row"><input type="checkbox" checked={values.actif} onChange={(event) => setValues((current) => ({ ...current, actif: event.target.checked }))} /><span>Afficher sur le site</span></label>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} label={item === "new" ? "Publier" : "Enregistrer"} />
      </form>
    </Modal>
  );
}

// Les actualités du site : image, catégorie, date, titre, résumé et texte complet.
export function NewsPanel({ canEdit, refreshSignal }: { canEdit: boolean; refreshSignal: number }) {
  const list = useLoad<News[]>("/vitrine/gestion/actualites", refreshSignal);
  const [editing, setEditing] = useState<News | "new" | null>(null);
  const items = list.data ?? [];
  const run = async (task: () => Promise<News[]>, done: string) => {
    try {
      list.setData(await task());
      toast(done);
    } catch (failure) {
      toast(messageOf(failure, "L'opération n'a pas abouti."), "error");
    }
  };
  const patch = (item: News, field: "actif" | "aLaUne", value: boolean, done: string) => {
    const form = new FormData();
    form.append(field, String(value));
    void run(() => apiFetch<News[]>(`/vitrine/gestion/actualites/${item.id}`, { method: "PATCH", body: form, silent: true }), done);
  };
  const remove = async (item: News) => {
    if (!(await askConfirm({ title: "Supprimer l'actualité ?", message: `« ${item.titre} » et son image seront retirées du site.`, confirmLabel: "Supprimer", danger: true }))) return;
    void run(() => send<News[]>(`/vitrine/gestion/actualites/${item.id}`, "DELETE", undefined, true), "Actualité supprimée.");
  };

  return (
    <>
      <Panel eyebrow="Actualités" title={list.data ? `${items.length} actualité(s) · ${items.filter((item) => item.actif).length} affichée(s)` : "Chargement…"} subtitle="Les plus récentes apparaissent en premier sur le site ; celle « à la une » est mise en avant." actions={canEdit ? <button className="primary-button compact" onClick={() => setEditing("new")}><Plus size={15} aria-hidden="true" /> Nouvelle actualité</button> : undefined}>
        {list.error && <p className="form-error">{list.error}</p>}
        {!list.data && !list.error ? <LoadingBlock /> : !items.length ? (
          <p className="empty-state">Aucune actualité pour l&apos;instant.</p>
        ) : (
          <div className="news-admin">
            {items.map((item) => (
              <article key={item.id} className={`news-admin-row ${item.actif ? "" : "is-hidden"}`}>
                {item.image ? <span className="news-admin-thumb" style={{ backgroundImage: `url("${API_URL}${item.image}")` }} /> : <span className="news-admin-thumb is-empty"><ImagePlus size={18} aria-hidden="true" /></span>}
                <div className="news-admin-body">
                  <small className="cell-detail">{item.categorie} · {formatDate(item.datePublication)}</small>
                  <strong>{item.titre}</strong>
                  <span>{item.resume}</span>
                  <span className="action-group">
                    {item.aLaUne && <Badge tone="run">À la une</Badge>}
                    {!item.image && <Badge tone="wait">Sans image</Badge>}
                    <Badge tone={item.actif ? "ok" : "off"}>{item.actif ? "Affichée" : "Masquée"}</Badge>
                  </span>
                </div>
                {canEdit && (
                  <div className="news-admin-actions">
                    <button className="row-action" onClick={() => setEditing(item)}><Pencil size={14} aria-hidden="true" /> Modifier</button>
                    {!item.aLaUne && <button className="row-action" onClick={() => patch(item, "aLaUne", true, "Actualité mise à la une.")}><Star size={14} aria-hidden="true" /> À la une</button>}
                    <button className="row-action" onClick={() => patch(item, "actif", !item.actif, item.actif ? "Actualité masquée." : "Actualité affichée.")}>{item.actif ? <><EyeOff size={14} aria-hidden="true" /> Masquer</> : <><Eye size={14} aria-hidden="true" /> Afficher</>}</button>
                    <button className="row-action icon-action danger-row-action" title="Supprimer" aria-label="Supprimer" onClick={() => void remove(item)}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
      {editing && <NewsForm item={editing} onClose={() => setEditing(null)} onSaved={(next) => { list.setData(next); setEditing(null); }} />}
    </>
  );
}

function QuestionForm({ item, onClose, onSaved }: { item: Question | "new"; onClose: () => void; onSaved: (list: Question[]) => void }) {
  const [values, setValues] = useState(item === "new" ? { question: "", reponse: "", actif: true } : { question: item.question, reponse: item.reponse, actif: item.actif });
  const action = useAction();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      const list = await send<Question[]>(item === "new" ? "/vitrine/gestion/questions" : `/vitrine/gestion/questions/${item.id}`, item === "new" ? "POST" : "PATCH", values, true);
      toast(item === "new" ? "Question ajoutée." : "Question enregistrée.");
      onSaved(list);
    });
  };
  return (
    <Modal title={item === "new" ? "Nouvelle question" : "Modifier la question"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>Question<input required maxLength={200} value={values.question} onChange={(event) => setValues((current) => ({ ...current, question: event.target.value }))} /></label>
        <label>Réponse<textarea required rows={5} maxLength={1500} value={values.reponse} onChange={(event) => setValues((current) => ({ ...current, reponse: event.target.value }))} /></label>
        <label className="check-row"><input type="checkbox" checked={values.actif} onChange={(event) => setValues((current) => ({ ...current, actif: event.target.checked }))} /><span>Afficher sur le site</span></label>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// Les questions fréquentes du site, dans l'ordre d'affichage.
export function QuestionsPanel({ canEdit, refreshSignal }: { canEdit: boolean; refreshSignal: number }) {
  const list = useLoad<Question[]>("/vitrine/gestion/questions", refreshSignal);
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const items = list.data ?? [];
  const run = async (task: () => Promise<Question[]>, done: string) => {
    try {
      list.setData(await task());
      toast(done);
    } catch (failure) {
      toast(messageOf(failure, "L'opération n'a pas abouti."), "error");
    }
  };
  const move = (index: number, step: number) => {
    const ids = items.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + step, 0, moved);
    void run(() => send<Question[]>("/vitrine/gestion/questions/ordre", "POST", { ids }, true), "Ordre enregistré.");
  };
  const remove = async (item: Question) => {
    if (!(await askConfirm({ title: "Supprimer la question ?", message: `« ${item.question} » sera retirée du site.`, confirmLabel: "Supprimer", danger: true }))) return;
    void run(() => send<Question[]>(`/vitrine/gestion/questions/${item.id}`, "DELETE", undefined, true), "Question supprimée.");
  };

  return (
    <>
      <Panel eyebrow="Questions fréquentes" title={list.data ? `${items.length} question(s)` : "Chargement…"} subtitle="Elles apparaissent sur le site dans cet ordre." actions={canEdit ? <button className="primary-button compact" onClick={() => setEditing("new")}><Plus size={15} aria-hidden="true" /> Nouvelle question</button> : undefined}>
        {list.error && <p className="form-error">{list.error}</p>}
        {!list.data && !list.error ? <LoadingBlock /> : !items.length ? (
          <p className="empty-state">Aucune question pour l&apos;instant.</p>
        ) : (
          <div className="faq-admin">
            {items.map((item, index) => (
              <article key={item.id} className={item.actif ? "" : "is-hidden"}>
                <div>
                  <strong>{index + 1}. {item.question}</strong>
                  <p>{item.reponse}</p>
                  {!item.actif && <Badge tone="off">Masquée</Badge>}
                </div>
                {canEdit && (
                  <div className="action-group">
                    <button className="row-action icon-action" title="Monter" aria-label="Monter" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} aria-hidden="true" /></button>
                    <button className="row-action icon-action" title="Descendre" aria-label="Descendre" disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} aria-hidden="true" /></button>
                    <button className="row-action" onClick={() => setEditing(item)}><Pencil size={14} aria-hidden="true" /> Modifier</button>
                    <button className="row-action" onClick={() => void run(() => send<Question[]>(`/vitrine/gestion/questions/${item.id}`, "PATCH", { actif: !item.actif }, true), item.actif ? "Question masquée." : "Question affichée.")}>{item.actif ? <><EyeOff size={14} aria-hidden="true" /> Masquer</> : <><Eye size={14} aria-hidden="true" /> Afficher</>}</button>
                    <button className="row-action icon-action danger-row-action" title="Supprimer" aria-label="Supprimer" onClick={() => void remove(item)}><Trash2 size={15} aria-hidden="true" /></button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
      {editing && <QuestionForm item={editing} onClose={() => setEditing(null)} onSaved={(next) => { list.setData(next); setEditing(null); }} />}
    </>
  );
}
