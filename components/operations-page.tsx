"use client";

import { currentUser, generatedByLine } from "@/lib/session";
import { hasAccess } from "@/lib/access";
import { ActionIcon } from "@/components/action-icon";
import { PaymentModeSelect } from "@/components/payment-mode";
import { askConfirm, askReason, toast } from "@/components/feedback";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, Link2, ScrollText, Wallet } from "lucide-react";
import { HubBack, HubCard, HubCards, useHubSection } from "@/components/ui-kit";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { navigateTo, pathForPerson, queryParam } from "@/lib/routes";
import { EditApplicationModal, EditEnrollmentModal } from "@/components/dossier-edit";
import { confirmNewPerson } from "@/lib/duplicates";
import { logPrint } from "@/lib/print-log";
import { DocumentsPanel } from "@/components/hr-page";
import { PersonPhotoCard, PhotoField, attachPhotoAfterSave } from "@/components/student-photo";
import { RefundReceipt } from "@/components/refund-receipt";
import { SurplusPanel, surplusOf } from "@/components/surplus-panel";
import { ModalChoice } from "@/components/modal-choice";
import { DateOrderControl } from "@/components/date-order-control";
import { PersonForm } from "@/components/additional-pages";
import { BrandLogo } from "@/components/brand-logo";
import { getAcceptedApplicationsForEnrollment } from "@/lib/enrollment-eligibility";
import {
  Application,
  ApplicationPage,
  ApplicationFinance,
  CatalogElement,
    DateOrder,
  Enrollment,
  EnrollmentPage,
  LatePayment,
  Person,
  PersonPage,
  Prospect,
  ProspectRelance,
  PaymentTransaction,
  RequiredElement,
  ScholarshipType,
  UnassignedPayment,
  ViewName,
  formatDate,
  formatMoney,
  paymentModeLabel,
  pdfSafe,
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
    <div className="modal-backdrop">
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
  modePaiement: string;
  elementId: string;
};

