import { User } from "@/lib/types";

// Utilisateur connecté (session en ligne ou session locale hors ligne).
export function currentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem("ipaim-user");
    const offline = window.sessionStorage.getItem("ipaim-offline-session");
    return ((stored ? JSON.parse(stored) : offline ? (JSON.parse(offline) as { user?: User }).user : null) as User | null) ?? null;
  } catch {
    return null;
  }
}

// Nom complet de l'utilisateur connecté.
export function currentUserName(): string {
  const user = currentUser();
  return [user?.prenom, user?.nom].filter(Boolean).join(" ");
}

// Mention portée sur les documents édités : qui les a générés, quel jour et à quelle heure.
export function generatedByLine(date = new Date()): string {
  const day = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const name = currentUserName();
  return `Généré par : ${name || "utilisateur non identifié"}, le ${day} à ${time}`;
}
