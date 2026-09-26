"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ModalChoice } from "@/components/modal-choice";
import {
  Application,
  ApplicationPage,
  ApplicationFinance,
  Enrollment,
  EnrollmentPage,
  LatePayment,
  Person,
  PersonPage,
  Prospect,
  RequiredElement,
  ScholarshipType,
  UnassignedPayment,
  ViewName,
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
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
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

function FormActions({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="form-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>
        Annuler
      </button>
      <button className="primary-button compact" disabled={busy}>
        {busy ? "Enregistrement..." : "Enregistrer"}
      </button>
    </div>
  );
}

function CreateApplication({
  people,
  onClose,
  onSaved,
}: {
  people: Person[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    personneId: "",
    niveauDemande: "PREMIERE_ANNEE",
    filiereSouhaitee: "",
    filiereSecondaireSouhaitee: "",
    ecoleOrigine: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/demandes-bourse", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Impossible de créer la demande.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouvelle demande de bourse" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <ModalChoice
          required
          label="Candidat"
          placeholder="Sélectionner une personne"
          value={form.personneId}
          choices={people.map((person) => ({ value: person.id, label: fullName(person) }))}
          loadChoices={async (query, page) => {
            const result = await apiFetch<PersonPage>(
              `/personnes?page=${page}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`,
            );
            return { choices: result.data.map((person) => ({ value: person.id, label: fullName(person) })), hasMore: result.meta.page < result.meta.totalPages };
          }}
          onChange={(value) => setForm({ ...form, personneId: value })}
        />
        <ModalChoice
          label="Niveau"
          placeholder="Sélectionner un niveau"
          value={form.niveauDemande}
          choices={[{ value: "PREMIERE_ANNEE", label: "Première année" }, { value: "DEUXIEME_ANNEE", label: "Deuxième année" }]}
          onChange={(value) => setForm({ ...form, niveauDemande: value })}
        />
        <label>
          Filière souhaitée
          <input
            required
            value={form.filiereSouhaitee}
            onChange={(event) =>
              setForm({ ...form, filiereSouhaitee: event.target.value })
            }
          />
        </label>
        <label>
          Filière secondaire souhaitée (facultatif)
          <input
            value={form.filiereSecondaireSouhaitee}
            onChange={(event) =>
              setForm({ ...form, filiereSecondaireSouhaitee: event.target.value })
            }
          />
        </label>
        <label>
          École d&apos;origine
          <input
            value={form.ecoleOrigine}
            onChange={(event) =>
              setForm({ ...form, ecoleOrigine: event.target.value })
            }
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function CreateEnrollment({
  people,
  applications,
  onClose,
  onSaved,
}: {
  people: Person[];
  applications: Application[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    personneId: "",
    anneeScolaire: "2026-2027",
    niveau: "",
    filiere: "",
    viaBourse: false,
    demandeBourseId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const linkedApplication = applications.find(
        (application) => application.id === form.demandeBourseId,
      );
      const confirmerDemandeEnCours =
        form.viaBourse &&
        linkedApplication !== undefined &&
        linkedApplication.statut !== "ACCEPTEE";
      if (
        confirmerDemandeEnCours &&
        !window.confirm(
          "Cette demande de bourse est encore en attente de décision. Voulez-vous continuer ?",
        )
      ) {
        setBusy(false);
        return;
      }
      const body = {
        ...form,
        demandeBourseId: form.viaBourse ? form.demandeBourseId : undefined,
        confirmerDemandeEnCours,
      };
      await apiFetch("/inscriptions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Impossible de créer l'inscription.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouvelle inscription" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <ModalChoice
          required
          label="Étudiant"
          placeholder="Sélectionner une personne"
          value={form.personneId}
          choices={people.map((person) => ({ value: person.id, label: fullName(person) }))}
          loadChoices={async (query, page) => {
            const result = await apiFetch<PersonPage>(
              `/personnes?page=${page}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`,
            );
            return { choices: result.data.map((person) => ({ value: person.id, label: fullName(person) })), hasMore: result.meta.page < result.meta.totalPages };
          }}
          onChange={(value) => setForm({ ...form, personneId: value })}
        />
        <label>
          Année scolaire
          <input
            required
            value={form.anneeScolaire}
            onChange={(event) =>
              setForm({ ...form, anneeScolaire: event.target.value })
            }
          />
        </label>
        <label>
          Niveau
          <input
            required
            value={form.niveau}
            onChange={(event) =>
              setForm({ ...form, niveau: event.target.value })
            }
          />
        </label>
        <label>
          Filière
          <input
            required
            value={form.filiere}
            onChange={(event) =>
              setForm({ ...form, filiere: event.target.value })
            }
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.viaBourse}
            onChange={(event) =>
              setForm({ ...form, viaBourse: event.target.checked })
            }
          />{" "}
          Inscription via une bourse
        </label>
        {form.viaBourse && (
          <ModalChoice
            required
            label="Demande liée"
            placeholder="Sélectionner une demande"
            value={form.demandeBourseId}
            choices={applications.map((application) => ({ value: application.id, label: fullName(application.personne), detail: application.filiereSouhaitee }))}
            loadChoices={async (query, page) => {
              const result = await apiFetch<ApplicationPage>(
                `/demandes-bourse?page=${page}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`,
              );
              return { choices: result.data.map((application) => ({ value: application.id, label: fullName(application.personne), detail: application.filiereSouhaitee })), hasMore: result.meta.page < result.meta.totalPages };
            }}
            onChange={(value) => setForm({ ...form, demandeBourseId: value })}
          />
        )}
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function CreateProspect({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    filiereSouhaitee: "",
    intention: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/prospects", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Impossible de créer le prospect.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouveau prospect" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Nom
            <input
              required
              value={form.nom}
              onChange={(event) =>
                setForm({ ...form, nom: event.target.value })
              }
            />
          </label>
          <label>
            Prénom
            <input
              required
              value={form.prenom}
              onChange={(event) =>
                setForm({ ...form, prenom: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Téléphone
          <input
            value={form.telephone}
            onChange={(event) =>
              setForm({ ...form, telephone: event.target.value })
            }
          />
        </label>
        <label>
          Filière souhaitée
          <input
            value={form.filiereSouhaitee}
            onChange={(event) =>
              setForm({ ...form, filiereSouhaitee: event.target.value })
            }
          />
        </label>
        <label>
          Intention
          <input
            value={form.intention}
            onChange={(event) =>
              setForm({ ...form, intention: event.target.value })
            }
            placeholder="Ex. veut visiter le campus"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function CreatePayment({
  applications,
  enrollments,
  scholarshipTypes,
  onClose,
  onSaved,
}: {
  applications: Application[];
  enrollments: Enrollment[];
  scholarshipTypes: ScholarshipType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    dossierType: "demandeBourseId",
    dossierId: "",
    montant: "",
    typePaiement: "FRAIS_DEPOT",
    echeanceId: "",
  });
  const [matchingApplications, setMatchingApplications] = useState(applications);
  const [matchingEnrollments, setMatchingEnrollments] = useState(enrollments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dossiers =
    form.dossierType === "demandeBourseId" ? matchingApplications : matchingEnrollments;
  const selectedDossier = dossiers.find((dossier) => dossier.id === form.dossierId);
  const selectedTypeId = form.dossierType === "demandeBourseId"
    ? (selectedDossier as Application | undefined)?.typeBourse?.id
    : (selectedDossier as Enrollment | undefined)?.demandeBourse?.typeBourseId;
  const selectedType = scholarshipTypes.find((type) => type.id === selectedTypeId);
  const loadPaymentDossiers = useCallback(async (query: string, page: number) => {
    if (form.dossierType === "demandeBourseId") {
      const result = await apiFetch<ApplicationPage>(
        `/demandes-bourse?page=${page}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      );
      setMatchingApplications((current) => page === 1 ? result.data : [...current, ...result.data]);
      return { choices: result.data.map((dossier) => ({ value: dossier.id, label: fullName(dossier.personne), detail: dossier.filiereSouhaitee })), hasMore: result.meta.page < result.meta.totalPages };
    }
    const result = await apiFetch<EnrollmentPage>(
      `/inscriptions?page=${page}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`,
    );
    setMatchingEnrollments((current) => page === 1 ? result.data : [...current, ...result.data]);
    return { choices: result.data.map((dossier) => ({ value: dossier.id, label: fullName(dossier.personne), detail: dossier.filiere })), hasMore: result.meta.page < result.meta.totalPages };
  }, [form.dossierType]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/paiements", {
        method: "POST",
        body: JSON.stringify({
          [form.dossierType]: form.dossierId,
          montant: form.montant,
          typePaiement: form.typePaiement,
          echeanceId: form.echeanceId || undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Impossible d'enregistrer le paiement.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Enregistrer un paiement" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <ModalChoice
          label="Dossier concerné"
          placeholder="Sélectionner le type de dossier"
          value={form.dossierType}
          choices={[{ value: "demandeBourseId", label: "Demande de bourse" }, { value: "inscriptionId", label: "Inscription" }]}
          onChange={(value) => setForm({ ...form, dossierType: value, dossierId: "" })}
        />
        <ModalChoice
          required
          label="Personne / dossier"
          placeholder="Sélectionner un dossier"
          value={form.dossierId}
          choices={dossiers.map((dossier) => ({ value: dossier.id, label: fullName(dossier.personne), detail: "filiereSouhaitee" in dossier ? dossier.filiereSouhaitee : dossier.filiere }))}
          loadChoices={loadPaymentDossiers}
          onChange={(value) => setForm({ ...form, dossierId: value })}
        />
        <label>
          Montant
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.montant}
            onChange={(event) =>
              setForm({ ...form, montant: event.target.value })
            }
          />
        </label>
        <ModalChoice
          label="Type de paiement"
          placeholder="Sélectionner un type"
          value={form.typePaiement}
          choices={[{ value: "FRAIS_DEPOT", label: "Frais de dépôt" }, { value: "FRAIS_INSCRIPTION", label: "Frais d'inscription" }, { value: "ECHEANCE_BOURSE", label: "Échéance bourse" }]}
          onChange={(value) => setForm({ ...form, typePaiement: value, echeanceId: "" })}
        />
        {form.typePaiement === "ECHEANCE_BOURSE" && (
          <ModalChoice
            required
            label="Échéance de bourse"
            placeholder={selectedType ? "Sélectionner une échéance" : "Le dossier n'a pas de bourse"}
            value={form.echeanceId}
            choices={selectedType?.echeances?.map((echeance) => ({
              value: echeance.id,
              label: echeance.libelle,
              detail: echeance.montantAttendu ? formatMoney(echeance.montantAttendu) : undefined,
            })) ?? []}
            onChange={(value) => setForm({ ...form, echeanceId: value })}
          />
        )}
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function EditStatus({
  title,
  endpoint,
  field,
  initial,
  options,
  scholarshipTypes,
  onClose,
  onSaved,
}: {
  title: string;
  endpoint: string;
  field: string;
  initial: string;
  options: string[];
  scholarshipTypes?: ScholarshipType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [typeBourseId, setTypeBourseId] = useState(
    scholarshipTypes?.[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body =
        field === "statut" && scholarshipTypes && value === "ACCEPTEE"
          ? { statut: value, typeBourseId }
          : { [field]: value };
      await apiFetch(endpoint, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Modification impossible.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <ModalChoice
          label="Nouveau statut"
          placeholder="Sélectionner un statut"
          value={value}
          choices={options.map((option) => ({ value: option, label: statusLabels[option] ?? option }))}
          onChange={setValue}
        />
        {scholarshipTypes && (
          <ModalChoice
            required
            label="Type de bourse"
            placeholder="Sélectionner un type"
            value={typeBourseId}
            choices={scholarshipTypes.map((type) => ({ value: type.id, label: type.nom }))}
            onChange={setTypeBourseId}
          />
        )}
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function InterviewForm({
  application,
  onClose,
  onSaved,
}: {
  application: Application;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    dateEntretien: application.dateEntretien
      ? application.dateEntretien.slice(0, 16)
      : "",
    equipeEntretien: application.equipeEntretien ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/demandes-bourse/${application.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          dateEntretien: form.dateEntretien || null,
          equipeEntretien: form.equipeEntretien || null,
        }),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Planification impossible.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Planifier l'entretien" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>
          Date et heure
          <input
            required
            type="datetime-local"
            value={form.dateEntretien}
            onChange={(event) =>
              setForm({ ...form, dateEntretien: event.target.value })
            }
          />
        </label>
        <label>
          Équipe d&apos;entretien
          <input
            required
            value={form.equipeEntretien}
            onChange={(event) =>
              setForm({ ...form, equipeEntretien: event.target.value })
            }
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function ElementsModal({
  dossierType,
  dossierId,
  onClose,
}: {
  dossierType: "demande-bourse" | "inscription";
  dossierId: string;
  onClose: () => void;
}) {
  const [elements, setElements] = useState<RequiredElement[] | null>(null);
  const [error, setError] = useState("");
  const resource =
    dossierType === "demande-bourse" ? "demandes-bourse" : "inscriptions";
  useEffect(() => {
    void apiFetch<RequiredElement[]>(`/${resource}/${dossierId}/elements`)
      .then(setElements)
      .catch((failure) =>
        setError(
          failure instanceof Error
            ? failure.message
            : "Impossible de charger les pièces.",
        ),
      );
  }, [dossierId, resource]);
  const update = async (element: RequiredElement, statut: string) => {
    try {
      await apiFetch(
        `/${resource}/${dossierId}/elements/${element.elementRequis.id}`,
        { method: "PATCH", body: JSON.stringify({ statut }) },
      );
      setElements(
        (current) =>
          current?.map((item) =>
            item.id === element.id ? { ...item, statut } : item,
          ) ?? null,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Mise à jour impossible.",
      );
    }
  };
  return (
    <Modal title="Pièces du dossier" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      {!elements && !error && <p className="empty-state">Chargement...</p>}
      <div className="elements-list">
        {elements?.map((element) => (
          <div className="element-row" key={element.id}>
            <div>
              <strong>{element.elementRequis.nom}</strong>
              <small>
                {element.elementRequis.obligatoire
                  ? "Obligatoire"
                  : "Facultatif"}
              </small>
            </div>
            <ModalChoice
              label="Statut"
              placeholder="Sélectionner un statut"
              value={element.statut}
              choices={[{ value: "ATTENDU", label: "Attendu" }, { value: "FOURNI", label: "Fourni" }, { value: "MANQUANT", label: "Manquant" }, { value: "SUBSTITUE", label: "Substitué" }]}
              onChange={(value) => void update(element, value)}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}

function FinanceModal({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const [finance, setFinance] = useState<ApplicationFinance | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void apiFetch<ApplicationFinance>(`/demandes-bourse/${applicationId}/finance`)
      .then(setFinance)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Situation financière indisponible."));
  }, [applicationId]);
  return <Modal title="Situation financière de la demande" onClose={onClose}>{error && <p className="form-error">{error}</p>}{!finance && !error && <p className="empty-state">Chargement...</p>}{finance && <><div className="payment-summary"><strong>{formatMoney(finance.totalAttendu)}</strong><span>attendu</span><strong>{formatMoney(finance.totalPaye)}</strong><span>payé</span><strong>{formatMoney(String(Number(finance.totalAttendu) - Number(finance.totalPaye)))}</strong><span>reste</span></div><div className="table-wrap"><table><thead><tr><th>Obligation</th><th>Statut</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>{finance.obligations.map((item) => <tr key={item.id}><td className="strong-cell">{item.nom}</td><td>{statusLabels[item.statut] ?? item.statut}</td><td>{formatMoney(item.montantAttendu)}</td><td>{formatMoney(item.montantPaye)}</td><td><span className="status status-refusee">{formatMoney(item.resteAPayer)}</span></td></tr>)}</tbody></table></div><p className="panel-subtitle">Paiements non affectés : {formatMoney(finance.montantPayeNonAffecte)}</p></>}</Modal>;
}

function AssignPaymentModal({ payment, onClose, onSaved }: { payment: UnassignedPayment; onClose: () => void; onSaved: () => void }) {
  const [elements, setElements] = useState<RequiredElement[] | null>(null);
  const [elementDossierId, setElementDossierId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resource = payment.dossierType === "demande-bourse" ? "demandes-bourse" : "inscriptions";
  useEffect(() => {
    void apiFetch<RequiredElement[]>(`/${resource}/${payment.dossierId}/elements`)
      .then(setElements)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Obligations indisponibles."));
  }, [payment.dossierId, resource]);
  const choices = (elements ?? []).flatMap((element) => {
    if (element.montantAttendu === null || element.montantAttendu === undefined) return [];
    const paid = (element.paiements ?? []).reduce((sum, item) => sum + Number(item.montant), 0);
    const remaining = Number(element.montantAttendu) - paid;
    return remaining > 0 ? [{ value: element.id, label: element.elementRequis.nom, detail: `${formatMoney(remaining)} restant` }] : [];
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/paiements/${payment.id}/affectation`, {
        method: "PATCH",
        body: JSON.stringify({ elementDossierId }),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Affectation impossible.");
    } finally {
      setBusy(false);
    }
  };
  return <Modal title="Affecter le paiement" onClose={onClose}><form className="entity-form" onSubmit={submit}><p>{fullName(payment.personne)} · {formatMoney(payment.montant)}</p>{elements === null && !error && <p className="empty-state">Chargement des obligations...</p>}{elements && <>{choices.length ? <ModalChoice required label="Obligation" placeholder="Sélectionner une obligation" value={elementDossierId} choices={choices} onChange={setElementDossierId} /> : <p className="empty-state">Aucune obligation financière ne reste à régler.</p>}</>}{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button compact" disabled={busy || !elementDossierId}>{busy ? "Affectation..." : "Affecter"}</button></div></form></Modal>;
}

function UnassignedPaymentsPanel({ onRefresh }: { onRefresh: () => void }) {
  const [payments, setPayments] = useState<UnassignedPayment[]>([]);
  const [selected, setSelected] = useState<UnassignedPayment | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      setPayments(await apiFetch<UnassignedPayment[]>("/paiements/non-affectes"));
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Paiements non affectés indisponibles.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    void apiFetch<UnassignedPayment[]>("/paiements/non-affectes")
      .then((result) => { if (active) setPayments(result); })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Paiements non affectés indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <><section className="panel full-panel"><div className="panel-heading"><div><p className="eyebrow">Affectation</p><h3>{payments.length} paiement(s) à affecter</h3></div><button className="outline-button small" onClick={() => void load()}>Actualiser</button></div>{error && <p className="form-error">{error}</p>}{loading && <p className="empty-state">Chargement...</p>}{!loading && <div className="table-wrap"><table><thead><tr><th>Date</th><th>Personne</th><th>Dossier</th><th>Type</th><th>Montant</th><th /></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.datePaiement)}</td><td className="strong-cell">{fullName(payment.personne)}</td><td>{payment.dossierType === "demande-bourse" ? "Demande de bourse" : "Inscription"}</td><td>{statusLabels[payment.typePaiement] ?? payment.typePaiement}</td><td>{formatMoney(payment.montant)}</td><td><button className="row-action" onClick={() => setSelected(payment)}>Affecter</button></td></tr>)}{!payments.length && <tr><td colSpan={6} className="empty-state">Tous les paiements sont affectés.</td></tr>}</tbody></table></div>}</section>{selected && <AssignPaymentModal payment={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load(); onRefresh(); }} />}</>;
}

export function OperationsPage({
  view,
  applications,
  enrollments,
  prospects,
  people,
  latePayments,
  scholarshipTypes,
  applicationMeta,
  onApplicationSearch,
  onApplicationPage,
  enrollmentMeta,
  onEnrollmentSearch,
  onEnrollmentPage,
  prospectMeta,
  onProspectSearch,
  onProspectPage,
  onRefresh,
}: {
  view: Exclude<ViewName, "Vue d'ensemble">;
  applications: Application[];
  enrollments: Enrollment[];
  prospects: Prospect[];
  people: Person[];
  latePayments: LatePayment[];
  scholarshipTypes: ScholarshipType[];
  applicationMeta: { page: number; total: number; totalPages: number };
  onApplicationSearch: (value: string) => void;
  onApplicationPage: (page: number) => void;
  enrollmentMeta: { page: number; total: number; totalPages: number };
  onEnrollmentSearch: (value: string) => void;
  onEnrollmentPage: (page: number) => void;
  prospectMeta: { page: number; total: number; totalPages: number };
  onProspectSearch: (value: string) => void;
  onProspectPage: (page: number) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState("ALL");
  const [searchDraft, setSearchDraft] = useState("");
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const [modal, setModal] = useState<
    | "application"
    | "enrollment"
    | "prospect"
    | "payment"
    | "status"
    | "interview"
    | "finance"
    | "elements"
    | null
  >(null);
  const [selectedId, setSelectedId] = useState("");
  const filteredApplications =
    filter === "ALL"
      ? applications
      : applications.filter((item) => item.statut === filter);
  const filteredEnrollments =
    filter === "ALL"
      ? enrollments
      : enrollments.filter((item) => item.statut === filter);
  const filteredProspects =
    filter === "ALL"
      ? prospects
      : prospects.filter((item) => item.statutRelance === filter);
  const refreshAfterPayment = () => {
    onRefresh();
    setPaymentsRefreshKey((current) => current + 1);
  };
  const selectedApplication = applications.find(
    (item) => item.id === selectedId,
  );
  const selectedEnrollment = enrollments.find((item) => item.id === selectedId);
  const selectedProspect = prospects.find((item) => item.id === selectedId);
  const open = (kind: typeof modal, id = "") => {
    setSelectedId(id);
    setModal(kind);
  };
  const addButton =
    view === "Demandes de bourse" ? (
      <button
        className="primary-button compact"
        onClick={() => open("application")}
      >
        + Nouvelle demande
      </button>
    ) : view === "Inscriptions" ? (
      <button
        className="primary-button compact"
        onClick={() => open("enrollment")}
      >
        + Nouvelle inscription
      </button>
    ) : view === "Prospects" ? (
      <button
        className="primary-button compact"
        onClick={() => open("prospect")}
      >
        + Nouveau prospect
      </button>
    ) : view === "Paiements" ? (
      <button
        className="primary-button compact"
        onClick={() => open("payment")}
      >
        + Enregistrer un paiement
      </button>
    ) : null;
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Gestion opérationnelle</p>
          <h2>{view}</h2>
          <p>
            Consultez et modifiez les dossiers directement depuis le backend.
          </p>
        </div>
        {addButton}
      </div>
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Registre</p>
            <h3>
              {view === "Paiements"
                ? "Échéances en retard"
                : `Liste des ${view.toLowerCase()}`}
            </h3>
          </div>
          <div className="toolbar">
            {view === "Demandes de bourse" && (
              <form
                className="search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onApplicationSearch(searchDraft.trim());
                }}
              >
                <input
                  aria-label="Rechercher une demande"
                  placeholder="Nom, téléphone, filière..."
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
                <button className="outline-button small">Rechercher</button>
              </form>
            )}
            {view === "Inscriptions" && (
              <form
                className="search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onEnrollmentSearch(searchDraft.trim());
                }}
              >
                <input
                  aria-label="Rechercher une inscription"
                  placeholder="Nom, téléphone, filière..."
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
                <button className="outline-button small">Rechercher</button>
              </form>
            )}
            {view === "Prospects" && (
              <form
                className="search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onProspectSearch(searchDraft.trim());
                }}
              >
                <input
                  aria-label="Rechercher un prospect"
                  placeholder="Nom, téléphone, filière..."
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
                <button className="outline-button small">Rechercher</button>
              </form>
            )}
            {view !== "Paiements" && (
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="ALL">Tous les statuts</option>
                {(view === "Demandes de bourse"
                  ? [
                      "EN_ATTENTE",
                      "ENTRETIEN_PROGRAMME",
                      "EN_DELIBERATION",
                      "ACCEPTEE",
                      "REFUSEE",
                    ]
                  : view === "Inscriptions"
                    ? ["EN_COURS", "COMPLETE", "ABANDONNEE"]
                    : ["A_RELANCER", "RELANCE", "CONVERTI", "ABANDONNE"]
                ).map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>
            )}
            <button className="outline-button small" onClick={onRefresh}>
              Actualiser
            </button>
          </div>
        </div>
        {view === "Demandes de bourse" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Candidat</th>
                  <th>Filière</th>
                  <th>Statut</th>
                  <th>Dépôt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((item) => (
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
                    <td className="action-group">
                      <button
                        className="row-action"
                        onClick={() => open("status", item.id)}
                      >
                        Décider
                      </button>
                      <button
                        className="row-action"
                        onClick={() => open("elements", item.id)}
                      >
                        Pièces
                      </button>
                      <button
                        className="row-action"
                        onClick={() => open("interview", item.id)}
                      >
                        Entretien
                      </button>
                      <button
                        className="row-action"
                        onClick={() => open("finance", item.id)}
                      >
                        Finance
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredApplications.length && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Aucune demande.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {view === "Inscriptions" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Filière</th>
                  <th>Niveau</th>
                  <th>Année</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar">
                          {fullName(item.personne).slice(0, 1)}
                        </span>
                        {fullName(item.personne)}
                      </div>
                    </td>
                    <td>{item.filiere}</td>
                    <td>{item.niveau}</td>
                    <td>{item.anneeScolaire}</td>
                    <td>
                      <span
                        className={`status status-${item.statut.toLowerCase()}`}
                      >
                        {statusLabels[item.statut]}
                      </span>
                    </td>
                    <td className="action-group">
                      <button
                        className="row-action"
                        onClick={() => open("status", item.id)}
                      >
                        Modifier
                      </button>
                      <button
                        className="row-action"
                        onClick={() => open("elements", item.id)}
                      >
                        Pièces
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredEnrollments.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Aucune inscription.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {view === "Prospects" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prospect</th>
                  <th>Téléphone</th>
                  <th>Filière</th>
                  <th>Intention</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProspects.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar">
                          {fullName(item.personne).slice(0, 1)}
                        </span>
                        {fullName(item.personne)}
                      </div>
                    </td>
                    <td>{item.personne?.telephone ?? "-"}</td>
                    <td>{item.filiereSouhaitee ?? "-"}</td>
                    <td>{item.intention ?? "-"}</td>
                    <td>
                      <span className="status status-en_attente">
                        {statusLabels[item.statutRelance]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="row-action"
                        onClick={() => open("status", item.id)}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredProspects.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Aucun prospect.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {view === "Paiements" && (
          <>
            <div className="payment-summary">
              <strong>{latePayments.length}</strong>
              <span>échéance(s) en retard</span>
              <strong>
                {formatMoney(
                  latePayments.reduce(
                    (total, item) => total + Number(item.resteAPayer),
                    0,
                  ),
                )}
              </strong>
              <span>reste à payer</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Échéance</th>
                    <th>Type</th>
                    <th>Date limite</th>
                    <th>Attendu</th>
                    <th>Payé</th>
                    <th>Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {latePayments.map((item, index) => (
                    <tr key={`${item.echeance.libelle}-${index}`}>
                      <td className="strong-cell">{item.echeance.libelle}</td>
                      <td>{item.echeance.typeBourse?.nom ?? "-"}</td>
                      <td>{formatDate(item.echeance.dateEcheance)}</td>
                      <td>{formatMoney(item.montantAttendu)}</td>
                      <td>{formatMoney(item.montantPaye)}</td>
                      <td>
                        <span className="status status-refusee">
                          {formatMoney(item.resteAPayer)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!latePayments.length && (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        Aucun paiement en retard.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <UnassignedPaymentsPanel key={paymentsRefreshKey} onRefresh={onRefresh} />
          </>
        )}
        {view === "Demandes de bourse" && applicationMeta.totalPages > 1 && (
          <div className="pagination-bar">
            <span>
              Page {applicationMeta.page} sur {applicationMeta.totalPages} · {applicationMeta.total} demande(s)
            </span>
            <div className="pagination-actions">
              <button
                className="outline-button small"
                disabled={applicationMeta.page <= 1}
                onClick={() => onApplicationPage(applicationMeta.page - 1)}
              >
                Précédente
              </button>
              <button
                className="outline-button small"
                disabled={applicationMeta.page >= applicationMeta.totalPages}
                onClick={() => onApplicationPage(applicationMeta.page + 1)}
              >
                Suivante
              </button>
            </div>
          </div>
        )}
        {view === "Inscriptions" && enrollmentMeta.totalPages > 1 && (
          <div className="pagination-bar">
            <span>
              Page {enrollmentMeta.page} sur {enrollmentMeta.totalPages} · {enrollmentMeta.total} inscription(s)
            </span>
            <div className="pagination-actions">
              <button
                className="outline-button small"
                disabled={enrollmentMeta.page <= 1}
                onClick={() => onEnrollmentPage(enrollmentMeta.page - 1)}
              >
                Précédente
              </button>
              <button
                className="outline-button small"
                disabled={enrollmentMeta.page >= enrollmentMeta.totalPages}
                onClick={() => onEnrollmentPage(enrollmentMeta.page + 1)}
              >
                Suivante
              </button>
            </div>
          </div>
        )}
        {view === "Prospects" && prospectMeta.totalPages > 1 && (
          <div className="pagination-bar">
            <span>
              Page {prospectMeta.page} sur {prospectMeta.totalPages} · {prospectMeta.total} prospect(s)
            </span>
            <div className="pagination-actions">
              <button
                className="outline-button small"
                disabled={prospectMeta.page <= 1}
                onClick={() => onProspectPage(prospectMeta.page - 1)}
              >
                Précédente
              </button>
              <button
                className="outline-button small"
                disabled={prospectMeta.page >= prospectMeta.totalPages}
                onClick={() => onProspectPage(prospectMeta.page + 1)}
              >
                Suivante
              </button>
            </div>
          </div>
        )}
      </section>
      {modal === "application" && (
        <CreateApplication
          people={people}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
      {modal === "enrollment" && (
        <CreateEnrollment
          people={people}
          applications={applications}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
      {modal === "prospect" && (
        <CreateProspect onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === "payment" && (
        <CreatePayment
          applications={applications}
          enrollments={enrollments}
          scholarshipTypes={scholarshipTypes}
          onClose={() => setModal(null)}
          onSaved={refreshAfterPayment}
        />
      )}
      {modal === "elements" && (
        <ElementsModal
          dossierType={selectedApplication ? "demande-bourse" : "inscription"}
          dossierId={selectedId}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "interview" && selectedApplication && (
        <InterviewForm
          application={selectedApplication}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
      {modal === "finance" && selectedApplication && (
        <FinanceModal
          applicationId={selectedApplication.id}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "status" && selectedApplication && (
        <EditStatus
          title="Décision de la demande"
          endpoint={`/demandes-bourse/${selectedId}/decision`}
          field="statut"
          initial={selectedApplication.statut}
          options={["EN_DELIBERATION", "ACCEPTEE", "REFUSEE"]}
          scholarshipTypes={scholarshipTypes}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
      {modal === "status" && selectedEnrollment && (
        <EditStatus
          title="Modifier l'inscription"
          endpoint={`/inscriptions/${selectedId}`}
          field="statut"
          initial={selectedEnrollment.statut}
          options={["EN_COURS", "COMPLETE", "ABANDONNEE"]}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
      {modal === "status" && selectedProspect && (
        <EditStatus
          title="Modifier le suivi"
          endpoint={`/prospects/${selectedId}`}
          field="statutRelance"
          initial={selectedProspect.statutRelance}
          options={["A_RELANCER", "RELANCE", "CONVERTI", "ABANDONNE"]}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
