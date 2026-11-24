"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ExternalLink, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { Badge, FormActions, LoadingBlock, Modal, PageIntro, Panel, messageOf, send, useAction, useLoad } from "@/components/ui-kit";
import { hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/connectivity";
import { User, formatDate } from "@/lib/types";

export type Slide = {
  id: string;
  surtitre: string | null;
  titre: string;
  texte: string | null;
  boutonLibelle: string | null;
  boutonLien: string | null;
  image: string | null;
  ordre: number;
  actif: boolean;
  creeParNom: string;
  modifieLe: string;
};

// Pages de la vitrine proposées pour le bouton d'une diapositive.
const LINKS: Array<[string, string]> = [
  ["/enregistrements", "Pré-inscription en ligne"],
  ["/site#formations", "Nos formations"],
  ["/site#admissions", "Admissions et bourses"],
  ["/site#universite", "L'université"],
  ["/site#vie-etudiante", "Vie étudiante"],
  ["/site#actualites", "Actualités"],
  ["/site#contact", "Contact"],
  ["/etudiant", "Espace étudiant"],
];

const empty = { surtitre: "", titre: "", texte: "", boutonLibelle: "", boutonLien: "", actif: true };

// Aperçu d'une diapositive telle qu'elle apparaît en haut du site.
function SlidePreview({ image, surtitre, titre, texte, bouton }: { image: string | null; surtitre?: string | null; titre: string; texte?: string | null; bouton?: string | null }) {
  return (
    <div className="slide-preview">
      {image ? <span className="slide-preview-bg" style={{ backgroundImage: `url("${image}")` }} /> : <span className="slide-preview-bg slide-preview-empty"><ImagePlus size={28} aria-hidden="true" /></span>}
      <span className="slide-preview-shade" />
      <span className="slide-preview-glass">
        {surtitre && <small>{surtitre}</small>}
        <strong>{titre || "Titre de la diapositive"}</strong>
        {texte && <span>{texte}</span>}
        {bouton && <em>{bouton}</em>}
      </span>
    </div>
  );
}

function SlideForm({ slide, onClose, onSaved }: { slide: Slide | "new"; onClose: () => void; onSaved: (list: Slide[]) => void }) {
  const initial = slide === "new" ? empty : { surtitre: slide.surtitre ?? "", titre: slide.titre, texte: slide.texte ?? "", boutonLibelle: slide.boutonLibelle ?? "", boutonLien: slide.boutonLien ?? "", actif: slide.actif };
  const [values, setValues] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const action = useAction();
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : slide !== "new" && slide.image ? `${API_URL}${slide.image}` : null), [file, slide]);
  useEffect(() => () => { if (file && preview) URL.revokeObjectURL(preview); }, [file, preview]);
  const set = (key: keyof typeof empty) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const known = LINKS.some(([value]) => value === values.boutonLien);
  const [customLink, setCustomLink] = useState(Boolean(values.boutonLien) && !known);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      if (slide === "new" && !file) throw new Error("Choisissez l'image de la diapositive.");
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) form.append(key, String(value));
      if (file) form.append("image", file);
      const list = await apiFetch<Slide[]>(slide === "new" ? "/vitrine/gestion/diapositives" : `/vitrine/gestion/diapositives/${slide.id}`, { method: slide === "new" ? "POST" : "PATCH", body: form, silent: true });
      toast(slide === "new" ? "Diapositive ajoutée au site." : "Diapositive enregistrée.");
      onSaved(list);
    });
  };

  return (
    <Modal wide title={slide === "new" ? "Nouvelle diapositive" : `Modifier · ${slide.titre}`} onClose={onClose}>
      <form className="entity-form slide-form" onSubmit={submit}>
        <SlidePreview image={preview} surtitre={values.surtitre} titre={values.titre} texte={values.texte} bouton={values.boutonLibelle} />
        <label className="slide-file">
          <span>Image {slide === "new" ? "" : "(laisser vide pour garder l'actuelle)"}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <small>Photo large, de préférence 1920 × 1080 px (paysage), JPG, PNG ou WEBP, 10 Mo au plus. Elle est légèrement floutée derrière le texte.</small>
        </label>
        <div className="form-grid">
          <label>Surtitre (facultatif)<input maxLength={80} placeholder="Ex. Rentrée 2026-2027" value={values.surtitre} onChange={set("surtitre")} /></label>
          <label>Titre<input required maxLength={120} placeholder="Ex. Innover. Former. Transformer." value={values.titre} onChange={set("titre")} /></label>
        </div>
        <label>Texte (facultatif)<textarea rows={3} maxLength={400} placeholder="Une ou deux phrases, affichées sous le titre." value={values.texte} onChange={set("texte")} /><small className="cell-detail">{values.texte.length} / 400</small></label>
        <div className="form-grid">
          <label>Bouton (facultatif)<input maxLength={40} placeholder="Ex. Je m'inscris" value={values.boutonLibelle} onChange={set("boutonLibelle")} /></label>
          <label>Le bouton mène à
            <select value={customLink ? "autre" : values.boutonLien} onChange={(event) => { if (event.target.value === "autre") { setCustomLink(true); setValues((current) => ({ ...current, boutonLien: "" })); } else { setCustomLink(false); setValues((current) => ({ ...current, boutonLien: event.target.value })); } }} disabled={!values.boutonLibelle}>
              <option value="">Choisir une page</option>
              {LINKS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              <option value="autre">Autre adresse…</option>
            </select>
          </label>
        </div>
        {customLink && values.boutonLibelle && <label>Adresse du bouton<input required placeholder="https://… ou /…" value={values.boutonLien} onChange={set("boutonLien")} /></label>}
        <label className="check-row"><input type="checkbox" checked={values.actif} onChange={(event) => setValues((current) => ({ ...current, actif: event.target.checked }))} /><span>Afficher sur le site<small>Décochez pour la garder en réserve sans la montrer.</small></span></label>
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} onCancel={onClose} label={slide === "new" ? "Ajouter au site" : "Enregistrer"} />
      </form>
    </Modal>
  );
}

