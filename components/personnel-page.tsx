"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ModalChoice } from "@/components/modal-choice";
import { PersonnelApplication, PersonnelApplicationPage, statusLabels } from "@/lib/types";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>×</button></div>{children}</section></div>;
}

function CreatePersonnel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nom: "", prenom: "", dateNaissance: "", diplome: "", fonction: "", quartier: "", elements: "" });
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try {
      await apiFetch("/candidatures-personnel", { method: "POST", body: JSON.stringify({ ...form, dateNaissance: form.dateNaissance || undefined, elements: form.elements.split("\n").map((item) => item.trim()).filter(Boolean) }) });
      onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Création impossible."); }
  };
  return <Modal title="Nouveau dossier personnel" onClose={onClose}><form className="entity-form" onSubmit={submit}><div className="form-grid"><label>Nom<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></label><label>Prénom<input required value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} /></label></div><div className="form-grid"><label>Date de naissance<input type="date" value={form.dateNaissance} onChange={(event) => setForm({ ...form, dateNaissance: event.target.value })} /></label><label>Quartier<input value={form.quartier} onChange={(event) => setForm({ ...form, quartier: event.target.value })} /></label></div><label>Diplôme obtenu<input required value={form.diplome} onChange={(event) => setForm({ ...form, diplome: event.target.value })} /></label><label>Fonction souhaitée<input required value={form.fonction} onChange={(event) => setForm({ ...form, fonction: event.target.value })} /></label><label>Éléments du dossier<textarea rows={4} placeholder="Un élément par ligne" value={form.elements} onChange={(event) => setForm({ ...form, elements: event.target.value })} /></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button compact">Enregistrer</button></div></form></Modal>;
}

function PersonnelStatus({ application, onClose, onSaved }: { application: PersonnelApplication; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(application.statut);
  const [dateEntretien, setDateEntretien] = useState(application.dateEntretien?.slice(0, 16) ?? "");
  const [equipeEntretien, setEquipeEntretien] = useState(application.equipeEntretien ?? "");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await apiFetch(`/candidatures-personnel/${application.id}`, { method: "PATCH", body: JSON.stringify({ statut: status, dateEntretien: dateEntretien || null, equipeEntretien: equipeEntretien || null }) }); onSaved(); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Modification impossible."); } };
  return <Modal title={`Suivi de ${application.prenom} ${application.nom}`} onClose={onClose}><form className="entity-form" onSubmit={submit}><ModalChoice label="Statut" placeholder="Sélectionner un statut" value={status} choices={["DEPOSE", "ENTRETIEN_PROGRAMME", "ENTRETIEN_REALISE", "RETENU", "REFUSE"].map((value) => ({ value, label: statusLabels[value] ?? value }))} onChange={setStatus} />{status === "ENTRETIEN_PROGRAMME" && <><label>Date et heure<input required type="datetime-local" value={dateEntretien} onChange={(event) => setDateEntretien(event.target.value)} /></label><label>Équipe d&apos;entretien<input required value={equipeEntretien} onChange={(event) => setEquipeEntretien(event.target.value)} /></label></>}{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button compact">Enregistrer</button></div></form></Modal>;
}

export function PersonnelPage({ data, meta, search, onSearch, onPage, onRefresh }: { data: PersonnelApplication[]; meta: PersonnelApplicationPage["meta"]; search: string; onSearch: (value: string) => void; onPage: (page: number) => void; onRefresh: () => void }) {
  const [draft, setDraft] = useState(search);
  const [modal, setModal] = useState<"create" | PersonnelApplication | null>(null);
  return <div className="content-scroll"><div className="page-intro"><div><p className="eyebrow">Ressources humaines</p><h2>Recrutement</h2><p>Suivez les dossiers des enseignants et du personnel administratif.</p></div><button className="primary-button compact" onClick={() => setModal("create")}>+ Nouveau dossier</button></div><section className="panel full-panel"><div className="panel-heading"><div><p className="eyebrow">Candidatures</p><h3>{meta.total} dossier(s)</h3></div><div className="toolbar"><form className="search-form" onSubmit={(event) => { event.preventDefault(); onSearch(draft.trim()); }}><input aria-label="Rechercher une candidature personnel" placeholder="Nom, diplôme, fonction..." value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="outline-button small">Rechercher</button></form><button className="outline-button small" onClick={onRefresh}>Actualiser</button></div></div><div className="table-wrap"><table><thead><tr><th>Candidat</th><th>Diplôme</th><th>Fonction</th><th>Statut</th><th>Dossier</th><th>Action</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td className="strong-cell">{item.prenom} {item.nom}</td><td>{item.diplome}</td><td>{item.fonction}</td><td><span className="status status-en_cours">{statusLabels[item.statut] ?? item.statut}</span></td><td>{item.elementsDossier.filter((element) => element.statut === "FOURNI").length}/{item.elementsDossier.length} pièce(s)</td><td><button className="row-action" onClick={() => setModal(item)}>Suivre</button></td></tr>)}{!data.length && <tr><td colSpan={6} className="empty-state">Aucune candidature.</td></tr>}</tbody></table></div>{meta.totalPages > 1 && <div className="pagination-bar"><span>Page {meta.page} sur {meta.totalPages} · {meta.total} dossier(s)</span><div className="pagination-actions"><button className="outline-button small" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Précédente</button><button className="outline-button small" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Suivante</button></div></div>}</section>{modal === "create" && <CreatePersonnel onClose={() => setModal(null)} onSaved={onRefresh} />}{modal !== "create" && modal && <PersonnelStatus application={modal} onClose={() => setModal(null)} onSaved={onRefresh} />}</div>;
}
