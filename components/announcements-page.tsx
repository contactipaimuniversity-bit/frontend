"use client";

import { FormEvent, useEffect, useState } from "react";
import { Megaphone, Pin, UserRound } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { Badge, Empty, FormActions, LoadingBlock, Modal, PageIntro, Panel, messageOf, send, useAction, useLoad } from "@/components/ui-kit";
import { apiFetch } from "@/lib/api";
import { hasAccess } from "@/lib/access";
import { User, formatDate } from "@/lib/types";

type Announcement = {
  id: string;
  titre: string;
  contenu: string;
  importance: "NORMALE" | "IMPORTANTE";
  epinglee: boolean;
  filiereId: string | null;
  niveau: string | null;
  classeId: string | null;
  personneId: string | null;
  etudiant: string | null;
  filiere: string | null;
  classe: string | null;
  publieeLe: string;
  expireLe: string | null;
  creeParNom: string;
  modifieLe: string;
};
type StudentHit = { id: string; nom: string; matricule: string | null; detail: string | null; espaceActif: boolean; notifications: boolean };
type Targets = { filieres: Array<{ id: string; nom: string }>; niveaux: Array<{ code: string; libelle: string }>; classes: Array<{ id: string; nom: string }> };

const dayOf = (value?: string | null) => (value ? value.slice(0, 10) : "");

function audience(item: Announcement) {
  if (item.etudiant) return <><UserRound size={13} aria-hidden="true" /> {item.etudiant}</>;
  const parts = [item.classe, item.filiere, item.niveau].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Tous les étudiants";
}

function status(item: Announcement) {
  const now = Date.now();
  if (new Date(item.publieeLe).getTime() > now) return { label: `Programmée · ${formatDate(item.publieeLe)}`, tone: "wait" as const };
  if (item.expireLe && new Date(item.expireLe).getTime() <= now) return { label: "Terminée", tone: "off" as const };
  return { label: "En ligne", tone: "ok" as const };
}

