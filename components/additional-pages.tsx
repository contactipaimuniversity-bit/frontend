"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ModalChoice } from "@/components/modal-choice";
import {
  CatalogElement,
  Echeance,
  IncompleteReport,
  Person,
  ScholarshipType,
  formatDate,
  formatMoney,
  fullName,
  statusLabels,
} from "@/lib/types";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ErrorMessage({ error }: { error: string }) {
  return error ? <p className="form-error">{error}</p> : null;
}

function PersonForm({
  person,
  onClose,
  onSaved,
}: {
  person?: Person;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nom: person?.nom ?? "",
    prenom: person?.prenom ?? "",
    telephone: person?.telephone ?? "",
    quartier: person?.quartier ?? "",
    dateNaissance: person?.dateNaissance?.slice(0, 10) ?? "",
    lieuNaissance: person?.lieuNaissance ?? "",
    tuteurNom: person?.tuteurNom ?? "",
    tuteurPrenom: person?.tuteurPrenom ?? "",
    tuteurTelephone: person?.tuteurTelephone ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value || null]),
      );
      await apiFetch(person ? `/personnes/${person.id}` : "/personnes", {
        method: person ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={person ? "Modifier la personne" : "Nouvelle personne"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Nom<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></label>
          <label>Prénom<input required value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} /></label>
        </div>
        <div className="form-grid">
          <label>Téléphone<input value={form.telephone} onChange={(event) => setForm({ ...form, telephone: event.target.value })} /></label>
          <label>Quartier<input value={form.quartier} onChange={(event) => setForm({ ...form, quartier: event.target.value })} /></label>
        </div>
        <div className="form-grid">
          <label>Date de naissance<input type="date" value={form.dateNaissance} onChange={(event) => setForm({ ...form, dateNaissance: event.target.value })} /></label>
          <label>Lieu de naissance<input value={form.lieuNaissance} onChange={(event) => setForm({ ...form, lieuNaissance: event.target.value })} /></label>
        </div>
        <p className="eyebrow form-section-label">Tuteur</p>
        <div className="form-grid">
          <label>Nom<input value={form.tuteurNom} onChange={(event) => setForm({ ...form, tuteurNom: event.target.value })} /></label>
          <label>Prénom<input value={form.tuteurPrenom} onChange={(event) => setForm({ ...form, tuteurPrenom: event.target.value })} /></label>
        </div>
        <label>Téléphone du tuteur<input value={form.tuteurTelephone} onChange={(event) => setForm({ ...form, tuteurTelephone: event.target.value })} /></label>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Annuler</button>
          <button className="primary-button compact" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PersonHistory({ person, onClose }: { person: Person; onClose: () => void }) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof loadPersonHistory>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void loadPersonHistory(person.id).then(setHistory).catch((failure) => setError(failure instanceof Error ? failure.message : "Historique indisponible."));
  }, [person.id]);
  return (
    <Modal title={`Historique de ${fullName(person)}`} onClose={onClose}>
      <ErrorMessage error={error} />
      {!history && !error && <p className="empty-state">Chargement...</p>}
      {history && (
        <div className="history-list">
          <div className="detail-grid">
            <div><small>Téléphone</small><strong>{history.personne.telephone ?? "-"}</strong></div>
            <div><small>Quartier</small><strong>{history.personne.quartier ?? "-"}</strong></div>
            <div><small>Enregistrée le</small><strong>{formatDate(history.personne.dateEnregistrement)}</strong></div>
          </div>
          <h4>Demandes de bourse ({history.parcours.demandesBourse.length})</h4>
          {history.parcours.demandesBourse.map((item) => <div className="history-row" key={item.id}><span>{item.filiereSouhaitee}</span><span className={`status status-${item.statut.toLowerCase()}`}>{statusLabels[item.statut] ?? item.statut}</span></div>)}
          <h4>Inscriptions ({history.parcours.inscriptions.length})</h4>
          {history.parcours.inscriptions.map((item) => <div className="history-row" key={item.id}><span>{item.filiere} · {item.anneeScolaire}</span><span>{statusLabels[item.statut] ?? item.statut}</span></div>)}
          {!history.parcours.demandesBourse.length && !history.parcours.inscriptions.length && <p className="empty-state">Aucun parcours enregistré.</p>}
        </div>
      )}
    </Modal>
  );
}

async function loadPersonHistory(id: string) {
  return apiFetch<{
    personne: Person;
    parcours: { demandesBourse: Array<{ id: string; statut: string; filiereSouhaitee: string }>; inscriptions: Array<{ id: string; statut: string; filiere: string; anneeScolaire: string }> };
  }>(`/personnes/${id}/historique`);
}

