"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "@/components/feedback";
import { ModalChoice } from "@/components/modal-choice";
import { FormActions, Modal, messageOf, send } from "@/components/ui-kit";
import { apiFetch } from "@/lib/api";
import { Application, Enrollment, fullName, statusLabels } from "@/lib/types";

type Level = { code: string; libelle: string; cycle?: string; actif?: boolean };
type Program = { id: string; code: string; nom: string; actif: boolean };

const DEMANDE_LEVELS = [{ value: "PREMIERE_ANNEE", label: "Première année" }, { value: "DEUXIEME_ANNEE", label: "Deuxième année" }];
const ENROLLMENT_STATUSES = ["EN_COURS", "COMPLETE", "ABANDONNEE"];
// Tant que le référentiel n'a pas répondu (hors ligne, par exemple).
const FALLBACK_LEVELS: Level[] = ["L1", "L2", "L3", "M1", "M2"].map((code) => ({ code, libelle: code }));

// Seuls les champs changés partent au serveur : il revérifie chaque règle
// (niveau figé après paiement, étudiant déjà en classe...).
function changes<T extends Record<string, string>>(initial: T, current: T) {
  return Object.fromEntries(Object.entries(current).filter(([key, value]) => value.trim() !== (initial[key] ?? "").trim()).map(([key, value]) => [key, value.trim() || null]));
}

function useReferential() {
  const [levels, setLevels] = useState<Level[]>(FALLBACK_LEVELS);
  const [programs, setPrograms] = useState<Program[]>([]);
  useEffect(() => {
    void apiFetch<Level[]>("/academique/niveaux").then((list) => { if (list.length) setLevels(list); }).catch(() => undefined);
    void apiFetch<Program[]>("/academique/filieres").then(setPrograms).catch(() => undefined);
  }, []);
  return { levels: levels.filter((item) => item.actif !== false), programs: programs.filter((item) => item.actif) };
}

