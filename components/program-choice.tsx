"use client";

import { useEffect, useState } from "react";
import { ModalChoice } from "@/components/modal-choice";
import { apiFetch } from "@/lib/api";

type Program = { id: string; code: string; nom: string; actif: boolean; troncCommun?: boolean; pole?: { nom: string } | null };

// Filière choisie dans la liste de Structure académique plutôt que tapée : le
// même nom partout, donc un dossier qui se rattache tout seul à sa filière.
// Un nom saisi autrefois, absent de la liste, reste proposé tel quel.
export function ProgramChoice({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  useEffect(() => {
    let active = true;
    void apiFetch<Program[]>("/academique/filieres")
      .then((list) => { if (active) setPrograms(list); })
      .catch(() => { if (active) setPrograms([]); });
    return () => { active = false; };
  }, []);
  // Un tronc commun n'est pas la filière d'un étudiant : il n'est pas proposé ici.
  const open = (programs ?? []).filter((program) => program.actif && !program.troncCommun);
  // Aucune filière paramétrée (ou liste illisible hors ligne) : on garde la saisie libre.
  if (programs && !open.length)
    return <label>{label}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  return (
    <ModalChoice
      required={required}
      label={label}
      placeholder="Sélectionner une filière"
      value={value}
      choices={[
        ...(required ? [] : [{ value: "", label: "Aucune" }]),
        ...(value && !open.some((program) => program.nom === value) ? [{ value, label: value, detail: "Hors liste" }] : []),
        ...open.map((program) => ({ value: program.nom, label: program.nom, detail: [program.code, program.pole?.nom].filter(Boolean).join(" · ") })),
      ]}
      onChange={onChange}
    />
  );
}