const EMPTY_PREPARATION: DossierPreparationState = {
  statuses: {},
  montant: "",
  typePaiement: "FRAIS_DEPOT",
  modePaiement: "ESPECES",
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
            <div>
              <strong>{element.nom}</strong>
              <small>{element.obligatoire ? "Obligatoire" : "Facultatif"}</small>
              {element.montantAttendu !== null && element.montantAttendu !== undefined && (
                <small>Montant attendu : {formatMoney(element.montantAttendu)}</small>
              )}
            </div>
            <select value={value.statuses[element.id] ?? "ATTENDU"} onChange={(event) => setStatus(element.id, event.target.value)}>
              <option value="ATTENDU">Attendu</option><option value="FOURNI">Fourni</option><option value="MANQUANT">Manquant</option><option value="SUBSTITUE" disabled={!element.elementSubstitutId}>Substitué</option>
            </select>
          </div>
        ))}
        {!catalogue.length && <p className="empty-state">{catalogueError || "Aucune pièce configurée pour ce dossier."}</p>}
      </div>
      <div className="form-grid">
        <label>Montant du paiement (facultatif)<input type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={value.montant} onChange={(event) => onChange({ ...value, montant: event.target.value })} /></label>
        <label>
          Type de paiement
          <input
            readOnly
            value={contexte === "BOURSE" ? "Frais de dépôt" : "Frais d'inscription"}
          />
        </label>
      </div>
      {value.montant && <PaymentModeSelect value={value.modePaiement} onChange={(modePaiement) => onChange({ ...value, modePaiement })} />}
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
  const [photo, setPhoto] = useState<File | null>(null);
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
      if (createPerson && !(await confirmNewPerson(form.nouvellePersonne))) return;
      const saved = await apiFetch<{ id: string; personneId?: string }>("/demandes-bourse", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          personneId: createPerson ? undefined : form.personneId,
          nouvellePersonne: createPerson ? form.nouvellePersonne : undefined,
          preparation,
        }),
      });
      await attachPhotoAfterSave(saved.personneId, photo);
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
        <PhotoField value={photo} onChange={setPhoto} current={createPerson ? null : people.find((person) => person.id === form.personneId)} />
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
        <DossierPreparation contexte="BOURSE" niveauApplicable={form.niveauDemande === "PREMIERE_ANNEE" ? "PREMIERE_ANNEE" : "DEUXIEME_ANNEE"} value={preparation} onChange={setPreparation} />
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function CreateEnrollment({
  applications,
  onClose,
  onSaved,
}: {
  applications: Application[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const acceptedApplications = getAcceptedApplicationsForEnrollment(applications);
  const [form, setForm] = useState({
    anneeScolaire: "2026-2027",
    niveau: "",
    filiere: "",
    viaBourse: false,
    demandeBourseId: "",
    nouvellePersonne: EMPTY_PERSON,
  });
  const [selectedBourse, setSelectedBourse] = useState<Application | null>(null);
  const [bourseLoading, setBourseLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preparation, setPreparation] = useState({
    ...EMPTY_PREPARATION,
    typePaiement: "FRAIS_INSCRIPTION",
  });
  // Niveaux et filières du référentiel : le choix se fait dans la liste, sans rien retaper.
  const [levels, setLevels] = useState<EnrollmentLevel[]>(DEFAULT_LEVELS);
  const [programs, setPrograms] = useState<Array<{ id: string; code: string; nom: string; actif: boolean }>>([]);
  useEffect(() => {
    void apiFetch<EnrollmentLevel[]>("/academique/niveaux").then((list) => { if (list.length) setLevels(list); }).catch(() => undefined);
    void apiFetch<Array<{ id: string; code: string; nom: string; actif: boolean }>>("/academique/filieres").then(setPrograms).catch(() => undefined);
  }, []);
  const openPrograms = programs.filter((program) => program.actif);
  const program = programs.find((item) => item.nom === form.filiere);
  const level = levels.find((item) => item.code === form.niveau);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectBourse = async (demandeBourseId: string) => {
    setSelectedBourse(null);
    setForm((current) => ({ ...current, demandeBourseId }));
    if (!demandeBourseId) return;
    setBourseLoading(true);
    try {
      const application = applications.find((item) => item.id === demandeBourseId)
        ?? await apiFetch<Application>(`/demandes-bourse/${demandeBourseId}`);
      setSelectedBourse(application);
      setForm((current) => ({
        ...current,
        niveau: application.niveauDemande === "DEUXIEME_ANNEE" ? "L2" : "L1",
        filiere: application.filiereSouhaitee,
      }));
      setPreparation((current) => ({ ...current, elementId: "" }));
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Impossible de charger le dossier de bourse.");
    } finally {
      setBourseLoading(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.niveau) {
      setError("Sélectionnez le niveau.");
      return;
    }
    if (form.viaBourse && !form.demandeBourseId) {
      setError("Sélectionnez le dossier de bourse lié.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const preparationError = validateDossierPreparation(preparation);
      if (preparationError) {
        setError(preparationError);
        return;
      }
      const linkedApplication = selectedBourse ?? applications.find(
        (application) => application.id === form.demandeBourseId,
      );
      const confirmerDemandeEnCours =
        form.viaBourse &&
        linkedApplication !== undefined &&
        linkedApplication.statut !== "ACCEPTEE";
      if (
        confirmerDemandeEnCours &&
        !(await askConfirm({
          title: "Demande de bourse non décidée",
          message: "Cette demande de bourse est encore en attente de décision. Voulez-vous quand même créer l'inscription ?",
          confirmLabel: "Créer l'inscription",
        }))
      ) {
        setBusy(false);
        return;
      }
      const body = {
        ...form,
        filiereId: program?.id,
        personneId: form.viaBourse ? selectedBourse?.personne?.id : undefined,
        nouvellePersonne: form.viaBourse ? undefined : form.nouvellePersonne,
        demandeBourseId: form.viaBourse ? form.demandeBourseId : undefined,
        confirmerDemandeEnCours,
        preparation,
      };
      if (body.nouvellePersonne && !(await confirmNewPerson(body.nouvellePersonne))) return;
      const saved = await apiFetch<{ id: string; personneId?: string }>("/inscriptions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await attachPhotoAfterSave(saved.personneId, photo);
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
          label="Type d'inscription"
          placeholder="Sélectionner un mode"
          value={form.viaBourse ? "BOURSE" : "DIRECTE"}
          choices={[
            { value: "DIRECTE", label: "Inscription directe · nouvelle personne" },
            { value: "BOURSE", label: "Inscription via une bourse" },
          ]}
          onChange={(mode) => {
            const viaBourse = mode === "BOURSE";
            setForm((current) => ({
              ...current,
              viaBourse,
              demandeBourseId: "",
              ...(viaBourse ? { niveau: "", filiere: "" } : {}),
            }));
            setSelectedBourse(null);
          }}
        />
        {form.viaBourse && (
          <>
            <ModalChoice
              required
              label="Dossier de bourse lié"
              placeholder="Sélectionner un dossier accepté"
              value={form.demandeBourseId}
              choices={acceptedApplications.map((application) => ({ value: application.id, label: fullName(application.personne), detail: `${application.filiereSouhaitee} · ${application.niveauDemande === "DEUXIEME_ANNEE" ? "L2" : "L1"}` }))}
              loadChoices={async (query, page) => {
                const result = await apiFetch<ApplicationPage>(
                  `/demandes-bourse?statut=ACCEPTEE&page=${page}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`,
                );
                return { choices: result.data.map((application) => ({ value: application.id, label: fullName(application.personne), detail: `${application.filiereSouhaitee} · ${application.niveauDemande === "DEUXIEME_ANNEE" ? "L2" : "L1"}` })), hasMore: result.meta.page < result.meta.totalPages };
              }}
              onChange={(value) => void selectBourse(value)}
            />
            {selectedBourse?.personne && <p className="panel-subtitle">Personne liée : {fullName(selectedBourse.personne)}</p>}
            {bourseLoading && <p className="panel-subtitle">Chargement du dossier...</p>}
          </>
        )}
        {!form.viaBourse && (
          <NewPersonFields
            person={form.nouvellePersonne}
            onChange={(nouvellePersonne) => setForm({ ...form, nouvellePersonne })}
          />
        )}
        <PhotoField value={photo} onChange={setPhoto} current={form.viaBourse ? selectedBourse?.personne : null} />
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
        <ModalChoice
          required
          label="Niveau"
          placeholder="Sélectionner un niveau"
          value={form.niveau}
          choices={levels.filter((item) => item.actif !== false).map((item) => ({ value: item.code, label: `${item.code} · ${item.libelle}`, detail: item.cycle }))}
          onChange={(niveau) => {
            setForm({ ...form, niveau });
            setPreparation((current) => ({ ...current, elementId: "" }));
          }}
        />
        {openPrograms.length ? (
          <ModalChoice
            required
            label="Filière"
            placeholder="Sélectionner une filière"
            value={form.filiere}
            choices={[
              // Filière reprise d'un dossier de bourse et absente du référentiel : elle reste proposée.
              ...(form.filiere && !openPrograms.some((item) => item.nom === form.filiere) ? [{ value: form.filiere, label: form.filiere, detail: "Hors référentiel" }] : []),
              ...openPrograms.map((item) => ({ value: item.nom, label: item.nom, detail: item.code })),
            ]}
            onChange={(filiere) => setForm({ ...form, filiere })}
          />
        ) : (
          <label>
            Filière
            <input
              required
              list="filieres-referentiel"
              value={form.filiere}
              onChange={(event) =>
                setForm({ ...form, filiere: event.target.value })
              }
            />
          </label>
        )}
        {form.niveau ? (
          <DossierPreparation
            contexte="INSCRIPTION_DIRECTE"
            niveauApplicable={!level || level.rang <= 1 ? "PREMIERE_ANNEE" : level.rang === 2 ? "DEUXIEME_ANNEE" : "DEUXIEME_ANNEE_PLUS"}
            value={preparation}
            onChange={setPreparation}
          />
        ) : (
          <p className="panel-subtitle">Sélectionnez un niveau pour afficher les frais et pièces applicables.</p>
        )}
        <ProgramSuggestions />
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy || bourseLoading} onCancel={onClose} />
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
    sourceConnaissance: "",
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
        <label>
          Comment a-t-il entendu parler de l&apos;IPAIM ?
          <input list="prospect-sources" maxLength={160} value={form.sourceConnaissance} onChange={(event) => setForm({ ...form, sourceConnaissance: event.target.value })} placeholder="Choisir ou saisir" />
        </label>
        <ProspectSources />
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// Filières du référentiel académique, proposées à la saisie pour que l'inscription se rattache ensuite à sa classe.
type EnrollmentLevel = { code: string; libelle: string; cycle: string; rang: number; actif?: boolean };
// Utilisés tant que le référentiel n'a pas répondu (hors ligne, par exemple).
const DEFAULT_LEVELS: EnrollmentLevel[] = [
  { code: "L1", libelle: "Première année", cycle: "Licence", rang: 1 },
  { code: "L2", libelle: "Deuxième année", cycle: "Licence", rang: 2 },
];

function ProgramSuggestions() {
  const [programs, setPrograms] = useState<Array<{ id: string; nom: string; actif: boolean }>>([]);
  useEffect(() => {
    void apiFetch<Array<{ id: string; nom: string; actif: boolean }>>("/academique/filieres").then(setPrograms).catch(() => undefined);
  }, []);
  return (
    <datalist id="filieres-referentiel">
      {programs.filter((program) => program.actif).map((program) => <option key={program.id} value={program.nom} />)}
    </datalist>
  );
}

// Réponses proposées à « Comment a-t-il entendu parler de l'IPAIM ? » ; la saisie reste libre.
function ProspectSources() {
  return (
    <datalist id="prospect-sources">
      {["Bouche-à-oreille", "Étudiant ou ancien étudiant", "Parent ou proche", "Facebook", "WhatsApp", "TikTok", "Instagram", "Site internet", "Affiche ou banderole", "Radio ou télévision", "Visite dans son établissement", "Salon ou événement", "Passage devant le campus"].map((source) => (
        <option key={source} value={source} />
      ))}
    </datalist>
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
    modePaiement: "ESPECES",
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
          modePaiement: form.modePaiement,
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
          onChange={(value) => setForm({
            ...form,
            dossierType: value,
            dossierId: "",
            // Les frais de dépôt ne concernent que les demandes de bourse.
            typePaiement: value === "inscriptionId" && form.typePaiement === "FRAIS_DEPOT" ? "FRAIS_INSCRIPTION" : form.typePaiement,
          })}
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
          choices={[
            ...(form.dossierType === "demandeBourseId" ? [{ value: "FRAIS_DEPOT", label: "Frais de dépôt" }] : []),
            { value: "FRAIS_INSCRIPTION", label: "Frais d'inscription" },
            { value: "ECHEANCE_BOURSE", label: "Échéance bourse" },
          ]}
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
        <PaymentModeSelect value={form.modePaiement} onChange={(modePaiement) => setForm({ ...form, modePaiement })} />
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
    sourceConnaissance: prospect.sourceConnaissance ?? "",
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
          sourceConnaissance: form.sourceConnaissance || null,
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
        <label>Intention actuelle<input value={form.intention} onChange={(event) => setForm({ ...form, intention: event.target.value })} /></label>
        <label>
          Comment a-t-il entendu parler de l&apos;IPAIM ?
          <input list="prospect-sources" maxLength={160} value={form.sourceConnaissance} onChange={(event) => setForm({ ...form, sourceConnaissance: event.target.value })} placeholder="Choisir ou saisir" />
        </label>
        <ProspectSources />
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function ProspectRelanceForm({
  prospect,
  onClose,
  onSaved,
}: {
  prospect: Prospect;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [commentaire, setCommentaire] = useState("");
  const [intention, setIntention] = useState(prospect.intention ?? "");
  const [statutRelance, setStatutRelance] = useState(
    prospect.statutRelance === "A_RELANCER" ? "RELANCE" : prospect.statutRelance,
  );
  const [dateProchaineRelance, setDateProchaineRelance] = useState("");
  const [relances, setRelances] = useState<ProspectRelance[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<ProspectRelance[]>(`/prospects/${prospect.id}/relances`)
      .then((items) => {
        if (active) setRelances(items);
      })
      .catch((failure) => {
        if (active) setHistoryError(failure instanceof Error ? failure.message : "Historique indisponible.");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [prospect.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/prospects/${prospect.id}/relances`, {
        method: "POST",
        body: JSON.stringify({
          commentaire,
          intention: intention || null,
          statutRelance,
          dateProchaineRelance: dateProchaineRelance || null,
        }),
      });
      onSaved();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Enregistrement de la relance impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Relancer ${fullName(prospect.personne)}`} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <label>Compte rendu de l’échange<textarea required minLength={2} maxLength={3000} rows={4} value={commentaire} onChange={(event) => setCommentaire(event.target.value)} placeholder="Ce que la personne a dit, ses questions ou ses réserves" /></label>
        <label>Intention actuelle<input value={intention} onChange={(event) => setIntention(event.target.value)} placeholder="Ex. intéressé pour la prochaine rentrée" /></label>
        <ModalChoice label="Statut après l’échange" placeholder="Sélectionner un statut" value={statutRelance} choices={["A_RELANCER", "RELANCE", "CONVERTI", "ABANDONNE"].map((value) => ({ value, label: statusLabels[value] ?? value }))} onChange={setStatutRelance} />
        <label>Prochaine date de rappel<input type="date" value={dateProchaineRelance} onChange={(event) => setDateProchaineRelance(event.target.value)} /></label>
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
      <section className="prospect-followup-history">
        <h4>Historique des relances</h4>
        {historyLoading && <p className="panel-subtitle">Chargement...</p>}
        {historyError && <p className="form-error">{historyError}</p>}
        {!historyLoading && !historyError && relances.length === 0 && <p className="panel-subtitle">Aucune relance enregistrée.</p>}
        {relances.map((relance) => (
          <article className="prospect-followup-item" key={relance.id}>
            <div className="prospect-followup-meta">
              <strong>{new Date(relance.date).toLocaleString("fr-FR")}</strong>
              <span>{statusLabels[relance.statutRelance] ?? relance.statutRelance}</span>
            </div>
            <p>{relance.commentaire}</p>
            {relance.intention && <small>Intention : {relance.intention}</small>}
            <small>{relance._offline ? "En attente de synchronisation" : `Par ${relance.utilisateurNom}`}{relance.dateProchaineRelance ? ` · Rappel le ${formatDate(relance.dateProchaineRelance)}` : ""}</small>
          </article>
        ))}
      </section>
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
        {
          method: "PATCH",
          body: JSON.stringify(
            statut === "SUBSTITUE"
              ? { statut, elementSubstitutUtiliseId: element.elementRequis.elementSubstitutId }
              : { statut },
          ),
        },
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
              choices={[
                { value: "ATTENDU", label: "Attendu" },
                { value: "FOURNI", label: "Fourni" },
                { value: "MANQUANT", label: "Manquant" },
                // « Substitué » n'existe que si le référentiel prévoit un substitut.
                ...(element.elementRequis.elementSubstitutId || element.statut === "SUBSTITUE"
                  ? [{ value: "SUBSTITUE", label: "Substitué" }]
                  : []),
              ]}
              onChange={(value) => void update(element, value)}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}

function FinanceModal({ dossierType, dossierId, onClose, onChanged }: { dossierType: "demande-bourse" | "inscription"; dossierId: string; onClose: () => void; onChanged?: () => void }) {
  const [finance, setFinance] = useState<ApplicationFinance | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [collectId, setCollectId] = useState("");
  const [montant, setMontant] = useState("");
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [busy, setBusy] = useState(false);
  const [collectError, setCollectError] = useState("");
  const resource = dossierType === "demande-bourse" ? "demandes-bourse" : "inscriptions";
  useEffect(() => {
    void apiFetch<ApplicationFinance>(`/${resource}/${dossierId}/finance`)
      .then(setFinance)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "Situation financière indisponible."));
  }, [dossierId, resource, reloadKey]);
  const globalRemaining = finance ? Math.max(0, Number(finance.totalAttendu) - Number(finance.totalPaye)) : 0;
  const totalRemaining = finance ? finance.obligations.reduce((total, item) => total + Number(item.resteAPayer), 0) : 0;
  const reload = () => { setReloadKey((current) => current + 1); onChanged?.(); };
  // Les paiements non affectés comptent déjà dans le total payé : on n'encaisse jamais plus que le reste global.
  const collectable = (item: ApplicationFinance["obligations"][number]) => Math.min(Number(item.resteAPayer), globalRemaining);
  const target = finance?.obligations.find((item) => item.id === collectId);
  const maximum = target ? collectable(target) : 0;
  const pendingAssignment = Boolean(finance) && Number(finance?.montantPayeNonAffecte) > 0 && Boolean(finance?.obligations.some((item) => Number(item.resteAPayer) > 0));
  const startCollect = (item: ApplicationFinance["obligations"][number]) => {
    setCollectId(item.id);
    setMontant(String(collectable(item)));
    setCollectError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    const value = Number(montant.replace(",", "."));
    if (!(value > 0) || value > maximum) {
      setCollectError(`Le montant doit être supérieur à 0 et ne pas dépasser ${formatMoney(maximum)}.`);
      return;
    }
    setBusy(true);
    setCollectError("");
    try {
      // Le paiement est affecté d'office à l'obligation choisie : rien ne reste « non affecté ».
      await apiFetch("/paiements", {
        method: "POST",
        body: JSON.stringify({
          [dossierType === "demande-bourse" ? "demandeBourseId" : "inscriptionId"]: dossierId,
          elementDossierId: target.id,
          montant: String(value),
          modePaiement,
          // Les frais de dépôt ne concernent que les demandes de bourse.
          typePaiement: dossierType === "demande-bourse" && /d[ée]p[oô]t/i.test(target.nom) ? "FRAIS_DEPOT" : "FRAIS_INSCRIPTION",
        }),
      });
      setCollectId("");
      setReloadKey((current) => current + 1);
      onChanged?.();
    } catch (failure) {
      setCollectError(failure instanceof Error ? failure.message : "Impossible d'enregistrer le paiement.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Situation financière de ${dossierType === "demande-bourse" ? "la demande" : "l'inscription"}`} onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      {!finance && !error && <p className="empty-state">Chargement...</p>}
      {finance && (
        <>
          <div className="payment-summary"><strong>{formatMoney(finance.totalAttendu)}</strong><span>attendu</span><strong>{formatMoney(finance.totalPaye)}</strong><span>payé</span><strong>{formatMoney(totalRemaining)}</strong><span>reste</span></div>
          <SurplusPanel obligations={finance.obligations} onChanged={reload} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Obligation</th><th>Statut</th><th>Attendu</th><th>Payé</th><th>Reste</th><th /></tr></thead>
              <tbody>
                {finance.obligations.map((item) => (
                  <tr key={item.id}>
                    <td className="strong-cell">{item.nom}</td>
                    <td>{statusLabels[item.statut] ?? item.statut}</td>
                    <td>{formatMoney(item.montantAttendu)}</td>
                    <td>{formatMoney(item.montantPaye)}</td>
                    <td>{surplusOf(item) > 0 ? <span className="status status-en_attente" title="Trop-perçu : payé en plus du montant dû">+{formatMoney(surplusOf(item))} en trop</span> : <span className="status status-refusee">{formatMoney(item.resteAPayer)}</span>}</td>
                    <td>{collectable(item) > 0 && <button type="button" className="row-action" disabled={busy} onClick={() => startCollect(item)}>Encaisser</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-subtitle">Paiements non affectés : {formatMoney(finance.montantPayeNonAffecte)}</p>
          {pendingAssignment && <p className="panel-subtitle">Des paiements déjà encaissés ne sont pas encore affectés : affectez-les depuis la page Paiements avant d&apos;encaisser le reste.</p>}
          {target && (
            <form className="entity-form" onSubmit={submit}>
              <label>
                Montant à encaisser · {target.nom}
                <input required autoFocus type="number" min="0.01" max={maximum} step="0.01" value={montant} onChange={(event) => setMontant(event.target.value)} />
              </label>
              <p className="panel-subtitle">Maximum : {formatMoney(maximum)} (reste à payer)</p>
              <PaymentModeSelect value={modePaiement} onChange={setModePaiement} />
              {collectError && <p className="form-error">{collectError}</p>}
              <FormActions busy={busy} onCancel={() => setCollectId("")} />
            </form>
          )}
        </>
      )}
    </Modal>
  );
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
  return <><section className="panel full-panel"><div className="panel-heading"><div><p className="eyebrow">Affectation</p><h3>{payments.length} paiement(s) à affecter</h3></div><button className="outline-button small" onClick={() => void load()}>Actualiser</button></div>{error && <p className="form-error">{error}</p>}{loading && <p className="empty-state">Chargement...</p>}{!loading && <div className="table-wrap"><table><thead><tr><th>Date</th><th>Personne</th><th>Dossier</th><th>Type</th><th>Montant</th><th /></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.datePaiement)}</td><td className="strong-cell">{fullName(payment.personne)}</td><td>{payment.dossierType === "demande-bourse" ? "Demande de bourse" : "Inscription"}</td><td>{statusLabels[payment.typePaiement] ?? payment.typePaiement}</td><td>{formatMoney(payment.montant)}</td><td><button className="row-action icon-action" onClick={() => setSelected(payment)} aria-label="Affecter le paiement à une obligation"><ActionIcon name="assign" /></button></td></tr>)}{!payments.length && <tr><td colSpan={6} className="empty-state">Tous les paiements sont affectés.</td></tr>}</tbody></table></div>}</section>{selected && <AssignPaymentModal payment={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load(); onRefresh(); }} />}</>;
}

const paymentLabels: Record<string, string> = {
  FRAIS_DEPOT: "Frais de dépôt",
  FRAIS_INSCRIPTION: "Frais d’inscription",
  ECHEANCE_BOURSE: "Échéance de bourse",
  REMBOURSEMENT: "Remboursement",
  REPORT: "Report de trop-perçu",
  ANNULATION: "Annulation",
};

// Seul un encaissement s'annule ; les régularisations restent telles quelles.
const cancellablePaymentTypes = ["FRAIS_DEPOT", "FRAIS_INSCRIPTION", "ECHEANCE_BOURSE"];

// Numéro de reçu suivi ; une saisie hors ligne garde sa référence provisoire jusqu'à l'envoi.
const receiptNumber = (payment: PaymentTransaction) => payment.numeroRecu ?? `IPAIM-${payment.id.slice(0, 8).toUpperCase()}`;

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

type DossierSituation = {
  obligations: Array<{ nom: string; attendu: number; paye: number; reste: number }>;
  pieces: Array<{ nom: string; obligatoire: boolean }>;
  totalReste: number;
};

// État du dossier vis-à-vis du référentiel : obligations financières (montant
// attendu, payé, reste) et pièces ou fournitures qui n'ont pas encore été fournies.
function dossierSituation(elements: RequiredElement[]): DossierSituation {
  const obligations = elements
    .filter((element) => element.montantAttendu !== null && element.montantAttendu !== undefined)
    .map((element) => {
      const attendu = Number(element.montantAttendu);
      const paye = (element.paiements ?? []).reduce((total, item) => total + Number(item.montant), 0);
      return { nom: element.elementRequis.nom, attendu, paye, reste: Math.max(0, Math.round((attendu - paye) * 100) / 100) };
    });
  const pieces = elements
    .filter((element) => (element.montantAttendu === null || element.montantAttendu === undefined) && element.statut !== "FOURNI" && element.statut !== "SUBSTITUE")
    .map((element) => ({ nom: element.elementRequis.nom, obligatoire: element.elementRequis.obligatoire !== false }));
  return { obligations, pieces, totalReste: obligations.reduce((total, item) => total + item.reste, 0) };
}

function situationHeadline(situation: DossierSituation) {
  const settled = situation.totalReste <= 0;
  const missing = situation.pieces.length;
  if (settled && !missing) return "Dossier soldé et complet : rien ne reste à payer ni à fournir.";
  return [
    settled ? "Obligations financières soldées" : `Reste à payer : ${formatMoney(situation.totalReste)}`,
    missing ? `${missing} pièce${missing > 1 ? "s" : ""} à fournir` : "pièces complètes",
  ].join(" · ");
}

async function downloadPaymentReceiptPdf(payment: PaymentTransaction, situation: DossierSituation | null) {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadReceiptLogo()]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const name = fullName(payment.personne);
  const receiptReference = receiptNumber(payment);

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
  pdf.text(payment._offline ? "REÇU DE PAIEMENT PROVISOIRE" : "REÇU DE PAIEMENT", 58, 41);
  if (payment._offline) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text("Enregistré hors ligne, en attente de confirmation par le serveur", 58, 47);
  }

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

  // Détails sur deux colonnes : la place gagnée sert à la situation du dossier.
  const addPair = (cells: Array<[string, string]>) => {
    pdf.setDrawColor(226, 232, 242);
    pdf.line(18, rowY + 13, 192, rowY + 13);
    cells.forEach(([label, value], index) => {
      const x = 20 + index * 88;
      pdf.setTextColor(102, 114, 140);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(label.toUpperCase(), x, rowY + 4.5);
      pdf.setTextColor(36, 51, 76);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.text(pdf.splitTextToSize(value || "-", 82)[0], x, rowY + 10);
    });
    rowY += 13;
  };

  addPair([
    ["Dossier concerné", payment.dossierType === "demande-bourse" ? "Demande de bourse" : "Inscription"],
    ["Filière / dossier", payment.dossier],
  ]);
  addPair([
    ["Référence du dossier", payment.dossierId],
    ["Nature du paiement", paymentLabels[payment.typePaiement] ?? payment.typePaiement],
  ]);
  addPair([
    ["Obligation / échéance", payment.obligation ?? payment.echeance ?? "Paiement non affecté"],
    ["État d’affectation", payment.affecte ? "Affecté au dossier" : "En attente d’affectation"],
  ]);
  addPair([
    ["Mode de paiement", paymentModeLabel(payment.modePaiement)],
    ["Encaissé par", payment.saisiParNom ?? "-"],
  ]);

  const amountY = rowY + 6;
  pdf.setFillColor(247, 239, 217);
  pdf.roundedRect(18, amountY, 174, 19, 2, 2, "F");
  pdf.setFillColor(200, 148, 27);
  pdf.rect(18, amountY, 3, 19, "F");
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("MONTANT REÇU", 25, amountY + 11.5);
  pdf.setTextColor(20, 40, 92);
  pdf.setFontSize(17);
  pdf.text(pdfSafe(formatMoney(payment.montant)), 185, amountY + 12.5, { align: "right" });

  // Situation du dossier : ce que l'étudiant doit encore payer ou fournir.
  let y = amountY + 28;
  const generatedBy = generatedByLine();
  const footer = () => {
    pdf.setDrawColor(200, 148, 27);
    pdf.line(18, 285.5, 192, 285.5);
    pdf.setTextColor(102, 114, 140);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(`Référence de transaction : ${payment.id}${payment._offline ? " · saisi hors ligne, en attente de synchronisation" : ""}`, 18, 290);
    pdf.text("IPAIM UNIVERSITY", 192, 290, { align: "right" });
    // Traçabilité du document : qui l'a édité, quel jour et à quelle heure.
    pdf.text(pdfSafe(generatedBy), 105, 294, { align: "center" });
  };
  const ensureSpace = (height: number, limit = 280) => {
    if (y + height <= limit) return;
    footer();
    pdf.addPage();
    y = 22;
  };
  if (situation) {
    const settled = situation.totalReste <= 0;
    const complete = situation.pieces.length === 0;
    pdf.setTextColor(20, 40, 92);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("SITUATION DU DOSSIER À LA DATE DE CE REÇU", 18, y);
    y += 4;
    pdf.setFillColor(...((settled && complete ? [230, 243, 236] : [251, 243, 223]) as [number, number, number]));
    pdf.roundedRect(18, y, 174, 11, 2, 2, "F");
    pdf.setTextColor(...((settled && complete ? [25, 116, 88] : [143, 103, 28]) as [number, number, number]));
    pdf.setFontSize(9);
    pdf.text(pdfSafe(situationHeadline(situation)), 22, y + 7);
    y += 17;

    if (situation.obligations.length) {
      ensureSpace(12 + situation.obligations.length * 6.5);
      pdf.setTextColor(102, 114, 140);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text("OBLIGATION FINANCIÈRE", 20, y);
      pdf.text("ATTENDU", 128, y, { align: "right" });
      pdf.text("PAYÉ", 158, y, { align: "right" });
      pdf.text("RESTE À PAYER", 190, y, { align: "right" });
      pdf.setDrawColor(226, 232, 242);
      pdf.line(18, y + 2, 192, y + 2);
      y += 7;
      for (const obligation of situation.obligations) {
        pdf.setTextColor(36, 51, 76);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.text(pdf.splitTextToSize(obligation.nom, 80)[0], 20, y);
        pdf.text(pdfSafe(formatMoney(obligation.attendu)), 128, y, { align: "right" });
        pdf.text(pdfSafe(formatMoney(obligation.paye)), 158, y, { align: "right" });
        pdf.setFont("helvetica", "bold");
        if (obligation.reste > 0) pdf.setTextColor(170, 60, 50);
        else pdf.setTextColor(25, 116, 88);
        pdf.text(obligation.reste > 0 ? pdfSafe(formatMoney(obligation.reste)) : "Soldé", 190, y, { align: "right" });
        y += 6.5;
      }
      y += 3;
    }

    ensureSpace(12 + Math.max(1, Math.ceil(situation.pieces.length / 2)) * 5.5);
    pdf.setTextColor(102, 114, 140);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("PIÈCES ET FOURNITURES RESTANT À FOURNIR", 20, y);
    pdf.setDrawColor(226, 232, 242);
    pdf.line(18, y + 2, 192, y + 2);
    y += 7;
    pdf.setFontSize(8.5);
    if (!situation.pieces.length) {
      pdf.setTextColor(25, 116, 88);
      pdf.text("Toutes les pièces demandées ont été fournies.", 20, y);
      y += 5.5;
    }
    // Liste sur deux colonnes pour tenir sur une seule page.
    for (let index = 0; index < situation.pieces.length; index += 2) {
      ensureSpace(6);
      pdf.setTextColor(36, 51, 76);
      for (const [offset, piece] of situation.pieces.slice(index, index + 2).entries()) {
        const label = `•  ${piece.nom}${piece.obligatoire ? "" : " (facultatif)"}`;
        pdf.text(pdf.splitTextToSize(label, 82)[0], 20 + offset * 88, y);
      }
      y += 5.5;
    }
    y += 4;
  }

  // Visa en bas de page : signature de la comptabilité et emplacement du cachet.
  ensureSpace(19, 284);
  const signatureY = Math.max(y, 264);
  pdf.setDrawColor(155, 168, 187);
  pdf.line(18, signatureY + 13, 88, signatureY + 13);
  pdf.setLineDashPattern([1.6, 1.4], 0);
  pdf.roundedRect(122, signatureY, 70, 18, 2, 2, "S");
  pdf.setLineDashPattern([], 0);
  pdf.setTextColor(102, 114, 140);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text("Le service de comptabilité", 18, signatureY + 17.5);
  pdf.text("Cachet de l’établissement", 157, signatureY + 4.5, { align: "center" });
  footer();
  pdf.save(receiptFileName(payment));
}

function PaymentReceipt({ payment, onClose }: { payment: PaymentTransaction; onClose: () => void }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  // null = en cours de chargement, "indisponible" = lecture impossible (hors ligne, droits).
  const [situation, setSituation] = useState<DossierSituation | "indisponible" | null>(null);
  useEffect(() => {
    let active = true;
    const resource = payment.dossierType === "demande-bourse" ? "demandes-bourse" : "inscriptions";
    void apiFetch<RequiredElement[]>(`/${resource}/${payment.dossierId}/elements`)
      .then((elements) => { if (active) setSituation(dossierSituation(elements)); })
      .catch(() => { if (active) setSituation("indisponible"); });
    return () => { active = false; };
  }, [payment.dossierId, payment.dossierType]);
  const knownSituation = situation && situation !== "indisponible" ? situation : null;
  const [generatedBy] = useState(() => generatedByLine());
  const recordPrint = (mode: "IMPRESSION" | "PDF") =>
    logPrint({ typeDocument: "RECU_PAIEMENT", mode, dossierType: payment.dossierType, dossierId: payment.dossierId, libelle: `${fullName(payment.personne)} · ${formatMoney(payment.montant)}`, reference: payment.id.slice(0, 8).toUpperCase() });
  const createPdf = async () => {
    setPdfBusy(true);
    setPdfError("");
    try {
      await downloadPaymentReceiptPdf(payment, knownSituation);
      recordPrint("PDF");
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
          {payment._offline && <p className="receipt-provisional">Reçu provisoire · paiement enregistré hors ligne, en attente de confirmation par le serveur</p>}
          <div className="receipt-reference">
            <div><span>Reçu n°</span><strong>{receiptNumber(payment)}</strong></div>
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
            <div><span>Mode de paiement</span><strong>{paymentModeLabel(payment.modePaiement)}</strong></div>
            <div><span>Encaissé par</span><strong>{payment.saisiParNom ?? "-"}</strong></div>
          </section>
          <div className="receipt-amount"><span>Montant reçu</span><strong>{formatMoney(payment.montant)}</strong></div>
          <section className="receipt-situation" aria-label="Situation du dossier">
            <h3>Situation du dossier à la date de ce reçu</h3>
            {situation === null && <p className="receipt-situation-note">Chargement de la situation du dossier…</p>}
            {situation === "indisponible" && <p className="receipt-situation-note">La situation du dossier n’a pas pu être chargée ; elle ne figure pas sur ce reçu.</p>}
            {knownSituation && (
              <>
                <p className={`receipt-situation-headline ${knownSituation.totalReste <= 0 && !knownSituation.pieces.length ? "settled" : ""}`}>{situationHeadline(knownSituation)}</p>
                {knownSituation.obligations.length > 0 && (
                  <table className="receipt-obligations">
                    <thead><tr><th>Obligation financière</th><th>Attendu</th><th>Payé</th><th>Reste à payer</th></tr></thead>
                    <tbody>
                      {knownSituation.obligations.map((obligation) => (
                        <tr key={obligation.nom}>
                          <td>{obligation.nom}</td>
                          <td>{formatMoney(obligation.attendu)}</td>
                          <td>{formatMoney(obligation.paye)}</td>
                          <td className={obligation.reste > 0 ? "due" : "paid"}>{obligation.reste > 0 ? formatMoney(obligation.reste) : "Soldé"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <h4>Pièces et fournitures restant à fournir</h4>
                {knownSituation.pieces.length ? (
                  <ul className="receipt-missing">{knownSituation.pieces.map((piece) => <li key={piece.nom}>{piece.nom}{!piece.obligatoire && " (facultatif)"}</li>)}</ul>
                ) : (
                  <p className="receipt-situation-note paid">Toutes les pièces demandées ont été fournies.</p>
                )}
              </>
            )}
          </section>
          <p className="receipt-thanks">Nous vous remercions pour votre paiement.</p>
          <footer className="receipt-signature">
            <div><span>Le service de comptabilité</span><i /></div>
            <div><span>Cachet de l’établissement</span><i /></div>
          </footer>
          <div className="receipt-footer">IPAIM UNIVERSITY · Référence de transaction : {payment.id}{payment._offline && " · saisi hors ligne, en attente de synchronisation"}<br />{generatedBy}</div>
        </article>
        {pdfError && <p className="form-error receipt-pdf-error" role="alert">{pdfError}</p>}
        <div className="receipt-print-actions">
          <button className="secondary-button" onClick={onClose}>Fermer</button>
          <button className="outline-button" onClick={() => void createPdf()} disabled={pdfBusy || situation === null}>{pdfBusy ? "Génération..." : "Télécharger le PDF"}</button>
          <button className="primary-button compact" disabled={situation === null} onClick={() => { recordPrint("IMPRESSION"); window.print(); }}>Imprimer le reçu</button>
        </div>
      </section>
    </div>
  ), document.body);
}

function PaymentHistory({ refreshKey, dateOrder, onDateOrderChange, onChanged }: { refreshKey: number; dateOrder: DateOrder; onDateOrderChange: (value: DateOrder) => void; onChanged: () => void }) {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => queryParam("q") ?? "");
  const [dossierFilter, setDossierFilter] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransaction | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [canCancel] = useState(() => hasAccess(currentUser(), "payment-cancellation", "edit"));
  // Un paiement saisi par erreur ne s'efface pas : une ligne inverse, motivée, le neutralise.
  const cancel = async (payment: PaymentTransaction) => {
    const motif = await askReason({
      title: `Annuler le paiement de ${formatMoney(payment.montant)}`,
      message: `${fullName(payment.personne)} · ${payment.obligation ?? payment.echeance ?? "non affecté"}. Une ligne inverse sera ajoutée au journal : rien ne s'efface. Si de l'argent a réellement été reçu, rendez-le au payeur.`,
      confirmLabel: "Annuler le paiement",
      danger: true,
      reason: { label: "Motif de l'annulation", minLength: 5, placeholder: "Ex. : saisi sur le mauvais étudiant" },
    });
    if (!motif) return;
    try {
      await apiFetch(`/paiements/${payment.id}/annulation`, { method: "POST", silent: true, body: JSON.stringify({ motif }) });
      toast("Paiement annulé. Ressaisissez le bon paiement si nécessaire.");
      setReloadKey((current) => current + 1);
      onChanged();
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : "L'annulation n'a pas pu être enregistrée.", "error");
    }
  };
  useEffect(() => {
    let active = true;
    void apiFetch<PaymentTransaction[]>(`/paiements?ordreDate=${dateOrder}`)
      .then((result) => { if (active) { setPayments(result); setError(""); } })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Historique indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey, dateOrder, reloadKey]);
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
      payment.motif,
      payment.numeroRecu,
      payment.saisiParNom,
      paymentModeLabel(payment.modePaiement),
      paymentLabels[payment.typePaiement] ?? payment.typePaiement,
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchable.includes(normalizedSearch);
  });
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagePayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <>
    <section className="panel full-panel payment-history-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Journal des encaissements</p><h3>{filteredPayments.length} transaction(s) affichée(s)</h3></div>
        <div className="payment-history-total">Total encaissé (remboursements et annulations déduits) <strong>{formatMoney(total)}</strong></div>
      </div>
        <div className="payment-search-toolbar">
        <label className="payment-search-field">Rechercher une transaction
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nom, prénom, téléphone, dossier ou référence..." />
        </label>
        <label className="payment-filter-field">Type de dossier
          <select value={dossierFilter} onChange={(event) => { setDossierFilter(event.target.value); setPage(1); }}>
            <option value="">Tous les dossiers</option>
            <option value="demande-bourse">Demandes de bourse</option>
            <option value="inscription">Inscriptions</option>
          </select>
        </label>
        <DateOrderControl value={dateOrder} onChange={onDateOrderChange} />
        {(search || dossierFilter) && <button className="text-button payment-clear-filter" onClick={() => { setSearch(""); setDossierFilter(""); }}>Effacer</button>}
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="empty-state">Chargement de l&apos;historique...</p>}
      {!loading && <div className="table-wrap"><table><thead><tr><th>Date</th><th>Payeur</th><th>Dossier</th><th>Obligation / échéance</th><th>Type</th><th>Montant</th><th>Mode</th><th>Encaissé par</th><th>État</th><th>Actions</th></tr></thead><tbody>
        {pagePayments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.datePaiement)}</td><td className="strong-cell">{fullName(payment.personne)}{payment.personne?.telephone && <small className="payment-phone">{payment.personne.telephone}</small>}</td><td>{payment.dossier}</td><td>{payment.obligation ?? payment.echeance ?? "Non affecté"}</td><td>{paymentLabels[payment.typePaiement] ?? statusLabels[payment.typePaiement] ?? payment.typePaiement}</td><td className="strong-cell">{formatMoney(payment.montant)}</td><td>{payment.typePaiement === "REPORT" ? "—" : paymentModeLabel(payment.modePaiement)}</td><td>{payment.saisiParNom ?? "—"}</td><td>{payment.typePaiement === "REMBOURSEMENT" ? <span className="status status-refusee">Remboursé</span> : payment.typePaiement === "REPORT" ? <span className="status status-neutre">Report</span> : payment.typePaiement === "ANNULATION" ? <span className="status status-neutre" title={payment.motif ?? undefined}>Annulation</span> : payment.annule ? <span className="status status-refusee">Annulé</span> : <span className={`status ${payment.affecte ? "status-complete" : "status-en_attente"}`}>{payment.affecte ? "Affecté" : "À affecter"}</span>}{payment._offline && <small className="local-payment-note">En attente de synchronisation</small>}</td><td>{payment.typePaiement !== "REPORT" && payment.typePaiement !== "ANNULATION" && !payment.annule && <button className="row-action icon-action" onClick={() => setSelectedReceipt(payment)} aria-label={payment.typePaiement === "REMBOURSEMENT" ? "Imprimer le reçu de remboursement" : "Imprimer le reçu"}><ActionIcon name="print" /></button>}{canCancel && !payment.annule && !payment._offline && cancellablePaymentTypes.includes(payment.typePaiement) && <button className="row-action icon-action" onClick={() => void cancel(payment)} aria-label="Annuler ce paiement saisi par erreur"><ActionIcon name="cancel" /></button>}</td></tr>)}
        {!filteredPayments.length && <tr><td colSpan={10} className="empty-state">{payments.length ? "Aucune transaction ne correspond à cette recherche." : "Aucune transaction enregistrée."}</td></tr>}
      </tbody></table></div>}
      {!loading && pageCount > 1 && (
        <div className="pagination-bar">
          <span>Page {currentPage} sur {pageCount} · {filteredPayments.length} transaction(s)</span>
          <div className="pagination-actions">
            <button className="outline-button small" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Précédente</button>
            <button className="outline-button small" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Suivante</button>
          </div>
        </div>
      )}
    </section>
    {selectedReceipt && (selectedReceipt.typePaiement === "REMBOURSEMENT"
      ? <RefundReceipt refund={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      : <PaymentReceipt payment={selectedReceipt} onClose={() => setSelectedReceipt(null)} />)}
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
  motif?: string | null;
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
  const [action, setAction] = useState<"elements" | "finance" | "status" | "dossier" | "interview" | "delete" | "person" | null>(null);
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
  const surplusAmount = finance?.obligations.reduce((total, item) => total + surplusOf(item), 0) ?? 0;
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
                <button className="outline-button small" onClick={() => setAction("dossier")}>Modifier le dossier</button>
                <button className="outline-button small" onClick={() => setAction("status")}>Décider</button>
                <button className="outline-button small" onClick={() => setAction("interview")}>Entretien</button>
              </> : <button className="outline-button small" onClick={() => setAction("dossier")}>Modifier le dossier</button>}
              <button className="outline-button small" onClick={() => setAction("elements")}>Pièces</button>
              <button className="outline-button small" onClick={() => setAction("finance")}>Finance</button>
              <button className="row-action icon-action danger-row-action" onClick={() => { setDeleteError(""); setAction("delete"); }} aria-label="Supprimer"><ActionIcon name="delete" /></button>
            </div>
          </div>

          <section className="dossier-detail-section">
            <div className="dossier-section-heading"><h3>Personne</h3><span className="action-group">{person && <button className="row-action" onClick={() => navigateTo(pathForPerson(person.id))}>Fiche complète</button>}<button className="row-action" onClick={() => setAction("person")}>Modifier les informations</button></span></div>
            <div className="dossier-person-layout">
              {person && <PersonPhotoCard person={person} onChanged={() => { refreshDetails(); onRefresh(); }} />}
              <dl className="dossier-detail-fields">
                <DetailField label="Nom complet" value={fullName(person)} />
                <DetailField label="Matricule" value={person?.matricule} />
                <DetailField label="Téléphone" value={person?.telephone} />
                <DetailField label="Quartier" value={person?.quartier} />
                <DetailField label="Date de naissance" value={fullDate(person?.dateNaissance)} />
                <DetailField label="Lieu de naissance" value={person?.lieuNaissance} />
                <DetailField label="Tuteur" value={[person?.tuteurPrenom, person?.tuteurNom].filter(Boolean).join(" ")} />
                <DetailField label="Téléphone du tuteur" value={person?.tuteurTelephone} />
              </dl>
            </div>
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
            {payments.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Échéance / précision</th><th>Montant</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{fullDate(payment.datePaiement)}</td><td>{statusLabels[payment.typePaiement] ?? payment.typePaiement}</td><td>{payment.echeance?.libelle ?? payment.motif ?? "-"}</td><td>{formatMoney(payment.montant)}</td></tr>)}</tbody></table></div> : <p className="panel-subtitle">Aucun paiement enregistré pour ce dossier.</p>}
          </section>

          <section className="dossier-detail-section">
            <div className="dossier-section-heading"><div><h3>Pièces numérisées</h3><p>Scans des pièces du dossier, conservés avec lui.</p></div></div>
            <DocumentsPanel target={isApplication ? "DEMANDE_BOURSE" : "INSCRIPTION"} id={reference.id} canEdit suggestions={elements.map((element) => element.elementRequis.nom)} />
          </section>

          <section className="dossier-detail-section dossier-next-actions"><h3>À faire</h3>
            {missingElements.length > 0 && <button className="row-action" onClick={() => setAction("elements")}>Compléter les pièces manquantes ({missingElements.length})</button>}
            {unpaidAmount > 0 && <button className="row-action debt-action" onClick={() => setAction("finance")}>Suivre les paiements en attente ({formatMoney(unpaidAmount)})</button>}
            {surplusAmount > 0 && <button className="row-action debt-action" onClick={() => setAction("finance")}>Régulariser le trop-perçu ({formatMoney(surplusAmount)}) : le reporter ou le rembourser</button>}
            {isApplication && !(dossier as DetailedApplication).dateEntretien && !["ACCEPTEE", "REFUSEE"].includes(dossier.statut) && <button className="row-action" onClick={() => setAction("interview")}>Planifier un entretien</button>}
            {isApplication && !["ACCEPTEE", "REFUSEE"].includes(dossier.statut) && <button className="row-action" onClick={() => setAction("status")}>Prendre une décision</button>}
            {!missingElements.length && unpaidAmount <= 0 && surplusAmount <= 0 && (!isApplication || Boolean((dossier as DetailedApplication).dateEntretien) || ["ACCEPTEE", "REFUSEE"].includes(dossier.statut)) && (isApplication ? ["ACCEPTEE", "REFUSEE"].includes(dossier.statut) : dossier.statut === "COMPLETE") && <p className="panel-subtitle">Aucune action en attente n&apos;a été détectée.</p>}
          </section>
        </section>
      )}

      {action === "elements" && <ElementsModal dossierType={reference.type} dossierId={reference.id} onClose={() => setAction(null)} onCompletenessChange={() => refreshDetails()} />}
      {action === "finance" && <FinanceModal dossierType={reference.type} dossierId={reference.id} onClose={() => setAction(null)} onChanged={() => { refreshDetails(); onRefresh(); }} />}
      {action === "person" && person && <PersonForm person={person} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "status" && isApplication && dossier && <EditStatus title="Décision de la demande" endpoint={`/demandes-bourse/${reference.id}/decision`} field="statut" initial={dossier.statut} options={["EN_DELIBERATION", "ACCEPTEE", "REFUSEE"]} scholarshipTypes={scholarshipTypes} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "dossier" && isApplication && dossier && <EditApplicationModal application={dossier as DetailedApplication} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "dossier" && !isApplication && dossier && <EditEnrollmentModal enrollment={dossier as DetailedEnrollment} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "interview" && isApplication && dossier && <InterviewForm application={dossier as DetailedApplication} onClose={() => setAction(null)} onSaved={saveAction} />}
      {action === "delete" && dossier && <DeleteConfirmation title={isApplication ? "la demande de bourse" : "l'inscription"} personName={fullName(person)} busy={deleteBusy} error={deleteError} onClose={() => setAction(null)} onConfirm={(reason) => void deleteDossier(reason)} onLearnMore={() => { setAction(null); onShowDeletionInfo(returnView); }} />}
    </div>
  );
}

const localDay = (value: string | Date) => new Date(value).toLocaleDateString("fr-CA");

// Contrôle de caisse : ce que chaque personne a encaissé sur une période, par mode de paiement.
function CashControl({ payments }: { payments: PaymentTransaction[] }) {
  const today = localDay(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const rows = new Map<string, { cashier: string; mode: string; count: number; total: number }>();
  for (const payment of payments) {
    // Un report déplace un versement entre deux obligations : il ne touche pas la caisse.
    if (payment.typePaiement === "REPORT") continue;
    const day = localDay(payment.datePaiement);
    if (day < from || day > to) continue;
    const cashier = payment.saisiParNom ?? "Non renseigné";
    const mode = paymentModeLabel(payment.modePaiement);
    const row = rows.get(`${cashier}|${mode}`) ?? { cashier, mode, count: 0, total: 0 };
    row.count += 1;
    row.total += Number(payment.montant);
    rows.set(`${cashier}|${mode}`, row);
  }
  const lines = [...rows.values()].sort((a, b) => a.cashier.localeCompare(b.cashier) || a.mode.localeCompare(b.mode));
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Contrôle de caisse</p><h3>Encaissé par caissier et par mode</h3><p className="panel-subtitle">Remboursements et annulations déduits. Comparez la ligne « Espèces » de chaque caissier à l&apos;argent qu&apos;il remet.</p></div>
        <div className="payment-history-total">Total de la période <strong>{formatMoney(total)}</strong></div>
      </div>
      <div className="payment-search-toolbar hub-period">
        <label>Du<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value || today)} /></label>
        <label>Au<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value || today)} /></label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Caissier</th><th>Mode</th><th>Opérations</th><th>Total</th></tr></thead><tbody>
        {lines.map((line) => <tr key={`${line.cashier}|${line.mode}`}><td className="strong-cell">{line.cashier}</td><td>{line.mode}</td><td>{line.count}</td><td className="strong-cell">{formatMoney(line.total)}</td></tr>)}
        {!lines.length && <tr><td colSpan={4} className="empty-state">Aucun encaissement sur cette période.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function LatePaymentsPanel({ latePayments }: { latePayments: LatePayment[] }) {
  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Recouvrement</p><h3>{latePayments.length} échéance(s) en retard</h3></div>
        <div className="payment-history-total">Reste à payer <strong>{formatMoney(latePayments.reduce((total, item) => total + Number(item.resteAPayer), 0))}</strong></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Échéance</th><th>Type</th><th>Date limite</th><th>Attendu</th><th>Payé</th><th>Reste</th></tr></thead><tbody>
        {latePayments.map((item, index) => (
          <tr key={`${item.echeance.libelle}-${index}`}>
            <td className="strong-cell">{item.echeance.libelle}</td>
            <td>{item.echeance.typeBourse?.nom ?? "-"}</td>
            <td>{formatDate(item.echeance.dateEcheance)}</td>
            <td>{formatMoney(item.montantAttendu)}</td>
            <td>{formatMoney(item.montantPaye)}</td>
            <td><span className="status status-refusee">{formatMoney(item.resteAPayer)}</span></td>
          </tr>
        ))}
        {!latePayments.length && <tr><td colSpan={6} className="empty-state">Aucun paiement en retard.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

type PaymentsSection = "journal" | "retards" | "affectation" | "caisse";

// Accueil de la page Paiements : une carte par tâche, chacune ouvre son écran.
function PaymentsHub({ latePayments, refreshKey, dateOrder, onDateOrderChange, onChanged, onRefresh }: { latePayments: LatePayment[]; refreshKey: number; dateOrder: DateOrder; onDateOrderChange: (value: DateOrder) => void; onChanged: () => void; onRefresh: () => void }) {
  const [section, setSection] = useHubSection<PaymentsSection>(["journal", "retards", "affectation", "caisse"]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [unassigned, setUnassigned] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void apiFetch<PaymentTransaction[]>("/paiements?ordreDate=desc").then((result) => { if (active) setPayments(result); }).catch(() => undefined);
    void apiFetch<UnassignedPayment[]>("/paiements/non-affectes").then((result) => { if (active) setUnassigned(result.length); }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey, section]);
  const today = localDay(new Date());
  const collectedToday = payments.filter((payment) => payment.typePaiement !== "REPORT" && localDay(payment.datePaiement) === today).reduce((sum, payment) => sum + Number(payment.montant), 0);
  const lateRemaining = latePayments.reduce((total, item) => total + Number(item.resteAPayer), 0);
  const cards: HubCard<PaymentsSection>[] = [
    { key: "journal", icon: ScrollText, title: "Journal des encaissements", value: `${payments.length}`, detail: `transaction(s) · ${formatMoney(payments.reduce((sum, payment) => sum + Number(payment.montant), 0))} encaissés`, info: "Toutes les opérations, de la plus récente à la plus ancienne : encaissements, remboursements, reports et annulations. Recherchez une transaction, réimprimez un reçu ou annulez un paiement saisi par erreur." },
    { key: "retards", icon: CalendarClock, title: "Échéances en retard", value: `${latePayments.length}`, detail: latePayments.length ? `${formatMoney(lateRemaining)} restent à recouvrer` : "Aucun retard de paiement", tone: latePayments.length ? "alert" : undefined, info: "Les échéances de bourse dont la date limite est passée et qui ne sont pas soldées, avec le montant attendu, payé et restant. C'est la liste des relances à faire." },
    { key: "affectation", icon: Link2, title: "Paiements à affecter", value: unassigned === null ? "…" : `${unassigned}`, detail: unassigned ? "versement(s) sans obligation" : "Tous les paiements sont affectés", tone: unassigned ? "warn" : undefined, info: "Les versements enregistrés sans préciser ce qu'ils règlent. Rattachez chacun à une obligation du dossier pour que le reste à payer soit juste." },
    { key: "caisse", icon: Wallet, title: "Contrôle de caisse", value: formatMoney(collectedToday), detail: "encaissés aujourd'hui", info: "Le total encaissé par caissier et par mode de paiement sur une période. En fin de journée, comparez la ligne « Espèces » de chaque caissier à l'argent qu'il remet." },
  ];
  if (!section) return <HubCards cards={cards} onOpen={setSection} />;
  return (
    <>
      <HubBack label="Paiements" onBack={() => setSection(null)} />
      {section === "journal" && <PaymentHistory refreshKey={refreshKey} dateOrder={dateOrder} onDateOrderChange={onDateOrderChange} onChanged={onChanged} />}
      {section === "retards" && <LatePaymentsPanel latePayments={latePayments} />}
      {section === "affectation" && <UnassignedPaymentsPanel key={refreshKey} onRefresh={onRefresh} />}
      {section === "caisse" && <CashControl payments={payments} />}
    </>
  );
}

export function OperationsPage({
  view,
  dateOrder,
  onDateOrderChange,
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
  applicationTypeBourseId,
  onApplicationTypeBourseChange,
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
  dateOrder: DateOrder;
  onDateOrderChange: (value: DateOrder) => void;
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
  applicationTypeBourseId: string;
  onApplicationTypeBourseChange: (typeBourseId: string) => void;
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
    | "dossier"
    | "relance"
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
            {view === "Demandes de bourse"
              ? "Suivez chaque demande, du dépôt à la décision : pièces, entretien, paiements."
              : view === "Inscriptions"
                ? "Suivez les inscriptions, leurs pièces et leurs règlements."
                : view === "Paiements"
                  ? "Enregistrez les versements et affectez-les aux obligations des dossiers."
                  : view === "Prospects"
                    ? "Suivez les personnes intéressées et planifiez leurs relances."
                    : "Consultez et mettez à jour les dossiers."}
          </p>
        </div>
        {addButton}
      </div>
      {view === "Paiements" ? (
        <PaymentsHub latePayments={latePayments} refreshKey={paymentsRefreshKey} dateOrder={dateOrder} onDateOrderChange={onDateOrderChange} onChanged={() => { setPaymentsRefreshKey((current) => current + 1); onRefresh(); }} onRefresh={onRefresh} />
      ) : (
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Registre</p>
            <h3>
              {`Liste des ${view.toLowerCase()}`}
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
            {(view === "Inscriptions" || view === "Demandes de bourse") && (
              <select
                aria-label="Filtrer par type de bourse"
                value={view === "Inscriptions" ? enrollmentTypeBourseId : applicationTypeBourseId}
                onChange={(event) => (view === "Inscriptions" ? onEnrollmentTypeBourseChange : onApplicationTypeBourseChange)(event.target.value)}
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
            {(
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
            <DateOrderControl value={dateOrder} onChange={onDateOrderChange} />
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
                        className="row-action icon-action"
                        onClick={() => open("dossier", item.id)} aria-label="Modifier le dossier (niveau, filières, école)"><ActionIcon name="edit" /></button>
                      <button
                        className="row-action icon-action"
                        onClick={() => open("status", item.id)} aria-label="Prendre une décision"><ActionIcon name="decide" /></button>
                      <button
                        className="row-action icon-action"
                        onClick={() => open("elements", item.id)} aria-label="Gérer les pièces"><ActionIcon name="pieces" /></button>
                      <button className="row-action icon-action" onClick={() => open("finance", item.id)} aria-label="Situation financière"><ActionIcon name="finance" /></button>
                      <button
                        className="row-action icon-action"
                        onClick={() => open("interview", item.id)} aria-label="Planifier l'entretien"><ActionIcon name="interview" /></button>
                      <button className="row-action icon-action" onClick={() => open("person", item.id)} aria-label="Modifier les informations de l'étudiant"><ActionIcon name="person" /></button>
                      <button
                        className="row-action icon-action danger-row-action"
                        onClick={() => open("deleteApplication", item.id)} aria-label="Supprimer"><ActionIcon name="delete" /></button>
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
                        className="row-action icon-action"
                        onClick={() => open("status", item.id)} aria-label="Modifier"><ActionIcon name="edit" /></button>
                      <button
                        className="row-action icon-action"
                        onClick={() => open("elements", item.id)} aria-label="Gérer les pièces"><ActionIcon name="pieces" /></button>
                      <button className="row-action icon-action" onClick={() => open("person", item.id)} aria-label="Modifier les informations de l'étudiant"><ActionIcon name="person" /></button>
                      <button
                        className="row-action icon-action danger-row-action"
                        onClick={() => open("deleteEnrollment", item.id)} aria-label="Supprimer"><ActionIcon name="delete" /></button>
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
                  <th>Dernier compte rendu</th>
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
                    <td title={item.relances?.[0]?.commentaire ?? undefined}>
                      {item.relances?.[0]?.commentaire
                        ? `${item.relances[0].commentaire.slice(0, 55)}${item.relances[0].commentaire.length > 55 ? "..." : ""}`
                        : "-"}
                    </td>
                    <td>
                      <span className="status status-en_attente">
                        {statusLabels[item.statutRelance]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="row-action icon-action"
                        onClick={() => open("status", item.id)} aria-label="Modifier"><ActionIcon name="edit" /></button>
                      <button className="row-action icon-action" onClick={() => open("relance", item.id)} aria-label="Enregistrer une relance"><ActionIcon name="relance" /></button>
                    </td>
                  </tr>
                ))}
                {!filteredProspects.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Aucun prospect.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
      )}
      {modal === "application" && (
        <CreateApplication
          people={people}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
      {modal === "enrollment" && (
        <CreateEnrollment
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
          onChanged={onRefresh}
        />
      )}
      {modal === "finance" && selectedEnrollment && (
        <FinanceModal
          dossierType="inscription"
          dossierId={selectedEnrollment.id}
          onClose={() => setModal(null)}
          onChanged={onRefresh}
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
      {(modal === "status" || modal === "dossier") && selectedEnrollment && (
        <EditEnrollmentModal enrollment={selectedEnrollment} onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === "dossier" && selectedApplication && (
        <EditApplicationModal application={selectedApplication} onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === "status" && selectedProspect && (
        <EditProspectForm prospect={selectedProspect} onClose={() => setModal(null)} onSaved={onRefresh} />
      )}
      {modal === "relance" && selectedProspect && (
        <ProspectRelanceForm prospect={selectedProspect} onClose={() => setModal(null)} onSaved={onRefresh} />
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