export function PeoplePage({ people, peopleMeta, onPeopleSearch, onPeoplePage, onRefresh }: { people: Person[]; peopleMeta: { page: number; total: number; totalPages: number }; onPeopleSearch: (value: string) => void; onPeoplePage: (page: number) => void; onRefresh: () => void }) {
  const [modal, setModal] = useState<"create" | "edit" | "history" | null>(null);
  const [selected, setSelected] = useState<Person>();
  const [searchDraft, setSearchDraft] = useState("");
  const open = (next: typeof modal, person?: Person) => { setSelected(person); setModal(next); };
  return (
    <div className="content-scroll">
      <div className="page-intro"><div><p className="eyebrow">Répertoire</p><h2>Personnes</h2><p>Centralisez les candidats, étudiants et responsables.</p></div><button className="primary-button compact" onClick={() => open("create")}>+ Nouvelle personne</button></div>
      <section className="panel full-panel"><div className="panel-heading"><div><p className="eyebrow">Registre</p><h3>{peopleMeta.total} personne(s) enregistrée(s)</h3></div><div className="toolbar"><form className="search-form" onSubmit={(event) => { event.preventDefault(); onPeopleSearch(searchDraft.trim()); }}><input aria-label="Rechercher une personne" placeholder="Nom, téléphone, quartier..." value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /><button className="outline-button small">Rechercher</button></form><button className="outline-button small" onClick={onRefresh}>Actualiser</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>Nom complet</th><th>Téléphone</th><th>Quartier</th><th>Enregistrement</th><th>Actions</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><div className="person-cell"><span className="person-avatar">{fullName(person).slice(0, 1)}</span>{fullName(person)}</div></td><td>{person.telephone ?? "-"}</td><td>{person.quartier ?? "-"}</td><td>{formatDate(person.dateEnregistrement)}</td><td className="action-group"><button className="row-action" onClick={() => open("history", person)}>Historique</button><button className="row-action" onClick={() => open("edit", person)}>Modifier</button></td></tr>)}{!people.length && <tr><td colSpan={5} className="empty-state">Aucune personne enregistrée.</td></tr>}</tbody></table></div>
        {peopleMeta.totalPages > 1 && <div className="pagination-bar"><span>Page {peopleMeta.page} sur {peopleMeta.totalPages} · {peopleMeta.total} personne(s)</span><div className="pagination-actions"><button className="outline-button small" disabled={peopleMeta.page <= 1} onClick={() => onPeoplePage(peopleMeta.page - 1)}>Précédente</button><button className="outline-button small" disabled={peopleMeta.page >= peopleMeta.totalPages} onClick={() => onPeoplePage(peopleMeta.page + 1)}>Suivante</button></div></div>}
      </section>
      {modal === "create" && <PersonForm onClose={() => setModal(null)} onSaved={onRefresh} />}
      {modal === "edit" && selected && <PersonForm person={selected} onClose={() => setModal(null)} onSaved={onRefresh} />}
      {modal === "history" && selected && <PersonHistory person={selected} onClose={() => setModal(null)} />}
    </div>
  );
}