// Corriger une demande de bourse : niveau, filières, école d'origine.
export function EditApplicationModal({ application, onClose, onSaved }: { application: Application; onClose: () => void; onSaved: () => void }) {
  const initial = {
    niveauDemande: application.niveauDemande,
    filiereSouhaitee: application.filiereSouhaitee,
    filiereSecondaireSouhaitee: application.filiereSecondaireSouhaitee ?? "",
    ecoleOrigine: application.ecoleOrigine ?? "",
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { programs } = useReferential();
  const set = (patch: Partial<typeof initial>) => setForm((current) => ({ ...current, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = changes(initial, form);
    if (!Object.keys(body).length) return onClose();
    setBusy(true);
    setError("");
    try {
      await send(`/demandes-bourse/${application.id}/informations`, "PATCH", body, true);
      toast("Demande de bourse modifiée.");
      onSaved();
      onClose();
    } catch (failure) {
      setError(messageOf(failure, "Modification impossible."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Modifier la demande de ${fullName(application.personne)}`} onClose={onClose}>
      <form className="entity-form" onSubmit={(event) => void submit(event)}>
        <p className="panel-subtitle">L&apos;identité de l&apos;étudiant se corrige avec « Modifier les informations de l&apos;étudiant ». Le niveau ne change plus une fois un paiement enregistré, car les frais en dépendent.</p>
        <ModalChoice required label="Niveau demandé" placeholder="Sélectionner un niveau" value={form.niveauDemande} choices={DEMANDE_LEVELS} onChange={(niveauDemande) => set({ niveauDemande })} />
        <label>
          Filière souhaitée
          <input required list="filieres-dossier" value={form.filiereSouhaitee} onChange={(event) => set({ filiereSouhaitee: event.target.value })} />
        </label>
        <label>
          Filière secondaire souhaitée (facultatif)
          <input list="filieres-dossier" value={form.filiereSecondaireSouhaitee} onChange={(event) => set({ filiereSecondaireSouhaitee: event.target.value })} />
        </label>
        <label>
          École d&apos;origine (facultatif)
          <input value={form.ecoleOrigine} onChange={(event) => set({ ecoleOrigine: event.target.value })} />
        </label>
        <datalist id="filieres-dossier">{programs.map((program) => <option key={program.id} value={program.nom} />)}</datalist>
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// Corriger une inscription : année, niveau, filière et statut.
export function EditEnrollmentModal({ enrollment, onClose, onSaved }: { enrollment: Enrollment; onClose: () => void; onSaved: () => void }) {
  const initial = { anneeScolaire: enrollment.anneeScolaire, niveau: enrollment.niveau, filiere: enrollment.filiere, statut: enrollment.statut };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { levels, programs } = useReferential();
  const inClass = Boolean(enrollment.classeId);
  const set = (patch: Partial<typeof initial>) => setForm((current) => ({ ...current, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body: Record<string, unknown> = changes(initial, form);
    if (!Object.keys(body).length) return onClose();
    // La filière choisie dans le référentiel part avec son identifiant.
    const program = programs.find((item) => item.nom === form.filiere);
    if (body.filiere && program) body.filiereId = program.id;
    setBusy(true);
    setError("");
    try {
      await send(`/inscriptions/${enrollment.id}`, "PATCH", body, true);
      toast("Inscription modifiée.");
      onSaved();
      onClose();
    } catch (failure) {
      setError(messageOf(failure, "Modification impossible."));
    } finally {
      setBusy(false);
    }
  };
  const programChoices = [
    ...(form.filiere && !programs.some((item) => item.nom === form.filiere) ? [{ value: form.filiere, label: form.filiere, detail: "Hors référentiel" }] : []),
    ...programs.map((item) => ({ value: item.nom, label: item.nom, detail: item.code })),
  ];
  const levelChoices = [
    ...(form.niveau && !levels.some((item) => item.code === form.niveau) ? [{ value: form.niveau, label: form.niveau }] : []),
    ...levels.map((item) => ({ value: item.code, label: `${item.code} · ${item.libelle}`, detail: item.cycle })),
  ];
  return (
    <Modal title={`Modifier l'inscription de ${fullName(enrollment.personne)}`} onClose={onClose}>
      <form className="entity-form" onSubmit={(event) => void submit(event)}>
        {inClass ? (
          <p className="panel-subtitle">Cet étudiant est déjà dans une classe : son année, son niveau et sa filière suivent la classe. Retirez-le d&apos;abord de la classe pour les changer.</p>
        ) : (
          <p className="panel-subtitle">Un changement de niveau met à jour les pièces et frais demandés. L&apos;identité se corrige avec « Modifier les informations de l&apos;étudiant ».</p>
        )}
        <label>
          Année scolaire
          <input required disabled={inClass} value={form.anneeScolaire} onChange={(event) => set({ anneeScolaire: event.target.value })} />
        </label>
        {inClass ? (
          <label>Niveau<input disabled value={form.niveau} /></label>
        ) : (
          <ModalChoice required label="Niveau" placeholder="Sélectionner un niveau" value={form.niveau} choices={levelChoices} onChange={(niveau) => set({ niveau })} />
        )}
        {inClass || !programChoices.length ? (
          <label>Filière<input required disabled={inClass} value={form.filiere} onChange={(event) => set({ filiere: event.target.value })} /></label>
        ) : (
          <ModalChoice required label="Filière" placeholder="Sélectionner une filière" value={form.filiere} choices={programChoices} onChange={(filiere) => set({ filiere })} />
        )}
        <ModalChoice label="Statut" placeholder="Sélectionner un statut" value={form.statut} choices={ENROLLMENT_STATUSES.map((value) => ({ value, label: statusLabels[value] ?? value }))} onChange={(statut) => set({ statut })} />
        {error && <p className="form-error">{error}</p>}
        <FormActions busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
