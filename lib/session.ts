import { User } from "@/lib/types";

// Nom complet de l'utilisateur connecté (session en ligne ou session locale hors ligne).
export function currentUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.sessionStorage.getItem("ipaim-user");
    const offline = window.sessionStorage.getItem("ipaim-offline-session");
    const user = (stored ? JSON.parse(stored) : offline ? (JSON.parse(offline) as { user?: User }).user : null) as User | null;
    return [user?.prenom, user?.nom].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

// Mention portée sur les documents édités : qui les a générés, quel jour et à quelle heure.
export function generatedByLine(date = new Date()): string {
  const day = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const name = currentUserName();
  return `Généré par : ${name || "utilisateur non identifié"}, le ${day} à ${time}`;
}
