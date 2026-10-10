import { apiFetch } from "./api";
import { askConfirm } from "../components/feedback";
import { Person, PersonPage, formatDate } from "./types";

type Candidate = { nom?: string | null; prenom?: string | null; dateNaissance?: string | null; telephone?: string | null };
type Similar = Pick<Person, "id" | "nom" | "prenom" | "dateNaissance" | "telephone" | "matricule">;

const normalize = (value?: string | null) => (value ?? "").trim().toLocaleLowerCase();
const digits = (value?: string | null) => (value ?? "").replace(/\s/g, "");

// Même règle que le serveur : même nom et même prénom ; si la date de naissance ou
// le téléphone sont connus des deux côtés, l'un des deux doit concorder.
function resembles(candidate: Candidate, existing: Similar) {
  if (normalize(existing.nom) !== normalize(candidate.nom) || normalize(existing.prenom) !== normalize(candidate.prenom)) return false;
  const sameDay = candidate.dateNaissance && existing.dateNaissance ? existing.dateNaissance.slice(0, 10) === candidate.dateNaissance.slice(0, 10) : null;
  const samePhone = digits(candidate.telephone) && digits(existing.telephone) ? digits(existing.telephone) === digits(candidate.telephone) : null;
  if (sameDay === null && samePhone === null) return true;
  return sameDay === true || samePhone === true;
}

async function similarPeople(candidate: Candidate): Promise<Similar[]> {
  const query = new URLSearchParams({ nom: candidate.nom ?? "", prenom: candidate.prenom ?? "" });
  if (candidate.dateNaissance) query.set("dateNaissance", candidate.dateNaissance);
  if (candidate.telephone) query.set("telephone", candidate.telephone);
  try {
    const found = await apiFetch<Similar[]>(`/personnes/doublons?${query}`, { skipCache: true });
    if (Array.isArray(found)) return found;
  } catch {
    // Hors ligne ou serveur absent : on cherche dans les personnes connues de l'appareil.
  }
  const local = await apiFetch<PersonPage>(`/personnes?page=1&limit=100&q=${encodeURIComponent(`${candidate.nom ?? ""} ${candidate.prenom ?? ""}`.trim())}`, { skipCache: true }).catch(() => null);
  return (local?.data ?? []).filter((person) => resembles(candidate, person)).slice(0, 5);
}

/**
 * Avant de créer une personne : avertit si une fiche semblable existe déjà.
 * Renvoie false si l'utilisateur renonce à la création.
 */
export async function confirmNewPerson(candidate: Candidate) {
  if (!normalize(candidate.nom) || !normalize(candidate.prenom)) return true;
  const similar = await similarPeople(candidate);
  if (!similar.length) return true;
  const described = similar
    .map((person) => [
      `${person.nom} ${person.prenom}`,
      person.dateNaissance ? `né(e) le ${formatDate(person.dateNaissance)}` : null,
      person.telephone,
      person.matricule,
    ].filter(Boolean).join(" · "))
    .join(" ; ");
  return askConfirm({
    title: similar.length > 1 ? "Des personnes semblables existent déjà" : "Une personne semblable existe déjà",
    message: `${described}. S’il s’agit de la même personne, annulez et choisissez sa fiche existante. Sinon, vous pouvez créer une nouvelle fiche.`,
    confirmLabel: "Créer quand même",
  });
}