// Le grand carrousel en haut de la vitrine publique : images, titres et textes
// choisis ici, dans l'ordre où ils défilent.
export function WebsitePage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const list = useLoad<Slide[]>("/vitrine/gestion/diapositives", refreshSignal);
  const [editing, setEditing] = useState<Slide | "new" | null>(null);
  const canEdit = hasAccess(user, "website", "edit");
  const slides = list.data ?? [];
  const visible = slides.filter((item) => item.actif).length;

  const run = async (task: () => Promise<Slide[]>, done: string) => {
    try {
      list.setData(await task());
      toast(done);
    } catch (failure) {
      toast(messageOf(failure, "L'opération n'a pas abouti."), "error");
    }
  };
  const move = (index: number, step: number) => {
    const ids = slides.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + step, 0, moved);
    void run(() => send<Slide[]>("/vitrine/gestion/ordre", "POST", { ids }, true), "Ordre enregistré.");
  };
  const toggle = (item: Slide) => {
    const form = new FormData();
    form.append("actif", String(!item.actif));
    void run(() => apiFetch<Slide[]>(`/vitrine/gestion/diapositives/${item.id}`, { method: "PATCH", body: form, silent: true }), item.actif ? "Diapositive masquée." : "Diapositive affichée.");
  };
  const remove = async (item: Slide) => {
    if (!(await askConfirm({ title: "Supprimer la diapositive ?", message: `« ${item.titre} » et son image seront retirées du site.`, confirmLabel: "Supprimer", danger: true }))) return;
    void run(() => send<Slide[]>(`/vitrine/gestion/diapositives/${item.id}`, "DELETE", undefined, true), "Diapositive supprimée.");
  };

  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Communication" title="Site vitrine" text="Le grand carrousel en haut du site public : chaque diapositive associe une photo, un titre, un court texte et, si vous le souhaitez, un bouton.">
        <a className="secondary-button compact" href="/site" target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" /> Voir le site</a>
        {canEdit && <button className="primary-button compact" onClick={() => setEditing("new")}><ImagePlus size={15} aria-hidden="true" /> Nouvelle diapositive</button>}
      </PageIntro>
      <Panel eyebrow="Carrousel" title={list.data ? `${slides.length} diapositive(s) · ${visible} affichée(s)` : "Chargement…"} subtitle="Elles défilent dans cet ordre, toutes les sept secondes. Sans diapositive affichée, le site montre une présentation par défaut.">
        {list.error && <p className="form-error">{list.error}</p>}
        {!list.data && !list.error ? (
          <LoadingBlock />
        ) : !slides.length ? (
          <p className="empty-state">Aucune diapositive pour l&apos;instant. Ajoutez la première : une belle photo du campus, des étudiants ou d&apos;un événement.</p>
        ) : (
          <div className="slide-grid">
            {slides.map((item, index) => (
              <article key={item.id} className={`slide-card ${item.actif ? "" : "is-hidden"}`}>
                <SlidePreview image={item.image ? `${API_URL}${item.image}` : null} surtitre={item.surtitre} titre={item.titre} texte={item.texte} bouton={item.boutonLibelle} />
                <div className="slide-card-body">
                  <div className="slide-card-head">
                    <strong>{index + 1}. {item.titre}</strong>
                    <Badge tone={item.actif ? "ok" : "off"}>{item.actif ? "Affichée" : "Masquée"}</Badge>
                  </div>
                  <small className="cell-detail">Modifiée le {formatDate(item.modifieLe)} · {item.creeParNom}{item.boutonLien ? ` · bouton vers ${item.boutonLien}` : ""}</small>
                  {canEdit && (
                    <div className="action-group">
                      <button className="row-action icon-action" title="Avancer dans l'ordre" aria-label="Avancer dans l'ordre" disabled={index === 0} onClick={() => move(index, -1)}><ArrowLeft size={15} aria-hidden="true" /></button>
                      <button className="row-action icon-action" title="Reculer dans l'ordre" aria-label="Reculer dans l'ordre" disabled={index === slides.length - 1} onClick={() => move(index, 1)}><ArrowRight size={15} aria-hidden="true" /></button>
                      <button className="row-action" onClick={() => setEditing(item)}><Pencil size={14} aria-hidden="true" /> Modifier</button>
                      <button className="row-action" onClick={() => toggle(item)}>{item.actif ? <><EyeOff size={14} aria-hidden="true" /> Masquer</> : <><Eye size={14} aria-hidden="true" /> Afficher</>}</button>
                      <button className="row-action icon-action danger-row-action" title="Supprimer" aria-label="Supprimer" onClick={() => void remove(item)}><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      {editing && <SlideForm slide={editing} onClose={() => setEditing(null)} onSaved={(next) => { list.setData(next); setEditing(null); }} />}
    </div>
  );
}