// Annonces de l'administration : elles s'affichent comme des messages dans
// l'espace étudiant (application mobile) des étudiants concernés.
export function AnnouncementsPage({ user, refreshSignal }: { user: User | null; refreshSignal: number }) {
  const list = useLoad<Announcement[]>("/annonces", refreshSignal);
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const canEdit = hasAccess(user, "announcements", "edit");

  const remove = async (item: Announcement) => {
    if (!(await askConfirm({ title: "Supprimer l'annonce ?", message: `« ${item.titre} » disparaîtra de l'espace des étudiants.`, confirmLabel: "Supprimer", danger: true }))) return;
    try {
      await send(`/annonces/${item.id}`, "DELETE", undefined, true);
      toast("Annonce supprimée.");
      list.reload();
    } catch (failure) {
      toast(messageOf(failure, "Suppression impossible."), "error");
    }
  };

  return (
    <div className="content-scroll">
      <PageIntro eyebrow="Communication" title="Annonces" text="Les messages publiés ici apparaissent dans l'espace étudiant : à tous, à une filière, un niveau, une classe, ou à un étudiant précis.">
        {canEdit && <button className="primary-button compact" onClick={() => setEditing("new")}><Megaphone size={15} aria-hidden="true" /> Nouvelle annonce</button>}
      </PageIntro>
      <Panel eyebrow="Annonces" title={list.data ? `${list.data.length} annonce(s)` : "Chargement…"} subtitle="Les annonces épinglées restent en tête chez l'étudiant.">
        {list.error && <p className="form-error">{list.error}</p>}
        {!list.data && !list.error ? (
          <LoadingBlock />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Annonce</th><th>Destinataires</th><th>État</th><th>Publiée</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {(list.data ?? []).map((item) => {
                  const state = status(item);
                  return (
                    <tr key={item.id}>
                      <td className="strong-cell">
                        {item.epinglee && <Pin size={13} aria-label="Épinglée" />} {item.titre} {item.importance === "IMPORTANTE" && <Badge tone="bad">Importante</Badge>}
                        <small className="cell-detail">{item.contenu.length > 110 ? `${item.contenu.slice(0, 110)}…` : item.contenu}</small>
                      </td>
                      <td>{audience(item)}</td>
                      <td><Badge tone={state.tone}>{state.label}</Badge>{item.expireLe && <small className="cell-detail">jusqu&apos;au {formatDate(item.expireLe)}</small>}</td>
                      <td>{formatDate(item.publieeLe)}<small className="cell-detail">{item.creeParNom}</small></td>
                      {canEdit && (
                        <td className="action-group">
                          <button className="row-action" onClick={() => setEditing(item)}>Modifier</button>
                          <button className="row-action danger-row-action" onClick={() => void remove(item)}>Supprimer</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {list.data && !list.data.length && <Empty columns={canEdit ? 5 : 4}>Aucune annonce pour l&apos;instant.</Empty>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {editing && <AnnouncementForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={list.reload} />}
    </div>
  );
}

function AnnouncementForm({ item, onClose, onSaved }: { item: Announcement | null; onClose: () => void; onSaved: () => void }) {
  const targets = useLoad<Targets>("/annonces/cibles");
  const [form, setForm] = useState({
    titre: item?.titre ?? "",
    contenu: item?.contenu ?? "",
    importance: item?.importance ?? "NORMALE",
    epinglee: item?.epinglee ?? false,
    filiereId: item?.filiereId ?? "",
    niveau: item?.niveau ?? "",
    classeId: item?.classeId ?? "",
    publieeLe: dayOf(item?.publieeLe),
    expireLe: dayOf(item?.expireLe),
    personneId: item?.personneId ?? "",
  });
  const [mode, setMode] = useState<"groupe" | "etudiant">(item?.personneId ? "etudiant" : "groupe");
  const [student, setStudent] = useState<{ id: string; nom: string } | null>(item?.personneId ? { id: item.personneId, nom: item.etudiant ?? "Étudiant" } : null);
  const action = useAction();
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void action.run(async () => {
      if (mode === "etudiant" && !student) throw new Error("Choisissez l'étudiant à qui envoyer l'annonce.");
      const body = {
        ...form,
        personneId: mode === "etudiant" ? student?.id ?? null : null,
        ...(mode === "etudiant" ? { filiereId: "", niveau: "", classeId: "" } : {}),
        publieeLe: form.publieeLe || null,
        expireLe: form.expireLe ? `${form.expireLe}T23:59:59` : null,
      };
      await send(item ? `/annonces/${item.id}` : "/annonces", item ? "PATCH" : "POST", body, true);
      toast(item ? "Annonce modifiée." : "Annonce publiée.");
      onSaved();
      onClose();
    });
  };

  return (
    <Modal title={item ? "Modifier l'annonce" : "Nouvelle annonce"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>Titre<input required maxLength={140} value={form.titre} onChange={(event) => set({ titre: event.target.value })} placeholder="Ex. Report des examens de L1" /></label>
        <label>Message<textarea required rows={6} maxLength={4000} value={form.contenu} onChange={(event) => set({ contenu: event.target.value })} /></label>
        <div className="tuition-choices" role="radiogroup" aria-label="Destinataires">
          <button type="button" role="radio" aria-checked={mode === "groupe"} className={mode === "groupe" ? "active" : ""} onClick={() => setMode("groupe")}><strong>Un groupe</strong><small>Tous, ou une filière, un niveau, une classe.</small></button>
          <button type="button" role="radio" aria-checked={mode === "etudiant"} className={mode === "etudiant" ? "active" : ""} onClick={() => setMode("etudiant")}><strong>Un étudiant précis</strong><small>Message personnel, vu de lui seul.</small></button>
        </div>
        {mode === "etudiant" ? (
          <StudentPicker value={student} onChange={setStudent} />
        ) : (
        <div className="form-grid">
          <label>Filière<select value={form.filiereId} onChange={(event) => set({ filiereId: event.target.value })}><option value="">Toutes les filières</option>{targets.data?.filieres.map((filiere) => <option key={filiere.id} value={filiere.id}>{filiere.nom}</option>)}</select></label>
          <label>Niveau<select value={form.niveau} onChange={(event) => set({ niveau: event.target.value })}><option value="">Tous les niveaux</option>{targets.data?.niveaux.map((niveau) => <option key={niveau.code} value={niveau.code}>{niveau.libelle ? `${niveau.code} · ${niveau.libelle}` : niveau.code}</option>)}</select></label>
          <label>Classe<select value={form.classeId} onChange={(event) => set({ classeId: event.target.value })}><option value="">Toutes les classes</option>{targets.data?.classes.map((classe) => <option key={classe.id} value={classe.id}>{classe.nom}</option>)}</select></label>
        </div>
        )}
        <div className="form-grid">
          <label>Publier le (vide : maintenant)<input type="date" value={form.publieeLe} onChange={(event) => set({ publieeLe: event.target.value })} /></label>
          <label>Afficher jusqu&apos;au (facultatif)<input type="date" value={form.expireLe} onChange={(event) => set({ expireLe: event.target.value })} /></label>
        </div>
        <div className="form-grid">
          <label className="check-row"><input type="checkbox" checked={form.importance === "IMPORTANTE"} onChange={(event) => set({ importance: event.target.checked ? "IMPORTANTE" : "NORMALE" })} /> Importante (mise en avant)</label>
          <label className="check-row"><input type="checkbox" checked={form.epinglee} onChange={(event) => set({ epinglee: event.target.checked })} /> Épinglée en tête</label>
        </div>
        {targets.error && <p className="form-error">{targets.error}</p>}
        {action.error && <p className="form-error">{action.error}</p>}
        <FormActions busy={action.busy} label={item ? "Enregistrer" : "Publier"} onCancel={onClose} />
      </form>
    </Modal>
  );
}

/** Recherche d'un étudiant (nom, prénom ou matricule), avec l'état de son espace. */
function StudentPicker({ value, onChange }: { value: { id: string; nom: string } | null; onChange: (value: { id: string; nom: string } | null) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      apiFetch<StudentHit[]>(`/annonces/etudiants?q=${encodeURIComponent(q)}`, { skipCache: true })
        .then((found) => active && (setHits(found), setError("")))
        .catch((failure) => active && setError(messageOf(failure, "Recherche impossible.")));
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (value)
    return (
      <div className="announce-student-picked">
        <UserRound size={16} aria-hidden="true" />
        <strong>{value.nom}</strong>
        <button type="button" className="link-button" onClick={() => onChange(null)}>Changer</button>
      </div>
    );
  return (
    <div className="announce-student-search">
      <label>Étudiant<input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, prénom ou matricule" /></label>
      {error && <p className="form-error">{error}</p>}
      {query.trim().length >= 2 && hits && (
        <ul>
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => onChange({ id: hit.id, nom: `${hit.nom}${hit.matricule ? ` (${hit.matricule})` : ""}` })}>
                <span><strong>{hit.nom}</strong> {hit.matricule}<small>{hit.detail ?? ""}</small></span>
                {hit.notifications ? <Badge tone="ok">Notifications actives</Badge> : hit.espaceActif ? <Badge tone="wait">Espace activé, sans notifications</Badge> : <Badge tone="off">Espace non activé</Badge>}
              </button>
            </li>
          ))}
          {!hits.length && <li className="announce-student-empty">Aucun étudiant avec matricule ne correspond.</li>}
        </ul>
      )}
    </div>
  );
}
