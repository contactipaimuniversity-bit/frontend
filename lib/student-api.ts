"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { API_URL } from "@/lib/connectivity";

// Espace étudiant : session et données, indépendantes de l'espace de gestion.
// La session reste sur l'appareil (application installée) jusqu'à la déconnexion ;
// chaque réponse est gardée pour être relue sans réseau.

const TOKEN_KEY = "ipaim-etudiant-token";
const CACHE_PREFIX = "ipaim-etudiant-cache:";
const SESSION_EVENT = "ipaim-etudiant-session";
const TIMEOUT_MS = 15000;

export class StudentApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* stockage plein ou interdit : la page fonctionne sans */
  }
}

export function studentToken() {
  return typeof window === "undefined" ? null : read(TOKEN_KEY);
}

export function setStudentToken(token: string) {
  write(TOKEN_KEY, token);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

// Déconnexion : la session et toutes les données gardées sur l'appareil disparaissent.
export function signOutStudent() {
  write(TOKEN_KEY, null);
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* rien à effacer */
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(SESSION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** Jeton de l'étudiant connecté ; `undefined` pendant le rendu serveur. */
export function useStudentToken() {
  return useSyncExternalStore<string | null | undefined>(subscribe, studentToken, () => undefined);
}

async function request(path: string, init: RequestInit & { auth?: boolean } = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = studentToken();
  if (init.auth !== false && token) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    throw new StudentApiError("Pas de connexion au serveur.", 0);
  } finally {
    window.clearTimeout(timer);
  }
  if (response.status === 401 && init.auth !== false) {
    signOutStudent();
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
    throw new StudentApiError(message || "Une erreur est survenue. Réessaie dans un instant.", response.status);
  }
  return response;
}

export async function studentPost<T>(path: string, body: unknown, auth = true): Promise<T> {
  const response = await request(path, { method: "POST", body: JSON.stringify(body), auth });
  return (await response.json()) as T;
}

type Cached<T> = { data: T; at: number };

function readCache<T>(path: string): Cached<T> | null {
  const raw = read(CACHE_PREFIX + path);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Cached<T>;
  } catch {
    return null;
  }
}

export type StudentResource<T> = {
  data: T | null;
  error: string;
  loading: boolean;
  /** Date de la version affichée quand elle vient de l'appareil (pas de réseau). */
  staleSince: number | null;
  reload: () => void;
};

/** Lecture d'une donnée de l'étudiant : la version gardée tout de suite, puis celle du serveur. */
export function useStudentResource<T>(path: string): StudentResource<T> {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean; staleSince: number | null }>({ data: null, error: "", loading: true, staleSince: null });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const cached = readCache<T>(path);
    // Montre aussitôt la dernière version connue, avant la réponse du serveur.
    queueMicrotask(() => {
      if (active && cached) setState((previous) => (previous.data ? previous : { data: cached.data, error: "", loading: true, staleSince: null }));
    });
    request(path)
      .then((response) => response.json() as Promise<T>)
      .then((data) => {
        write(CACHE_PREFIX + path, JSON.stringify({ data, at: Date.now() } satisfies Cached<T>));
        if (active) setState({ data, error: "", loading: false, staleSince: null });
      })
      .catch((failure: unknown) => {
        if (!active) return;
        const error = failure instanceof Error ? failure.message : "Erreur inconnue";
        const offline = failure instanceof StudentApiError && failure.status === 0;
        setState({ data: cached?.data ?? null, error: cached && offline ? "" : error, loading: false, staleSince: cached && offline ? cached.at : null });
      });
    return () => {
      active = false;
    };
  }, [path, tick]);

  return { ...state, reload };
}

/** Photo d'identité, gardée sur l'appareil (data URL). */
export function useStudentPhoto(enabled: boolean) {
  const [photo, setPhoto] = useState<string | null>(() => (typeof window === "undefined" ? null : read(`${CACHE_PREFIX}photo`)));
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    request("/etudiant/moi/photo")
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      )
      .then((dataUrl) => {
        write(`${CACHE_PREFIX}photo`, dataUrl);
        if (active) setPhoto(dataUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled ? photo : null;
}

// ---------- Types renvoyés par le serveur ----------

export type StudentProfile = {
  etudiant: {
    id: string;
    nom: string;
    prenom: string;
    matricule: string | null;
    sexe: string | null;
    telephone: string | null;
    quartier: string | null;
    dateNaissance: string | null;
    lieuNaissance: string | null;
    tuteurNom: string | null;
    tuteurPrenom: string | null;
    tuteurTelephone: string | null;
    aPhoto: boolean;
  };
  inscription: {
    id: string;
    statut: string;
    anneeScolaire: string;
    niveau: string;
    filiere: string;
    viaBourse: boolean;
    classe: { id: string; nom: string; groupe: string } | null;
    annee: { libelle: string; dateDebut: string; dateFin: string; finSemestre1: string | null } | null;
  } | null;
  compte: { activeLe: string | null; derniereConnexion: string | null } | null;
};

export type Slot = { id: string; jour: number; heureDebut: string; heureFin: string; matiere: string; code: string; salle: string | null; enseignant: string | null; commun: boolean };
export type Timetable = { classe: string | null; creneaux: Slot[] };

export type Exam = { id: string; type: string; libelle: string; date: string; heureDebut: string | null; heureFin: string | null; salle: string | null; matiere: string; validee: boolean };

export type CardInfo = { carte: { jeton: string; valableJusquau: string; creeLe: string } | null; anneeScolaire: string };

type Line = { id: string; libelle: string; montant: number; paye: number; reste: number; dateLimite?: string | null };
export type Fees = {
  anneeScolaire: string;
  situation: { regime: unknown; mensualites: Line[]; annexes: Line[]; fraisInscription: Line[]; resteMensualites: number; resteAnnexes: number; resteTotal: number; tropPercu: number } | null;
  paiements: Array<{ id: string; montant: number; date: string; type: string; libelle: string; numeroRecu: string | null; mode: string | null }>;
};

export type Attendance = {
  totalMinutes: number;
  nonJustifieesMinutes: number;
  absences: Array<{ id: string; date: string; heureDebut: string; dureeMinutes: number; matiere: string; justifiee: boolean; motif: string | null }>;
  retards: Array<{ id: string; date: string; heureDebut: string; matiere: string; minutes: number }>;
};

export type Grade = {
  id: string;
  valeur: number | null;
  absent: boolean;
  evaluation: { id: string; libelle: string; type: string; date: string | null; bareme: number; publieeLe: string | null };
  matiere: { id: string; nom: string; code: string; coefficient: number };
  ue: { code: string; nom: string; semestre: number; credits: number };
};
export type SemesterResult =
  | { semestre: number; disponible: true; resultat: { moyenne: number | null; creditsAcquis: number; creditsTotal: number; rang: number | null; mention: string | null; decision: string }; classe: { effectif: number; moyenne: number | null }; dateCloture: string | null }
  | { semestre: number; disponible: false; message: string };
export type Grades = { notes: Grade[]; resultats: SemesterResult[] };

// ---------- Mise en forme ----------

export const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function money(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
}

export function shortDate(value: string | Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Date(value).toLocaleDateString("fr-FR", options);
}

export function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

/** Jour de la semaine au format du serveur : 1 = lundi … 7 = dimanche. */
export function weekday(date = new Date()) {
  return ((date.getDay() + 6) % 7) + 1;
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
