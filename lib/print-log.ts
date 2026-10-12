import { API_URL } from "@/lib/offline";

export type PrintDocument = "RECU_PAIEMENT" | "RECU_REMBOURSEMENT" | "CERTIFICAT_BOURSE" | "CERTIFICAT_INSCRIPTION" | "BON_COMMANDE" | "RAPPORT_ACTIVITE" | "BULLETIN_NOTES" | "PV_DELIBERATION" | "BULLETIN_PAIE" | "CARTE_ETUDIANT" | "RELEVE_NOTES" | "FICHE_ANONYMAT" | "CERTIFICAT_SCOLARITE" | "ATTESTATION_REUSSITE" | "DIPLOME";
export type PrintRecord = {
  typeDocument: PrintDocument;
  mode: "IMPRESSION" | "PDF";
  dossierType?: "demande-bourse" | "inscription" | "depense";
  dossierId?: string | null;
  libelle: string;
  reference?: string | null;
};
type PendingPrint = PrintRecord & { cle: string; date: string };

const PENDING_KEY = "ipaim-impressions-en-attente";
let flushing = false;
let listening = false;

function readPending(): PendingPrint[] {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? "[]") as PendingPrint[];
  } catch {
    return [];
  }
}

function writePending(pending: PendingPrint[]) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(-200)));
  } catch {
    // Stockage indisponible : l'impression en cours n'est simplement pas mise en attente.
  }
}

// Envoie les impressions en attente. Celles faites hors ligne partent au retour de la connexion.
export async function flushPrintLog() {
  if (typeof window === "undefined" || flushing || !navigator.onLine) return;
  const token = window.sessionStorage.getItem("ipaim-token");
  if (!token) return;
  flushing = true;
  try {
    for (const { cle, ...record } of readPending()) {
      const response = await fetch(`${API_URL}/impressions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(record),
      });
      // Session expirée ou serveur indisponible : on réessaiera plus tard.
      if (response.status === 401 || response.status >= 500) break;
      writePending(readPending().filter((item) => item.cle !== cle));
    }
  } catch {
    // Réseau coupé pendant l'envoi : la file est conservée.
  } finally {
    flushing = false;
  }
}

// Consigne une impression ou un export PDF dans l'historique, sans jamais gêner l'impression elle-même.
export function logPrint(record: PrintRecord) {
  if (typeof window === "undefined") return;
  if (!listening) {
    listening = true;
    window.addEventListener("online", () => void flushPrintLog());
    // Le serveur répond à nouveau alors que le réseau n'avait pas bougé (retour du courant).
    window.addEventListener("ipaim-server-online", () => void flushPrintLog());
  }
  writePending([...readPending(), { ...record, cle: crypto.randomUUID(), date: new Date().toISOString() }]);
  void flushPrintLog();
}
