"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { ModalChoice } from "@/components/modal-choice";
import { PersonForm } from "@/components/additional-pages";
import { BrandLogo } from "@/components/brand-logo";
import { getAcceptedApplicationsForEnrollment } from "@/lib/enrollment-eligibility";
import {
  Application,
  ApplicationPage,
  ApplicationFinance,
  CatalogElement,
  Enrollment,
  EnrollmentPage,
  LatePayment,
  Person,
  PersonPage,
  Prospect,
  PaymentTransaction,
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

function DeleteConfirmation({
  title,
  personName,
  busy,
  error,
  onClose,
  onConfirm,
  onLearnMore,
}: {
  title: string;
  personName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  onLearnMore: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal confirm-modal deletion-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deletion-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon" aria-hidden="true">!</div>
        <h3 id="deletion-title">Supprimer {title} ?</h3>
        <p className="deletion-target">{personName}</p>
        <p>
          Êtes-vous sûr de vouloir déplacer cet élément et les dossiers associés vers la corbeille ?
        </p>
        <label className="deletion-reason-label">Motif de suppression
          <textarea className="deletion-reason-input" minLength={5} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Expliquez la raison de cette suppression (5 caractères minimum)" />
        </label>
        <button className="deletion-info-link" onClick={onLearnMore} disabled={busy}>
          En savoir plus
        </button>
        {error && <p className="form-error deletion-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="secondary-button" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="danger-solid-button" onClick={() => onConfirm(reason.trim())} disabled={busy || reason.trim().length < 5}>
            {busy ? "Archivage..." : "Déplacer vers la corbeille"}
          </button>
        </div>
      </section>
    </div>
  );
}

type NewPersonForm = {
  nom: string;
  prenom: string;
  telephone: string;
  quartier: string;
  dateNaissance: string;
  lieuNaissance: string;
  tuteurNom: string;
  tuteurPrenom: string;
  tuteurTelephone: string;
};

const EMPTY_PERSON: NewPersonForm = {
  nom: "",
  prenom: "",
  telephone: "",
  quartier: "",
  dateNaissance: "",
  lieuNaissance: "",
  tuteurNom: "",
  tuteurPrenom: "",
  tuteurTelephone: "",
};

function NewPersonFields({
  person,
  onChange,
}: {
  person: NewPersonForm;
  onChange: (person: NewPersonForm) => void;
}) {
  const update = (field: keyof NewPersonForm, value: string) =>
    onChange({ ...person, [field]: value });

  return (
    <>
      <div className="form-grid">
        <label>Nom<input required value={person.nom} onChange={(event) => update("nom", event.target.value)} /></label>
        <label>Prénom<input required value={person.prenom} onChange={(event) => update("prenom", event.target.value)} /></label>
      </div>
      <div className="form-grid">
        <label>Téléphone<input value={person.telephone} onChange={(event) => update("telephone", event.target.value)} /></label>
        <label>Quartier<input value={person.quartier} onChange={(event) => update("quartier", event.target.value)} /></label>
      </div>
      <div className="form-grid">
        <label>Date de naissance<input type="date" value={person.dateNaissance} onChange={(event) => update("dateNaissance", event.target.value)} /></label>
        <label>Lieu de naissance<input value={person.lieuNaissance} onChange={(event) => update("lieuNaissance", event.target.value)} /></label>
      </div>
      <p className="eyebrow form-section-label">Tuteur</p>
      <div className="form-grid">
        <label>Nom<input value={person.tuteurNom} onChange={(event) => update("tuteurNom", event.target.value)} /></label>
        <label>Prénom<input value={person.tuteurPrenom} onChange={(event) => update("tuteurPrenom", event.target.value)} /></label>
      </div>
      <label>Téléphone du tuteur<input value={person.tuteurTelephone} onChange={(event) => update("tuteurTelephone", event.target.value)} /></label>
    </>
  );
}

type DossierPreparationState = {
  statuses: Record<string, string>;
  montant: string;
  typePaiement: string;
  elementId: string;
};

const EMPTY_PREPARATION: DossierPreparationState = {
  statuses: {},
  montant: "",
  typePaiement: "FRAIS_DEPOT",
  elementId: "",
};

function DossierPreparation({
  contexte,
  niveauApplicable,
  value,
  onChange,
}: {
  contexte: "BOURSE" | "INSCRIPTION_DIRECTE";
  niveauApplicable: string;
  value: DossierPreparationState;
  onChange: (value: DossierPreparationState) => void;
}) {
  const [catalogue, setCatalogue] = useState<CatalogElement[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  useEffect(() => {
    void apiFetch<CatalogElement[]>(
      `/elements-requis?contexte=${contexte}&niveauApplicable=${niveauApplicable}`,
    ).then((result) => { setCatalogue(result); setCatalogueError(result.length ? "" : "Le référentiel n'a pas été téléchargé sur cet appareil."); }).catch((failure) => {
      setCatalogue([]);
      setCatalogueError(failure instanceof Error ? failure.message : "Référentiel indisponible.");
    });
  }, [contexte, niveauApplicable]);
  const setStatus = (id: string, statut: string) =>
    onChange({ ...value, statuses: { ...value.statuses, [id]: statut } });
  return (
    <section className="preparation-section">
      <div>
        <p className="eyebrow">Préparer le dossier</p>
        <p className="panel-subtitle">Marquez ici les pièces déjà reçues et affectez le premier paiement.</p>
      </div>
      <div className="elements-list">
        {catalogue.map((element) => (
          <div className="element-row" key={element.id}>
            <div><strong>{element.nom}</strong><small>{element.obligatoire ? "Obligatoire" : "Facultatif"}</small></div>
            <select value={value.statuses[element.id] ?? "ATTENDU"} onChange={(event) => setStatus(element.id, event.target.value)}>
              <option value="ATTENDU">Attendu</option><option value="FOURNI">Fourni</option><option value="MANQUANT">Manquant</option><option value="SUBSTITUE" disabled={!element.elementSubstitutId}>Substitué</option>
            </select>
          </div>
        ))}
        {!catalogue.length && <p className="empty-state">{catalogueError || "Aucune pièce configurée pour ce dossier."}</p>}
      </div>
      <div className="form-grid">
        <label>Montant du paiement (facultatif)<input type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={value.montant} onChange={(event) => onChange({ ...value, montant: event.target.value })} /></label>
        <label>Type de paiement<select value={value.typePaiement} onChange={(event) => onChange({ ...value, typePaiement: event.target.value })}><option value="FRAIS_DEPOT">Frais de dépôt</option><option value="FRAIS_INSCRIPTION">Frais d&apos;inscription</option></select></label>
      </div>
      {value.montant && <ModalChoice required label="Affecter à l&apos;obligation financière" placeholder="Sélectionner une obligation" choices={catalogue.filter((element) => element.montantAttendu !== null && element.montantAttendu !== undefined).map((element) => ({ value: element.id, label: element.nom, detail: formatMoney(element.montantAttendu ?? 0) }))} value={value.elementId} onChange={(elementId) => onChange({ ...value, elementId })} />}
    </section>
  );
}

function validateDossierPreparation(preparation: DossierPreparationState) {
  const value = preparation.montant.trim().replace(",", ".");
  if (!value) return "";
  if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    return "Saisissez un montant positif valide, avec au maximum deux décimales.";
  }
  if (!preparation.elementId) return "Sélectionnez l'obligation à laquelle affecter le paiement.";
  return "";
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
    nouvellePersonne: EMPTY_PERSON,
    niveauDemande: "PREMIERE_ANNEE",
    filiereSouhaitee: "",
    filiereSecondaireSouhaitee: "",
    ecoleOrigine: "",
  });
  const [createPerson, setCreatePerson] = useState(false);
  const [preparation, setPreparation] = useState(EMPTY_PREPARATION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const preparationError = validateDossierPreparation(preparation);
      if (preparationError) {
        setError(preparationError);
        return;
      }
      await apiFetch<{ id: string }>("/demandes-bourse", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          personneId: createPerson ? undefined : form.personneId,
          nouvellePersonne: createPerson ? form.nouvellePersonne : undefined,
          preparation,
        }),
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
        <label className="checkbox-label">
          <input type="checkbox" checked={createPerson} onChange={(event) => setCreatePerson(event.target.checked)} />{" "}
          Créer une nouvelle personne
        </label>
        {createPerson ? (
          <NewPersonFields person={form.nouvellePersonne} onChange={(nouvellePersonne) => setForm({ ...form, nouvellePersonne })} />
        ) : (
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
        )}
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
        <DossierPreparation contexte="BOURSE" niveauApplicable={form.niveauDemande === "PREMIERE_ANNEE" ? "PREMIERE_ANNEE" : "DEUXIEME_ANNEE_PLUS"} value={preparation} onChange={setPreparation} />
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
  const acceptedApplications = getAcceptedApplicationsForEnrollment(applications);
  const [form, setForm] = useState({
    personneId: "",
    anneeScolaire: "2026-2027",
    niveau: "",
    filiere: "",
    viaBourse: false,
    demandeBourseId: "",
    nouvellePersonne: EMPTY_PERSON,
  });
  const [createPerson, setCreatePerson] = useState(false);
  const [preparation, setPreparation] = useState(EMPTY_PREPARATION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const preparationError = validateDossierPreparation(preparation);
      if (preparationError) {
        setError(preparationError);
        return;
      }
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
        personneId: createPerson ? undefined : form.personneId,
        nouvellePersonne: createPerson ? form.nouvellePersonne : undefined,
        demandeBourseId: form.viaBourse ? form.demandeBourseId : undefined,
        confirmerDemandeEnCours,
        preparation,
      };
      await apiFetch<{ id: string }>("/inscriptions", {
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
        {!form.viaBourse && (
          <label className="checkbox-label">
            <input type="checkbox" checked={createPerson} onChange={(event) => setCreatePerson(event.target.checked)} />{" "}
            Créer une nouvelle personne
          </label>
        )}
        {createPerson && !form.viaBourse ? (
          <NewPersonFields person={form.nouvellePersonne} onChange={(nouvellePersonne) => setForm({ ...form, nouvellePersonne })} />
        ) : (
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
        )}
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
            onChange={(event) => {
              setForm({ ...form, viaBourse: event.target.checked });
              if (event.target.checked) setCreatePerson(false);
            }}
          />{" "}
          Inscription via une bourse
        </label>
        {form.viaBourse && (
          <ModalChoice
            required
            label="Demande liée"
            placeholder="Sélectionner une demande acceptée"
            value={form.demandeBourseId}
            choices={acceptedApplications.map((application) => ({ value: application.id, label: fullName(application.personne), detail: application.filiereSouhaitee }))}
            loadChoices={async (query, page) => {
              const result = await apiFetch<ApplicationPage>(
                `/demandes-bourse?statut=ACCEPTEE&page=${page}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`,
              );
              return { choices: result.data.map((application) => ({ value: application.id, label: fullName(application.personne), detail: application.filiereSouhaitee })), hasMore: result.meta.page < result.meta.totalPages };
            }}
            onChange={(value) => setForm({ ...form, demandeBourseId: value })}
          />
        )}
        <DossierPreparation contexte="INSCRIPTION_DIRECTE" niveauApplicable={form.niveau.toUpperCase().includes("PREMIERE") || form.niveau.includes("1") ? "PREMIERE_ANNEE" : "DEUXIEME_ANNEE_PLUS"} value={preparation} onChange={setPreparation} />
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

function EditProspectForm({
  prospect,
  onClose,
  onSaved,
}: {
  prospect: Prospect;
  onClose: () => void;
  onSaved: () => void;
}) {
  const person = prospect.personne;
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
    filiereSouhaitee: prospect.filiereSouhaitee ?? "",
    intention: prospect.intention ?? "",
    statutRelance: prospect.statutRelance,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/prospects/${prospect.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          telephone: form.telephone || null,
          quartier: form.quartier || null,
          dateNaissance: form.dateNaissance || null,
          lieuNaissance: form.lieuNaissance || null,
          tuteurNom: form.tuteurNom || null,
          tuteurPrenom: form.tuteurPrenom || null,
          tuteurTelephone: form.tuteurTelephone || null,
          filiereSouhaitee: form.filiereSouhaitee || null,
          intention: form.intention || null,
        }),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Modifier le prospect" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Nom<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></label>
          <label>Prénom<input required value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} /></label>
        </div>
        <div className="form-grid">
          <label>Téléphone<input value={form.telephone} onChange={(event) => setForm({ ...form, telephone: event.target.value })} /></label>
          <label>Quartier<input value={form.quartier} onChange={(event) => setForm({ ...form, quartier: event.target.value })} /></label>
        </div>
        <label>Date de naissance<input type="date" value={form.dateNaissance} onChange={(event) => setForm({ ...form, dateNaissance: event.target.value })} /></label>
        <label>Lieu de naissance<input value={form.lieuNaissance} onChange={(event) => setForm({ ...form, lieuNaissance: event.target.value })} /></label>
        <div className="form-grid">
          <label>Nom du tuteur<input value={form.tuteurNom} onChange={(event) => setForm({ ...form, tuteurNom: event.target.value })} /></label>
          <label>Prénom du tuteur<input value={form.tuteurPrenom} onChange={(event) => setForm({ ...form, tuteurPrenom: event.target.value })} /></label>
        </div>
        <label>Téléphone du tuteur<input value={form.tuteurTelephone} onChange={(event) => setForm({ ...form, tuteurTelephone: event.target.value })} /></label>
        <label>Filière souhaitée<input value={form.filiereSouhaitee} onChange={(event) => setForm({ ...form, filiereSouhaitee: event.target.value })} /></label>
        <label>Intention<input value={form.intention} onChange={(event) => setForm({ ...form, intention: event.target.value })} /></label>
        <ModalChoice label="Statut de suivi" placeholder="Sélectionner un statut" value={form.statutRelance} choices={["A_RELANCER", "RELANCE", "CONVERTI", "ABANDONNE"].map((value) => ({ value, label: statusLabels[value] ?? value }))} onChange={(statutRelance) => setForm({ ...form, statutRelance })} />
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
  onCompletenessChange,
}: {
  dossierType: "demande-bourse" | "inscription";
  dossierId: string;
  onClose: () => void;
  onCompletenessChange: (dossierId: string, complete: boolean, missing: number) => void;
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
      const updated = elements?.map((item) =>
        item.id === element.id ? { ...item, statut } : item,
      ) ?? null;
      setElements(updated);
      const missing = updated?.filter((item) => item.statut !== "FOURNI" && item.statut !== "SUBSTITUE").length ?? 0;
      onCompletenessChange(dossierId, missing === 0, missing);
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

function FinanceModal({ dossierType, dossierId, onClose }: { dossierType: "demande-bourse" | "inscription"; dossierId: string; onClose: () => void }) {
  const [finance, setFinance] = useState<ApplicationFinance | null>(null);
  const [error, setError] = useState("");
  const resource = dossierType === "demande-bourse" ? "demandes-bourse" : "inscriptions";
  useEffect(() => {
    void apiFetch<ApplicationFinance>(`/${resource}/${dossierId}/finance`)
      .then(setFinance)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Situation financière indisponible."));
  }, [dossierId, resource]);
  return <Modal title={`Situation financière de ${dossierType === "demande-bourse" ? "la demande" : "l'inscription"}`} onClose={onClose}>{error && <p className="form-error">{error}</p>}{!finance && !error && <p className="empty-state">Chargement...</p>}{finance && <><div className="payment-summary"><strong>{formatMoney(finance.totalAttendu)}</strong><span>attendu</span><strong>{formatMoney(finance.totalPaye)}</strong><span>payé</span><strong>{formatMoney(String(Number(finance.totalAttendu) - Number(finance.totalPaye)))}</strong><span>reste</span></div><div className="table-wrap"><table><thead><tr><th>Obligation</th><th>Statut</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>{finance.obligations.map((item) => <tr key={item.id}><td className="strong-cell">{item.nom}</td><td>{statusLabels[item.statut] ?? item.statut}</td><td>{formatMoney(item.montantAttendu)}</td><td>{formatMoney(item.montantPaye)}</td><td><span className="status status-refusee">{formatMoney(item.resteAPayer)}</span></td></tr>)}</tbody></table></div><p className="panel-subtitle">Paiements non affectés : {formatMoney(finance.montantPayeNonAffecte)}</p></>}</Modal>;
}

function AssignPaymentModal({ payment, onClose, onSaved }: { payment: UnassignedPayment; onClose: () => void; onSaved: () => void }) {
  const [elements, setElements] = useState<Array<{
    id: string;
    nom: string;
    montantAttendu: string | number | null;
    montantPaye: string | number;
  }> | null>(null);
  const [elementDossierId, setElementDossierId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resource = payment.dossierType === "demande-bourse" ? "demandes-bourse" : "inscriptions";
  useEffect(() => {
    const load = async () => {
      let dossierElements: RequiredElement[] = [];
      try {
        dossierElements = await apiFetch<RequiredElement[]>(`/${resource}/${payment.dossierId}/elements`);
      } catch (failure) {
        if (payment.dossierType !== "demande-bourse") throw failure;
      }
      if (dossierElements.length > 0 || payment.dossierType !== "demande-bourse") {
        setElements(dossierElements.map((element) => ({
          id: element.id,
          nom: element.elementRequis.nom,
          montantAttendu: element.montantAttendu ?? null,
          montantPaye: (element.paiements ?? []).reduce((sum, item) => sum + Number(item.montant), 0),
        })));
        return;
      }
      const finance = await apiFetch<ApplicationFinance>(`/demandes-bourse/${payment.dossierId}/finance`);
      setElements(finance.obligations.map((obligation) => ({
        id: obligation.id,
        nom: obligation.nom,
        montantAttendu: obligation.montantAttendu,
        montantPaye: obligation.montantPaye,
      })));
    };
    void load().catch((failure) => setError(failure instanceof Error ? failure.message : "Obligations indisponibles."));
  }, [payment.dossierId, payment.dossierType, resource]);
  const choices = (elements ?? []).flatMap((element) => {
    if (element.montantAttendu === null || element.montantAttendu === undefined) return [];
    const remaining = Number(element.montantAttendu) - Number(element.montantPaye);
    return remaining > 0 ? [{ value: element.id, label: element.nom, detail: `${formatMoney(remaining)} restant` }] : [];
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

const paymentLabels: Record<string, string> = {
  FRAIS_DEPOT: "Frais de dépôt",
  FRAIS_INSCRIPTION: "Frais d’inscription",
  ECHEANCE_BOURSE: "Échéance de bourse",
};

function paymentDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function receiptFileName(payment: PaymentTransaction) {
  const person = fullName(payment.personne)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `recu-ipaim-${person}-${payment.id.slice(0, 8)}.pdf`;
}

async function loadReceiptLogo() {
  const image = new Image();
  image.src = "/WhatsApp%20Image%202026-07-17%20at%2018.26.50.jpeg";
  await image.decode();
  return image;
}

async function downloadPaymentReceiptPdf(payment: PaymentTransaction) {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadReceiptLogo()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const name = fullName(payment.personne);
  const receiptReference = `IPAIM-${payment.id.slice(0, 8).toUpperCase()}`;

  pdf.setFillColor(20, 40, 92);
  pdf.rect(0, 0, pageWidth, 54, "F");
  pdf.setFillColor(200, 148, 27);
  pdf.rect(0, 53, pageWidth, 2, "F");
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(18, 11, 30, 30, 2, 2, "F");
  pdf.addImage(logo, "JPEG", 19, 12, 28, 28);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("IPAIM UNIVERSITY", 58, 23);
  pdf.setTextColor(222, 232, 247);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("INNOVER · FORMER · TRANSFORMER", 58, 31);
  pdf.setTextColor(228, 177, 59);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("REÇU DE PAIEMENT", 58, 41);

  pdf.setFillColor(242, 245, 250);
  pdf.roundedRect(18, 63, 174, 19, 2, 2, "F");
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("RÉFÉRENCE DU REÇU", 22, 70);
  pdf.text("DATE DU PAIEMENT", 116, 70);
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(receiptReference, 22, 77);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(paymentDate(payment.datePaiement), 116, 77);

  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("REÇU DE LA PART DE", 18, 96);
  pdf.setTextColor(20, 40, 92);
  pdf.setFont("helvetica", "bold");
  const nameLines = pdf.splitTextToSize(name, 174);
  pdf.setFontSize(nameLines.length > 1 ? 17 : 21);
  pdf.text(nameLines, 18, 106);
  let rowY = 112 + nameLines.length * 6;
  if (payment.personne?.telephone) {
    pdf.setTextColor(102, 114, 140);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Téléphone : ${payment.personne.telephone}`, 18, rowY);
    rowY += 8;
  } else {
    rowY += 2;
  }

  const addRow = (label: string, value: string) => {
    const lines = pdf.splitTextToSize(value || "-", 112);
    const height = Math.max(14, 7 + lines.length * 4.5);
    pdf.setDrawColor(226, 232, 242);
    pdf.line(18, rowY + height, 192, rowY + height);
    pdf.setTextColor(102, 114, 140);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(label.toUpperCase(), 20, rowY + height / 2 + 1);
    pdf.setTextColor(36, 51, 76);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text(lines, 76, rowY + 5);
    rowY += height;
  };

  addRow("Dossier concerné", payment.dossierType === "demande-bourse" ? "Demande de bourse" : "Inscription");
  addRow("Filière / dossier", payment.dossier);
  addRow("Référence du dossier", payment.dossierId);
  addRow("Nature du paiement", paymentLabels[payment.typePaiement] ?? payment.typePaiement);
  addRow("Obligation / échéance", payment.obligation ?? payment.echeance ?? "Paiement non affecté");
  addRow("État d’affectation", payment.affecte ? "Affecté au dossier" : "En attente d’affectation");

  const amountY = Math.max(rowY + 5, 211);
  pdf.setFillColor(247, 239, 217);
  pdf.roundedRect(18, amountY, 174, 25, 2, 2, "F");
  pdf.setFillColor(200, 148, 27);
  pdf.rect(18, amountY, 3, 25, "F");
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("MONTANT REÇU", 25, amountY + 15);
  pdf.setTextColor(20, 40, 92);
  pdf.setFontSize(17);
  pdf.text(formatMoney(payment.montant), 185, amountY + 16, { align: "right" });

  const signatureY = amountY + 43;
  pdf.setDrawColor(155, 168, 187);
  pdf.line(18, signatureY + 13, 88, signatureY + 13);
  pdf.line(122, signatureY + 13, 192, signatureY + 13);
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text("Le service de comptabilité", 18, signatureY + 19);
  pdf.text("Cachet de l’établissement", 122, signatureY + 19);
  pdf.setDrawColor(200, 148, 27);
  pdf.line(18, 287, 192, 287);
  pdf.setTextColor(102, 114, 140);
  pdf.setFontSize(7);
  pdf.text(`Référence de transaction : ${payment.id}`, 18, 293);
  pdf.text("IPAIM UNIVERSITY", 192, 293, { align: "right" });
  pdf.save(receiptFileName(payment));
}

function PaymentReceipt({ payment, onClose }: { payment: PaymentTransaction; onClose: () => void }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const createPdf = async () => {
    setPdfBusy(true);
    setPdfError("");
    try {
      await downloadPaymentReceiptPdf(payment);
    } catch (failure) {
      setPdfError(failure instanceof Error ? failure.message : "Impossible de générer le PDF.");
    } finally {
      setPdfBusy(false);
    }
  };
  return createPortal((
    <div className="modal-backdrop receipt-backdrop" onMouseDown={onClose}>
      <section className="modal payment-receipt-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header receipt-modal-header">
          <h3>Aperçu du reçu</h3>
          <button className="modal-close" onClick={onClose} aria-label="Fermer l’aperçu">×</button>
        </div>
        <article className="payment-receipt-print">
          <header className="receipt-brand-header">
            <BrandLogo compact />
            <div>
              <strong>IPAIM UNIVERSITY</strong>
              <span>INNOVER · FORMER · TRANSFORMER</span>
            </div>
            <p>REÇU DE PAIEMENT</p>
          </header>
          <div className="receipt-reference">
            <div><span>Référence du reçu</span><strong>IPAIM-{payment.id.slice(0, 8).toUpperCase()}</strong></div>
            <div><span>Date du paiement</span><strong>{paymentDate(payment.datePaiement)}</strong></div>
          </div>
          <p className="receipt-intro">Reçu de la part de</p>
          <h2 className="receipt-student-name">{fullName(payment.personne)}</h2>
          {payment.personne?.telephone && <p className="receipt-contact">Téléphone : {payment.personne.telephone}</p>}
          <section className="receipt-detail-list">
            <div><span>Dossier concerné</span><strong>{payment.dossierType === "demande-bourse" ? "Demande de bourse" : "Inscription"}</strong></div>
            <div><span>Filière / référence</span><strong>{payment.dossier}</strong></div>
            <div><span>Référence du dossier</span><strong className="receipt-id">{payment.dossierId}</strong></div>
            <div><span>Nature du paiement</span><strong>{paymentLabels[payment.typePaiement] ?? payment.typePaiement}</strong></div>
            <div><span>Obligation / échéance</span><strong>{payment.obligation ?? payment.echeance ?? "Paiement non affecté"}</strong></div>
            <div><span>État d’affectation</span><strong>{payment.affecte ? "Affecté au dossier" : "En attente d’affectation"}</strong></div>
          </section>
          <div className="receipt-amount"><span>Montant reçu</span><strong>{formatMoney(payment.montant)}</strong></div>
          <p className="receipt-thanks">Nous vous remercions pour votre paiement.</p>
          <footer className="receipt-signature">
            <div><span>Le service de comptabilité</span><i /></div>
            <div><span>Cachet de l’établissement</span><i /></div>
          </footer>
          <div className="receipt-footer">IPAIM UNIVERSITY · Référence de transaction : {payment.id}</div>
        </article>
        {pdfError && <p className="form-error receipt-pdf-error" role="alert">{pdfError}</p>}
        <div className="receipt-print-actions">
          <button className="secondary-button" onClick={onClose}>Fermer</button>
          <button className="outline-button" onClick={() => void createPdf()} disabled={pdfBusy}>{pdfBusy ? "Génération..." : "Télécharger le PDF"}</button>
          <button className="primary-button compact" onClick={() => window.print()}>Imprimer le reçu</button>
        </div>
      </section>
    </div>
  ), document.body);
}

function PaymentHistory({ refreshKey }: { refreshKey: number }) {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dossierFilter, setDossierFilter] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransaction | null>(null);
  useEffect(() => {
    let active = true;
    void apiFetch<PaymentTransaction[]>("/paiements")
      .then((result) => { if (active) { setPayments(result); setError(""); } })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Historique indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);
  const total = payments.reduce((sum, payment) => sum + Number(payment.montant), 0);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredPayments = payments.filter((payment) => {
    if (dossierFilter && payment.dossierType !== dossierFilter) return false;
    if (!normalizedSearch) return true;
    const searchable = [
      fullName(payment.personne),
      payment.personne?.telephone,
      payment.dossier,
      payment.dossierId,
      payment.id,
      payment.obligation,
      payment.echeance,
      paymentLabels[payment.typePaiement] ?? payment.typePaiement,
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchable.includes(normalizedSearch);
  });
  return <>
    <section className="panel full-panel payment-history-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Journal des encaissements</p><h3>{filteredPayments.length} transaction(s) affichée(s)</h3></div>
        <div className="payment-history-total">Total encaissé <strong>{formatMoney(total)}</strong></div>
      </div>
      <div className="payment-search-toolbar">
        <label className="payment-search-field">Rechercher une transaction
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, prénom, téléphone, dossier ou référence..." />
        </label>
        <label className="payment-filter-field">Type de dossier
          <select value={dossierFilter} onChange={(event) => setDossierFilter(event.target.value)}>
            <option value="">Tous les dossiers</option>
            <option value="demande-bourse">Demandes de bourse</option>
            <option value="inscription">Inscriptions</option>
          </select>
        </label>
        {(search || dossierFilter) && <button className="text-button payment-clear-filter" onClick={() => { setSearch(""); setDossierFilter(""); }}>Effacer</button>}
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="empty-state">Chargement de l&apos;historique...</p>}
      {!loading && <div className="table-wrap"><table><thead><tr><th>Date</th><th>Payeur</th><th>Dossier</th><th>Obligation / échéance</th><th>Type</th><th>Montant</th><th>État</th><th>Reçu</th></tr></thead><tbody>
        {filteredPayments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.datePaiement)}</td><td className="strong-cell">{fullName(payment.personne)}{payment.personne?.telephone && <small className="payment-phone">{payment.personne.telephone}</small>}</td><td>{payment.dossier}</td><td>{payment.obligation ?? payment.echeance ?? "Non affecté"}</td><td>{paymentLabels[payment.typePaiement] ?? statusLabels[payment.typePaiement] ?? payment.typePaiement}</td><td className="strong-cell">{formatMoney(payment.montant)}</td><td><span className={`status ${payment.affecte ? "status-complete" : "status-en_attente"}`}>{payment.affecte ? "Affecté" : "À affecter"}</span></td><td><button className="row-action" onClick={() => setSelectedReceipt(payment)}>Imprimer</button></td></tr>)}
        {!filteredPayments.length && <tr><td colSpan={8} className="empty-state">{payments.length ? "Aucune transaction ne correspond à cette recherche." : "Aucune transaction enregistrée."}</td></tr>}
      </tbody></table></div>}
    </section>
    {selectedReceipt && <PaymentReceipt payment={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
  </>;
}

function DossierStatus({
  item,
  override,
  onOpen,
  onOpenFinance,
}: {
  item: { dossierComplet?: boolean; elementsManquants?: string[]; obligationsImpayees?: Array<{ nom: string; reste: string }>; paiementEnAttenteSync?: boolean };
  override?: { complete: boolean; missing: number };
  onOpen: () => void;
  onOpenFinance?: () => void;
}) {
  const missingDocuments = override?.missing ?? item.elementsManquants?.length ?? 0;
  const outstanding = item.obligationsImpayees ?? [];
  const remaining = outstanding.reduce((total, obligation) => total + Number(obligation.reste), 0);
  const documentStatus = override?.complete ?? (missingDocuments === 0 && item.dossierComplet);
  return <div className="dossier-status-cell"><button className="row-action incomplete-action" onClick={onOpen}>{documentStatus ? "Pièces complètes" : `Dossier incomplet · ${missingDocuments} pièce(s)`}</button>{remaining > 0 && <button className="row-action debt-action" onClick={onOpenFinance}>{formatMoney(remaining)} à recouvrer</button>}{item.paiementEnAttenteSync && <small className="local-payment-note">Paiement affecté localement · en attente de sync</small>}</div>;
}

export type DossierReference = { type: "demande-bourse" | "inscription"; id: string };

type DossierPayment = {
  id: string;
  montant: string | number;
  datePaiement: string;
  typePaiement: string;
  echeance?: { libelle: string } | null;
};

type DetailedApplication = Application & {
  personne?: Person;
  niveauDemande: string;
  paiements?: DossierPayment[];
  inscriptions?: Array<{ id: string; filiere: string; anneeScolaire: string }>;
};

type DetailedEnrollment = Enrollment & {
  personne?: Person;
  demandeBourse?: { id: string; filiereSouhaitee: string; typeBourseId?: string | null } | null;
  paiements?: DossierPayment[];
};

function DetailField({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{value ?? "-"}</dd></div>;
}

const fullDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: value.includes("T") ? "short" : undefined }).format(new Date(value))
  : "-";

export function DossierDetailsPage({
  reference,
  returnView,
  scholarshipTypes,
  onBack,
  onRefresh,
  onShowDeletionInfo,
}: {
  reference: DossierReference;
  returnView: "Demandes de bourse" | "Inscriptions";
  scholarshipTypes: ScholarshipType[];
  onBack: () => void;
  onRefresh: () => void;
  onShowDeletionInfo: (returnView: "Demandes de bourse" | "Inscriptions") => void;
}) {
  const isApplication = reference.type === "demande-bourse";
  const resource = isApplication ? "demandes-bourse" : "inscriptions";
  const [record, setRecord] = useState<DetailedApplication | DetailedEnrollment | null>(null);
  const [elements, setElements] = useState<RequiredElement[]>([]);
  const [finance, setFinance] = useState<ApplicationFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [action, setAction] = useState<"elements" | "finance" | "status" | "interview" | "delete" | "person" | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiFetch<DetailedApplication | DetailedEnrollment>(`/${resource}/${reference.id}`),
      apiFetch<RequiredElement[]>(`/${resource}/${reference.id}/elements`),
      apiFetch<ApplicationFinance>(`/${resource}/${reference.id}/finance`),
    ])
      .then(([dossier, dossierElements, dossierFinance]) => {
        if (!active) return;
        setRecord(dossier);
        setElements(dossierElements);
        setFinance(dossierFinance);
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : "Impossible de charger le dossier.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reference.id, resource, reloadKey]);

  const dossier = record as DetailedApplication | DetailedEnrollment | null;
  const person = dossier?.personne;
  const payments = dossier?.paiements ?? [];
  const missingElements = elements.filter((element) => element.statut !== "FOURNI" && element.statut !== "SUBSTITUE");
  const unpaidAmount = finance?.obligations.reduce((total, item) => total + Number(item.resteAPayer), 0) ?? 0;
  const refreshDetails = () => {
    setLoading(true);
    setError("");
    setReloadKey((current) => current + 1);
  };
  const saveAction = () => { setAction(null); refreshDetails(); onRefresh(); };
  const deleteDossier = async (reason: string) => {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await apiFetch(`/${resource}/${reference.id}`, {
        method: "DELETE",
        body: JSON.stringify({ motif: reason }),
      });
      onRefresh();
      onBack();
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : "La suppression a échoué.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="content-scroll">
      <div className="page-intro dossier-page-intro">
        <div>
          <p className="eyebrow">{isApplication ? "Demande de bourse" : "Inscription"}</p>
          <h2>{person ? fullName(person) : "Fiche du dossier"}</h2>
          <p>{isApplication ? (dossier as DetailedApplication | null)?.filiereSouhaitee : (dossier as DetailedEnrollment | null)?.filiere}</p>
        </div>
        <button className="secondary-button" onClick={onBack}>Retour à la liste</button>
      </div>
      {loading && <p className="empty-state">Chargement des informations du dossier...</p>}
      {error && <p className="form-error dossier-load-error" role="alert">{error}</p>}
      {dossier && (
        <section className="panel full-panel dossier-detail-panel">
          <div className="dossier-detail-heading">
            <div>
              <span className={`status status-${dossier.statut.toLowerCase()}`}>{statusLabels[dossier.statut] ?? dossier.statut}</span>
              <p className="panel-subtitle">Créé le {fullDate(isApplication ? (dossier as DetailedApplication).dateDepot : (dossier as DetailedEnrollment).dateInscription)}</p>
            </div>
            <div className="dossier-detail-actions">
              {isApplication ? <>
                <button className="outline-button small" onClick={() => setAction("status")}>Décider</button>
                <button className="outline-button small" onClick={() => setAction("interview")}>Entretien</button>
              </> : <button className="outline-button small" onClick={() => setAction("status")}>Modifier</button>}
              <button className="outline-button small" onClick={() => setAction("elements")}>Pièces</button>
              <button className="outline-button small" onClick={() => setAction("finance")}>Finance</button>
              <button className="row-action danger-row-action" onClick={() => { setDeleteError(""); setAction("delete"); }}>Supprimer</button>
            </div>
          </div>

          <section className="dossier-detail-section">
            <div className="dossier-section-heading"><h3>Personne</h3><button className="row-action" onClick={() => setAction("person")}>Modifier les informations</button></div>
            <dl className="dossier-detail-fields">
              <DetailField label="Nom complet" value={fullName(person)} />
              <DetailField label="Téléphone" value={person?.telephone} />
              <DetailField label="Quartier" value={person?.quartier} />
              <DetailField label="Date de naissance" value={fullDate(person?.dateNaissance)} />
              <DetailField label="Lieu de naissance" value={person?.lieuNaissance} />
              <DetailField label="Tuteur" value={[person?.tuteurPrenom, person?.tuteurNom].filter(Boolean).join(" ")} />
              <DetailField label="Téléphone du tuteur" value={person?.tuteurTelephone} />
            </dl>
          </section>

          <section className="dossier-detail-section">
            <h3>Informations du dossier</h3>
            {isApplication ? <dl className="dossier-detail-fields">
              <DetailField label="Niveau demandé" value={(dossier as DetailedApplication).niveauDemande} />
              <DetailField label="Filière souhaitée" value={(dossier as DetailedApplication).filiereSouhaitee} />
              <DetailField label="Deuxième choix" value={(dossier as DetailedApplication).filiereSecondaireSouhaitee} />
              <DetailField label="École d'origine" value={(dossier as DetailedApplication).ecoleOrigine} />
              <DetailField label="Décision le" value={fullDate((dossier as DetailedApplication).dateDecision)} />
              <DetailField label="Entretien prévu" value={fullDate((dossier as DetailedApplication).dateEntretien)} />
              <DetailField label="Équipe d'entretien" value={(dossier as DetailedApplication).equipeEntretien} />
              <DetailField label="Type de bourse" value={(dossier as DetailedApplication).typeBourse?.nom} />
              <DetailField label="Frais d'inscription" value={(dossier as DetailedApplication).typeBourse ? formatMoney((dossier as DetailedApplication).typeBourse!.fraisInscription) : undefined} />
              <DetailField label="Taux de réduction" value={(dossier as DetailedApplication).typeBourse?.tauxReduction != null ? `${(dossier as DetailedApplication).typeBourse!.tauxReduction}%` : undefined} />
            </dl> : <dl className="dossier-detail-fields">
              <DetailField label="Filière" value={(dossier as DetailedEnrollment).filiere} />
              <DetailField label="Niveau" value={(dossier as DetailedEnrollment).niveau} />
              <DetailField label="Année scolaire" value={(dossier as DetailedEnrollment).anneeScolaire} />
              <DetailField label="Date d'inscription" value={fullDate((dossier as DetailedEnrollment).dateInscription)} />
              <DetailField label="Inscription via bourse" value={(dossier as DetailedEnrollment).viaBourse ? "Oui" : "Non"} />
              <DetailField label="Filière de la demande liée" value={(dossier as DetailedEnrollment).demandeBourse?.filiereSouhaitee} />
              <DetailField label="Type de bourse lié" value={scholarshipTypes.find((type) => type.id === (dossier as DetailedEnrollment).demandeBourse?.typeBourseId)?.nom} />
            </dl>}
            {isApplication && (dossier as DetailedApplication).inscriptions?.length ? <div className="dossier-linked-records"><strong>Inscriptions liées</strong>{(dossier as DetailedApplication).inscriptions?.map((item) => <span key={item.id}>{item.filiere} · {item.anneeScolaire}</span>)}</div> : null}
          </section>

          <section className="dossier-detail-section">
            <div className="dossier-section-heading"><div><h3>Pièces du dossier</h3><p>{missingElements.length ? `${missingElements.length} pièce(s) à compléter` : "Toutes les pièces sont complètes"}</p></div><button className="row-action" onClick={() => setAction("elements")}>Gérer les pièces</button></div>
            <div className="table-wrap"><table><thead><tr><th>Élément requis</th><th>Statut</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>{elements.map((element) => {
              const obligation = finance?.obligations.find((item) => item.id === element.id);
              return <tr key={element.id}><td className="strong-cell">{element.elementRequis.nom}<small className="dossier-item-note">{element.elementRequis.obligatoire ? "Obligatoire" : "Facultatif"}</small></td><td>{statusLabels[element.statut] ?? element.statut}</td><td>{formatMoney(element.montantAttendu ?? 0)}</td><td>{formatMoney(obligation?.montantPaye ?? 0)}</td><td>{formatMoney(obligation?.resteAPayer ?? 0)}</td></tr>;
            })}{!elements.length && <tr><td colSpan={5} className="empty-state">Aucun élément requis.</td></tr>}</tbody></table></div>
          </section>

          <section className="dossier-detail-section">
            <div className="dossier-section-heading"><div><h3>Situation financière</h3><p className={unpaidAmount > 0 ? "dossier-debt-alert" : undefined}>{unpaidAmount > 0 ? `${formatMoney(unpaidAmount)} restent à recouvrer` : "Aucun solde restant sur les obligations"}</p></div><button className="row-action" onClick={() => setAction("finance")}>Voir le détail financier</button></div>
            <div className="dossier-finance-summary"><div><span>Total attendu</span><strong>{formatMoney(finance?.totalAttendu ?? 0)}</strong></div><div><span>Total payé</span><strong>{formatMoney(finance?.totalPaye ?? 0)}</strong></div><div><span>Paiements non affectés</span><strong>{formatMoney(finance?.montantPayeNonAffecte ?? 0)}</strong></div></div>
            <h4 className="dossier-subheading">Paiements enregistrés</h4>
            {payments.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Échéance</th><th>Montant</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{fullDate(payment.datePaiement)}</td><td>{statusLabels[payment.typePaiement] ?? payment.typePaiement}</td><td>{payment.echeance?.libelle ?? "-"}</td><td>{formatMoney(payment.montant)}</td></tr>)}</tbody></table></div> : <p className="panel-subtitle">Aucun paiement enregistré pour ce dossier.</p>}
          </section>

          <section className="dossier-detail-section dossier-next-actions"><h3>À faire</h3>
            {missingElements.length > 0 && <button className="row-action" onClick={() => setAction("elements")}>Compléter les pièces manquantes ({missingElements.length})</button>}
            {unpaidAmount > 0 && <button className="row-action debt-action" onClick={() => setAction("finance")}>Suivre les paiements en attente ({formatMoney(unpaidAmount)})</button>}
            {isApplication && !(dossier as DetailedApplication).dateEntretien && !["ACCEPTEE", "REFUSEE"].includes(dossier.statut) && <button className="row-action" onClick={() => setAction("interview")}>Planifier un entretien</button>}
            {isApplication && !["ACCEPTEE", "REFUSEE"].includes(dossier.statut) && <button className="row-action" onClick={() => setAction("status")}>Prendre une décision</button>}
            {!missingElements.length && unpaidAmount <= 0 && (!isApplication || Boolean((dossier as DetailedApplication).dateEntretien) || ["ACCEPTEE", "REFUSEE"].includes(dossier.statut)) && (isApplication ? ["ACCEPTEE", "REFUSEE"].includes(dossier.statut) : dossier.statut === "COMPLETE") && <p className="panel-subtitle">Aucune action en attente n&apos;a été détectée.</p>}
          </section>
        </section>
      )}

      {action === "elements" && <ElementsModal dossierType={reference.type} dossierId={reference.id} onClose={() => setAction(null)} onCompletenessChange={() => refreshDetails()} />}
      {action === "finance" && <FinanceModal dossierType={reference.type} dossierId={reference.id} onClose={() => setAction(null)} />}
      {action === "person" && person && <PersonForm person={person} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "status" && isApplication && dossier && <EditStatus title="Décision de la demande" endpoint={`/demandes-bourse/${reference.id}/decision`} field="statut" initial={dossier.statut} options={["EN_DELIBERATION", "ACCEPTEE", "REFUSEE"]} scholarshipTypes={scholarshipTypes} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "status" && !isApplication && dossier && <EditStatus title="Modifier l'inscription" endpoint={`/inscriptions/${reference.id}`} field="statut" initial={dossier.statut} options={["EN_COURS", "COMPLETE", "ABANDONNEE"]} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "interview" && isApplication && dossier && <InterviewForm application={dossier as DetailedApplication} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "delete" && dossier && <DeleteConfirmation title={isApplication ? "la demande de bourse" : "l'inscription"} personName={fullName(person)} busy={deleteBusy} error={deleteError} onClose={() => setAction(null)} onConfirm={(reason) => void deleteDossier(reason)} onLearnMore={() => { setAction(null); onShowDeletionInfo(returnView); }} />}
    </div>
  );
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
  applicationStatus,
  applicationsLoading,
  onApplicationStatusChange,
  onApplicationSearch,
  onApplicationPage,
  enrollmentMeta,
  enrollmentStatus,
  enrollmentsLoading,
  onEnrollmentStatusChange,
  enrollmentTypeBourseId,
  onEnrollmentTypeBourseChange,
  onEnrollmentSearch,
  onEnrollmentPage,
  prospectMeta,
  onProspectSearch,
  onProspectPage,
  onRefresh,
  onShowDeletionInfo,
  onOpenDossier,
}: {
  view: Exclude<ViewName, "Vue d'ensemble">;
  applications: Application[];
  enrollments: Enrollment[];
  prospects: Prospect[];
  people: Person[];
  latePayments: LatePayment[];
  scholarshipTypes: ScholarshipType[];
  applicationMeta: { page: number; total: number; totalPages: number };
  applicationStatus: string;
  applicationsLoading: boolean;
  onApplicationStatusChange: (value: string) => void;
  onApplicationSearch: (value: string) => void;
  onApplicationPage: (page: number) => void;
  enrollmentMeta: { page: number; total: number; totalPages: number };
  enrollmentStatus: string;
  enrollmentsLoading: boolean;
  onEnrollmentStatusChange: (value: string) => void;
  enrollmentTypeBourseId: string;
  onEnrollmentTypeBourseChange: (typeBourseId: string) => void;
  onEnrollmentSearch: (value: string) => void;
  onEnrollmentPage: (page: number) => void;
  prospectMeta: { page: number; total: number; totalPages: number };
  onProspectSearch: (value: string) => void;
  onProspectPage: (page: number) => void;
  onRefresh: () => void;
  onShowDeletionInfo: (returnView: "Demandes de bourse" | "Inscriptions") => void;
  onOpenDossier: (reference: DossierReference) => void;
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
    | "deleteApplication"
    | "deleteEnrollment"
    | "person"
    | null
  >(null);
  const [selectedId, setSelectedId] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [completeness, setCompleteness] = useState<Record<string, { complete: boolean; missing: number }>>({});
  const selectedStatus = view === "Demandes de bourse"
    ? applicationStatus
    : view === "Inscriptions"
      ? enrollmentStatus
      : filter;
  const filteredApplications = applications;
  const filteredEnrollments = enrollments;
  const visibleApplications = applicationsLoading ? [] : filteredApplications;
  const visibleEnrollments = enrollmentsLoading ? [] : filteredEnrollments;
  const filteredProspects =
    filter === "ALL"
      ? prospects
      : prospects.filter((item) => item.statutRelance === filter);
  const refreshAfterPayment = () => {
    setCompleteness({});
    onRefresh();
    setPaymentsRefreshKey((current) => current + 1);
  };
  const selectedApplication = applications.find(
    (item) => item.id === selectedId,
  );
  const selectedEnrollment = enrollments.find((item) => item.id === selectedId);
  const selectedProspect = prospects.find((item) => item.id === selectedId);
  const open = (kind: typeof modal, id = "") => {
    setDeleteError("");
    setSelectedId(id);
    setModal(kind);
  };
  const confirmDelete = async (reason: string) => {
    const resource = modal === "deleteApplication" ? "demandes-bourse" : "inscriptions";
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await apiFetch(`/${resource}/${selectedId}`, {
        method: "DELETE",
        body: JSON.stringify({ motif: reason }),
      });
      setModal(null);
      setCompleteness({});
      onRefresh();
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : "La suppression a échoué.");
    } finally {
      setDeleteBusy(false);
    }
  };
  const updateCompleteness = (id: string, complete: boolean, missing: number) =>
    setCompleteness((current) => {
      const dossier = applications.find((item) => item.id === id) ?? enrollments.find((item) => item.id === id);
      const hasOutstandingPayment = (dossier?.obligationsImpayees?.length ?? 0) > 0;
      return { ...current, [id]: { complete: complete && !hasOutstandingPayment, missing } };
    });
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
            {view === "Inscriptions" && (
              <select
                aria-label="Filtrer par type de bourse"
                value={enrollmentTypeBourseId}
                onChange={(event) => onEnrollmentTypeBourseChange(event.target.value)}
              >
                <option value="">Tous les types de bourse</option>
                {scholarshipTypes.map((type) => <option key={type.id} value={type.id}>{type.nom}</option>)}
              </select>
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
                value={selectedStatus}
                onChange={(event) => {
                  if (view === "Demandes de bourse") onApplicationStatusChange(event.target.value);
                  else if (view === "Inscriptions") onEnrollmentStatusChange(event.target.value);
                  else setFilter(event.target.value);
                }}
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
                  <th>Dossier</th>
                  <th>Dépôt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applicationsLoading && <tr><td colSpan={6} className="empty-state">Chargement des demandes...</td></tr>}
                {visibleApplications.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar">
                          {fullName(item.personne).slice(0, 1)}
                        </span>
                        <button className="dossier-open-button" onClick={() => onOpenDossier({ type: "demande-bourse", id: item.id })}>
                          {fullName(item.personne)}
                        </button>
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
                    <td>
                      <DossierStatus item={item} override={completeness[item.id]} onOpen={() => open("elements", item.id)} onOpenFinance={() => open("finance", item.id)} />
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
                      <button className="row-action" onClick={() => open("finance", item.id)}>
                        Finance
                      </button>
                      <button
                        className="row-action"
                        onClick={() => open("interview", item.id)}
                      >
                        Entretien
                      </button>
                      <button className="row-action" onClick={() => open("person", item.id)}>
                        Étudiant
                      </button>
                      <button
                        className="row-action danger-row-action"
                        onClick={() => open("deleteApplication", item.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {!applicationsLoading && !filteredApplications.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
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
                  <th>Dossier</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrollmentsLoading && <tr><td colSpan={7} className="empty-state">Chargement des inscriptions...</td></tr>}
                {visibleEnrollments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar">
                          {fullName(item.personne).slice(0, 1)}
                        </span>
                        <button className="dossier-open-button" onClick={() => onOpenDossier({ type: "inscription", id: item.id })}>
                          {fullName(item.personne)}
                        </button>
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
                    <td>
                      <DossierStatus item={item} override={completeness[item.id]} onOpen={() => open("elements", item.id)} onOpenFinance={() => open("finance", item.id)} />
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
                      <button className="row-action" onClick={() => open("person", item.id)}>
                        Étudiant
                      </button>
                      <button
                        className="row-action danger-row-action"
                        onClick={() => open("deleteEnrollment", item.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {!enrollmentsLoading && !filteredEnrollments.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">
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
            <PaymentHistory refreshKey={paymentsRefreshKey} />
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
        {view === "Demandes de bourse" && !applicationsLoading && applicationMeta.totalPages > 1 && (
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
        {view === "Inscriptions" && !enrollmentsLoading && enrollmentMeta.totalPages > 1 && (
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
          onCompletenessChange={updateCompleteness}
        />
      )}
      {(modal === "deleteApplication" || modal === "deleteEnrollment") && selectedId && (
        <DeleteConfirmation
          title={modal === "deleteApplication" ? "la demande de bourse" : "l'inscription"}
          personName={fullName(
            modal === "deleteApplication" ? selectedApplication?.personne : selectedEnrollment?.personne,
          )}
          busy={deleteBusy}
          error={deleteError}
          onClose={() => setModal(null)}
          onConfirm={(reason) => void confirmDelete(reason)}
          onLearnMore={() => {
            setModal(null);
            onShowDeletionInfo(view === "Inscriptions" ? "Inscriptions" : "Demandes de bourse");
          }}
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
          dossierType="demande-bourse"
          dossierId={selectedApplication.id}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "finance" && selectedEnrollment && (
        <FinanceModal
          dossierType="inscription"
          dossierId={selectedEnrollment.id}
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
        <EditProspectForm prospect={selectedProspect} onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === "person" && selectedId && (selectedApplication?.personne || selectedEnrollment?.personne) && (
        <PersonForm
          person={selectedApplication?.personne ?? selectedEnrollment?.personne}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