function ReferenceForm({ type, element, onClose, onSaved }: { type: "element" | "scholarship"; element?: CatalogElement; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nom: element?.nom ?? "", categorie: element?.categorie ?? "DOCUMENT", contexte: element?.contexte ?? "TOUS", niveauApplicable: element?.niveauApplicable ?? "TOUS", obligatoire: element?.obligatoire ?? true, montantAttendu: element?.montantAttendu?.toString() ?? "", fraisInscription: "", tauxReduction: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = type === "element" ? { nom: form.nom, categorie: form.categorie, contexte: form.contexte, niveauApplicable: form.niveauApplicable, obligatoire: form.obligatoire, montantAttendu: form.montantAttendu || null } : { nom: form.nom, fraisInscription: form.fraisInscription, tauxReduction: form.tauxReduction || null };
      await apiFetch(type === "element" && element ? `/elements-requis/${element.id}` : type === "element" ? "/elements-requis" : "/types-bourse", { method: element ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };
  return <Modal title={element ? "Modifier l&apos;élément requis" : type === "element" ? "Nouvel élément requis" : "Nouveau type de bourse"} onClose={onClose}><form className="entity-form" onSubmit={submit}><label>Nom<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></label>{type === "element" ? <><div className="form-grid"><ModalChoice label="Catégorie" placeholder="Sélectionner une catégorie" value={form.categorie} choices={[{ value: "DOCUMENT", label: "Document" }, { value: "FOURNITURE", label: "Fourniture" }, { value: "FRAIS", label: "Frais" }]} onChange={(value) => setForm({ ...form, categorie: value })} /><ModalChoice label="Contexte" placeholder="Sélectionner un contexte" value={form.contexte} choices={[{ value: "TOUS", label: "Tous" }, { value: "BOURSE", label: "Bourse" }, { value: "INSCRIPTION_DIRECTE", label: "Inscription directe" }]} onChange={(value) => setForm({ ...form, contexte: value })} /></div><ModalChoice label="Niveau applicable" placeholder="Sélectionner un niveau" value={form.niveauApplicable} choices={[{ value: "TOUS", label: "Tous" }, { value: "PREMIERE_ANNEE", label: "Première année" }, { value: "DEUXIEME_ANNEE_PLUS", label: "Deuxième année et plus" }]} onChange={(value) => setForm({ ...form, niveauApplicable: value })} /><label className="checkbox-label"><input type="checkbox" checked={form.obligatoire} onChange={(event) => setForm({ ...form, obligatoire: event.target.checked })} /> Élément obligatoire</label></> : <div className="form-grid"><label>Frais d&apos;inscription<input required type="number" min="0" step="0.01" value={form.fraisInscription} onChange={(event) => setForm({ ...form, fraisInscription: event.target.value })} /></label><label>Réduction (%)<input type="number" min="0" max="100" step="0.01" value={form.tauxReduction} onChange={(event) => setForm({ ...form, tauxReduction: event.target.value })} /></label></div>}<ErrorMessage error={error} /><div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button compact" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</button></div></form></Modal>;
}

function ScheduleForm({ type, onClose, onSaved }: { type: ScholarshipType; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ libelle: "", ordre: String((type.echeances?.length ?? 0) + 1), dateEcheance: "", montantAttendu: "" });
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); try { await apiFetch(`/types-bourse/${type.id}/echeances`, { method: "POST", body: JSON.stringify({ ...form, ordre: Number(form.ordre), montantAttendu: form.montantAttendu || null, dateEcheance: form.dateEcheance || null }) }); onSaved(); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Ajout impossible."); } };
  return <Modal title={`Nouvelle échéance · ${type.nom}`} onClose={onClose}><form className="entity-form" onSubmit={submit}><label>Libellé<input required value={form.libelle} onChange={(event) => setForm({ ...form, libelle: event.target.value })} /></label><div className="form-grid"><label>Ordre<input required type="number" min="1" value={form.ordre} onChange={(event) => setForm({ ...form, ordre: event.target.value })} /></label><label>Montant attendu<input type="number" min="0" step="0.01" value={form.montantAttendu} onChange={(event) => setForm({ ...form, montantAttendu: event.target.value })} /></label></div><label>Date d&apos;échéance<input type="date" value={form.dateEcheance} onChange={(event) => setForm({ ...form, dateEcheance: event.target.value })} /></label><ErrorMessage error={error} /><div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button compact">Ajouter</button></div></form></Modal>;
}

export function ReferencesPage({ onRefresh }: { onRefresh: () => void }) {
  const [elements, setElements] = useState<CatalogElement[]>([]);
  const [types, setTypes] = useState<ScholarshipType[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"element" | "scholarship" | "schedule" | null>(null);
  const [selectedElement, setSelectedElement] = useState<CatalogElement>();
  const [selectedType, setSelectedType] = useState<ScholarshipType>();
  const load = async () => { try { const [elementData, typeData] = await Promise.all([apiFetch<CatalogElement[]>("/elements-requis"), apiFetch<ScholarshipType[]>("/types-bourse")]); setElements(elementData); setTypes(typeData); setError(""); } catch (failure) { setError(failure instanceof Error ? failure.message : "Référentiels indisponibles."); } };
  useEffect(() => {
    let active = true;
    void Promise.all([apiFetch<CatalogElement[]>("/elements-requis"), apiFetch<ScholarshipType[]>("/types-bourse")])
      .then(([elementData, typeData]) => { if (active) { setElements(elementData); setTypes(typeData); setError(""); } })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Référentiels indisponibles."); });
    return () => { active = false; };
  }, []);
  const saved = () => { void load(); onRefresh(); };
  return <div className="content-scroll"><div className="page-intro"><div><p className="eyebrow">Configuration</p><h2>Référentiels</h2><p>Paramétrez les pièces exigées et les plans de bourse.</p></div><div className="toolbar"><button className="outline-button small" onClick={() => { setSelectedElement(undefined); setModal("element"); }}>+ Élément</button><button className="primary-button compact" onClick={() => { setSelectedType(undefined); setModal("scholarship"); }}>+ Type de bourse</button></div></div><ErrorMessage error={error} /><div className="reference-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Dossiers</p><h3>Éléments requis</h3></div></div><div className="table-wrap"><table><thead><tr><th>Nom</th><th>Catégorie</th><th>Contexte</th><th>Obligatoire</th><th /></tr></thead><tbody>{elements.map((item) => <tr key={item.id}><td className="strong-cell">{item.nom}</td><td>{item.categorie}</td><td>{item.contexte}</td><td>{item.obligatoire ? "Oui" : "Non"}</td><td><button className="row-action" onClick={() => { setSelectedElement(item); setModal("element"); }}>Modifier</button></td></tr>)}{!elements.length && <tr><td colSpan={5} className="empty-state">Aucun élément configuré.</td></tr>}</tbody></table></div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Financement</p><h3>Types de bourse</h3></div></div><div className="reference-cards">{types.map((type) => <article className="reference-card" key={type.id}><div><strong>{type.nom}</strong><span>{formatMoney(type.fraisInscription)} · {type.tauxReduction ?? 0}% de réduction</span></div><button className="row-action" onClick={() => { setSelectedType(type); setModal("schedule"); }}>+ Échéance</button><div className="schedule-list">{type.echeances?.map((echeance: Echeance) => <span key={echeance.id}>{echeance.ordre}. {echeance.libelle} · {echeance.montantAttendu ? formatMoney(echeance.montantAttendu) : "-"}</span>)}{!type.echeances?.length && <small>Aucune échéance configurée</small>}</div></article>)}{!types.length && <p className="empty-state">Aucun type de bourse.</p>}</div></section></div>{modal === "element" && <ReferenceForm type="element" element={selectedElement} onClose={() => setModal(null)} onSaved={saved} />}{modal === "scholarship" && <ReferenceForm type="scholarship" onClose={() => setModal(null)} onSaved={saved} />}{modal === "schedule" && selectedType && <ScheduleForm type={selectedType} onClose={() => setModal(null)} onSaved={saved} />}</div>;
}

export function ReportsPage() {
  const [report, setReport] = useState<IncompleteReport | null>(null);
  const [latePayments, setLatePayments] = useState<Array<{ echeance: { libelle: string; dateEcheance?: string; typeBourse?: { nom: string } }; resteAPayer: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([apiFetch<IncompleteReport>("/rapports/dossiers-incomplets"), apiFetch<{ echeances: typeof latePayments }>("/rapports/paiements-en-retard")]).then(([incomplete, late]) => { setReport(incomplete); setLatePayments(late.echeances); }).catch((failure) => setError(failure instanceof Error ? failure.message : "Rapports indisponibles.")); }, []);
  return <div className="content-scroll"><div className="page-intro"><div><p className="eyebrow">Pilotage</p><h2>Rapports</h2><p>Priorisez les dossiers incomplets et les échéances à recouvrer.</p></div></div><ErrorMessage error={error} /><div className="report-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Pièces manquantes</p><h3>{report?.total ?? "--"} dossier(s) incomplet(s)</h3></div></div><div className="report-list">{report?.dossiers.map((item) => <article className="report-row" key={`${item.dossierType}-${item.dossierId}`}><div><strong>{fullName(item.personne)}</strong><span>{item.dossierType === "demande-bourse" ? "Demande de bourse" : "Inscription"}</span></div><div className="report-tags">{item.elementsManquants.map((element) => <span className="tag" key={element.id}>{element.elementRequis.nom}</span>)}</div></article>)}{report && !report.dossiers.length && <p className="empty-state">Tous les dossiers sont complets.</p>}</div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Recouvrement</p><h3>{latePayments.length} échéance(s) en retard</h3></div></div><div className="report-list">{latePayments.map((item, index) => <div className="report-row" key={`${item.echeance.libelle}-${index}`}><div><strong>{item.echeance.libelle}</strong><span>{item.echeance.typeBourse?.nom ?? "Bourse"} · {formatDate(item.echeance.dateEcheance)}</span></div><strong className="report-amount">{formatMoney(item.resteAPayer)}</strong></div>)}{!latePayments.length && <p className="empty-state">Aucun retard de paiement.</p>}</div></section></div></div>;
}
