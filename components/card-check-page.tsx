"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Ban, Camera, CheckCircle2, CircleAlert, IdCard, ScanLine, ShieldX } from "lucide-react";
import { CameraScanner } from "@/components/camera-scanner";
import { askReason, toast } from "@/components/feedback";
import { PhotoFrame } from "@/components/student-photo";
import { PageIntro, Panel, messageOf, send } from "@/components/ui-kit";
import { canOpenPersonFile, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { navigateTo, pathForPerson } from "@/lib/routes";
import { User, formatDate, formatMoney, statusLabels } from "@/lib/types";

type Verdict = "VALIDE" | "DESACTIVEE" | "EXPIREE" | "INSCRIPTION_ABANDONNEE";
type ScanResult = {
  verdict: Verdict;
  carte: { id: string; creeLe: string; valableJusquau: string; desactiveeLe?: string | null; motifDesactivation?: string | null };
  personne: { id: string; nom: string; prenom: string; matricule: string | null; sexe?: string | null; dateNaissance?: string | null; photoUrl?: string | null };
  inscription: { id: string; statut: string; anneeScolaire: string; niveau: string; filiere: string; classe: string | null };
  resteDu: number;
  absencesNonJustifiees: number;
};
type Entry = { at: string; code: string; result?: ScanResult; error?: string };

const VERDICTS: Record<Verdict, { label: string; detail: string; tone: "ok" | "bad" }> = {
  VALIDE: { label: "Carte valide", detail: "L'étudiant est inscrit pour l'année en cours.", tone: "ok" },
  DESACTIVEE: { label: "Carte désactivée", detail: "Cette carte a été déclarée perdue, volée ou remplacée : retenez-la et orientez l'étudiant vers la scolarité.", tone: "bad" },
  EXPIREE: { label: "Carte expirée", detail: "La carte n'est plus valable : l'étudiant doit faire éditer la carte de l'année en cours.", tone: "bad" },
  INSCRIPTION_ABANDONNEE: { label: "Inscription abandonnée", detail: "L'étudiant n'est plus inscrit : orientez-le vers la scolarité.", tone: "bad" },
};

// Seuls les QR codes de nos cartes sont retenus ; le reste est ignoré par la caméra.
const cardCode = (raw: string) => raw.trim().toUpperCase().match(/IPAIM:C1:[A-Z2-7]{24}/)?.[0] ?? null;

// Contrôle des cartes d'étudiant, à l'entrée comme à la scolarité : on scanne la
// carte (douchette ou caméra) et l'écran dit aussitôt si elle est valable.
export function CardCheckPage({ user }: { user: User | null }) {
  const [draft, setDraft] = useState("");
  const [current, setCurrent] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canManage = hasAccess(user, "enrollments", "edit") || hasAccess(user, "academics", "edit");
  // La douchette « tape » le code puis Entrée : le champ garde le curseur.
  useEffect(() => { input.current?.focus(); }, [current]);

  const check = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setBusy(true);
    const entry: Entry = { at: new Date().toISOString(), code };
    try {
      if (!cardCode(code)) throw new Error("Ce code n'est pas une carte d'étudiant IPAIM.");
      entry.result = await apiFetch<ScanResult>(`/cartes/scan?code=${encodeURIComponent(cardCode(code)!)}`, { skipCache: true });
    } catch (failure) {
      entry.error = messageOf(failure, "Vérification impossible.");
    }
    setCurrent(entry);
    setHistory((list) => [entry, ...list].slice(0, 12));
    setDraft("");
    setBusy(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void check(draft);
  };
  const deactivate = async (result: ScanResult) => {
    const motif = await askReason({ title: `Désactiver la carte de ${result.personne.prenom} ${result.personne.nom} ?`, message: "La carte ne passera plus au contrôle. Éditez ensuite une nouvelle carte depuis la classe de l'étudiant.", confirmLabel: "Désactiver la carte", danger: true, reason: { label: "Motif", minLength: 3, placeholder: "Carte perdue, volée, prêtée..." } });
    if (!motif) return;
    try {
      await send(`/cartes/${result.carte.id}/desactivation`, "POST", { motif }, true);
      toast("Carte désactivée.");
      if (current) void check(current.code);
    } catch (failure) {
      toast(messageOf(failure, "Désactivation impossible."), "error");
    }
  };

  const result = current?.result;
  const verdict = result ? VERDICTS[result.verdict] : null;
  return (
    <div className="content-scroll card-check">
      <PageIntro eyebrow="Contrôle" title="Contrôle des cartes" text="Scannez la carte d'un étudiant : l'écran indique aussitôt si elle est valable, avec sa photo pour vérifier que c'est bien lui. Seules les cartes IPAIM sont reconnues.">
        <button className="outline-button small" onClick={() => setCamera(true)}><Camera size={15} aria-hidden="true" /> Scanner avec la caméra</button>
      </PageIntro>

      <form className="card-check-input" onSubmit={submit}>
        <ScanLine size={20} aria-hidden="true" />
        <input ref={input} aria-label="Code de la carte" placeholder="Scannez la carte avec la douchette, ou collez son code ici" value={draft} onChange={(event) => setDraft(event.target.value)} autoComplete="off" spellCheck={false} />
        <button className="primary-button compact" disabled={busy || !draft.trim()}>Vérifier</button>
      </form>

      {current && (
        <section className={`card-check-result ${current.error ? "bad" : verdict?.tone}`} aria-live="assertive">
          <div className="card-check-verdict">
            {current.error ? <ShieldX size={34} aria-hidden="true" /> : verdict?.tone === "ok" ? <CheckCircle2 size={34} aria-hidden="true" /> : <Ban size={34} aria-hidden="true" />}
            <div>
              <strong>{current.error ? "Carte refusée" : verdict?.label}</strong>
              <p>{current.error ?? verdict?.detail}</p>
            </div>
          </div>
          {result && (
            <div className="card-check-student">
              <PhotoFrame owner={result.personne} alt={`Photo de ${result.personne.prenom} ${result.personne.nom}`} />
              <dl>
                <div className="card-check-name"><dt>Étudiant</dt><dd>{result.personne.nom.toUpperCase()} {result.personne.prenom}</dd></div>
                <div><dt>Matricule</dt><dd>{result.personne.matricule ?? "—"}</dd></div>
                <div><dt>Classe</dt><dd>{result.inscription.classe ?? `${result.inscription.filiere} · ${result.inscription.niveau}`}</dd></div>
                <div><dt>Année</dt><dd>{result.inscription.anneeScolaire} · {statusLabels[result.inscription.statut] ?? result.inscription.statut}</dd></div>
                <div><dt>Scolarité</dt><dd className={result.resteDu > 0 ? "bad" : "ok"}>{result.resteDu > 0 ? `Reste dû : ${formatMoney(result.resteDu)}` : "À jour de ses paiements"}</dd></div>
                <div><dt>Absences non justifiées</dt><dd>{result.absencesNonJustifiees}</dd></div>
                <div><dt>Carte</dt><dd>Valable jusqu&apos;au {formatDate(result.carte.valableJusquau)}{result.carte.motifDesactivation ? ` · ${result.carte.motifDesactivation}` : ""}</dd></div>
              </dl>
            </div>
          )}
          {result && (
            <div className="form-actions">
              {canOpenPersonFile(user) && <button className="outline-button small" onClick={() => navigateTo(pathForPerson(result.personne.id))}><IdCard size={15} aria-hidden="true" /> Fiche complète</button>}
              {canManage && result.verdict === "VALIDE" && <button className="danger-button" onClick={() => void deactivate(result)}>Désactiver cette carte</button>}
            </div>
          )}
        </section>
      )}

      {history.length > 1 && (
        <Panel eyebrow="Cette session" title="Derniers contrôles" subtitle="Gardés sur cet écran seulement, jusqu'à sa fermeture.">
          <ul className="card-check-history">
            {history.slice(1).map((entry) => (
              <li key={entry.at} className={entry.error || entry.result?.verdict !== "VALIDE" ? "bad" : "ok"}>
                {entry.error || entry.result?.verdict !== "VALIDE" ? <CircleAlert size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                <span>{entry.result ? `${entry.result.personne.nom.toUpperCase()} ${entry.result.personne.prenom} · ${VERDICTS[entry.result.verdict].label}` : entry.error}</span>
                <small>{new Date(entry.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {camera && <CameraScanner title="Scanner une carte d'étudiant" hint="Présentez le QR code de la carte devant la caméra : elle est vérifiée automatiquement." extract={cardCode} onClose={() => setCamera(false)} onCode={(code) => { setCamera(false); void check(code); }} />}
    </div>
  );
}
