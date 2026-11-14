"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ChevronRight, Download, IdCard, KeyRound, LogOut, Share, ShieldCheck, Sun, UserX, X } from "lucide-react";
import { Avatar, Loaded, ScreenHeader, Section } from "@/components/etudiant/student-ui";
import { CardInfo, StudentProfile, StudentResource, setStudentToken, shortDate, signOutStudent, studentPost, useStudentResource } from "@/lib/student-api";

// ---------- Installation de l'application ----------

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredInstall: InstallEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as InstallEvent;
    window.dispatchEvent(new Event("ipaim-etudiant-installable"));
  });
}

function useInstall() {
  const [state, setState] = useState<{ installed: boolean; canPrompt: boolean; ios: boolean }>({ installed: false, canPrompt: false, ios: false });
  useEffect(() => {
    const refresh = () =>
      setState({
        installed: window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
        canPrompt: Boolean(deferredInstall),
        ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
      });
    refresh();
    window.addEventListener("ipaim-etudiant-installable", refresh);
    window.addEventListener("appinstalled", refresh);
    return () => {
      window.removeEventListener("ipaim-etudiant-installable", refresh);
      window.removeEventListener("appinstalled", refresh);
    };
  }, []);
  const prompt = async () => {
    if (!deferredInstall) return;
    await deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => undefined);
    deferredInstall = null;
    setState((previous) => ({ ...previous, canPrompt: false }));
  };
  return { ...state, prompt };
}

// ---------- Profil ----------

export function ProfileScreen({ profile, photo }: { profile: StudentResource<StudentProfile>; photo: string | null }) {
  const install = useInstall();
  const [iosHelp, setIosHelp] = useState(false);

  const signOut = () => {
    if (window.confirm("Te déconnecter ? Les données gardées sur ce téléphone seront effacées.")) signOutStudent();
  };

  return (
    <div className="stu-screen">
      <ScreenHeader title="Profil" />
      <Loaded resource={profile} lines={4}>
        {({ etudiant, inscription }) => (
          <>
            <section className="stu-profile-card">
              <Avatar photo={photo} name={`${etudiant.prenom} ${etudiant.nom}`} size={72} />
              <div>
                <h2>{etudiant.prenom} {etudiant.nom}</h2>
                <p>{etudiant.matricule ?? "Matricule non attribué"}</p>
                {inscription && <p>{inscription.classe?.nom ?? `${inscription.filiere} · ${inscription.niveau}`}</p>}
              </div>
            </section>

            <div className="stu-card stu-menu">
              <Link href="/etudiant/carte"><span className="stu-shortcut-icon tone-gold"><IdCard size={19} aria-hidden="true" /></span>Ma carte d&apos;étudiant<ChevronRight size={18} aria-hidden="true" /></Link>
              <Link href="/etudiant/absences"><span className="stu-shortcut-icon tone-slate"><UserX size={19} aria-hidden="true" /></span>Absences et retards<ChevronRight size={18} aria-hidden="true" /></Link>
              <Link href="/etudiant/mot-de-passe"><span className="stu-shortcut-icon tone-blue"><KeyRound size={19} aria-hidden="true" /></span>Changer mon mot de passe<ChevronRight size={18} aria-hidden="true" /></Link>
              {!install.installed && (install.canPrompt || install.ios) && (
                <button type="button" onClick={() => (install.canPrompt ? void install.prompt() : setIosHelp(true))}>
                  <span className="stu-shortcut-icon tone-green"><Download size={19} aria-hidden="true" /></span>Installer l&apos;application<ChevronRight size={18} aria-hidden="true" />
                </button>
              )}
            </div>

            {iosHelp && (
              <div className="stu-info">
                <Share size={17} aria-hidden="true" />
                <p>Sur iPhone : touche <strong>Partager</strong> dans Safari, puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.</p>
                <button type="button" className="stu-icon-button" onClick={() => setIosHelp(false)} aria-label="Fermer"><X size={16} aria-hidden="true" /></button>
              </div>
            )}

            <Section title="Informations personnelles">
              <dl className="stu-card stu-facts">
                <div><dt>Date de naissance</dt><dd>{etudiant.dateNaissance ? `${shortDate(etudiant.dateNaissance, { day: "numeric", month: "long", year: "numeric" })}${etudiant.lieuNaissance ? ` à ${etudiant.lieuNaissance}` : ""}` : "—"}</dd></div>
                <div><dt>Téléphone</dt><dd>{etudiant.telephone ?? "—"}</dd></div>
                <div><dt>Quartier</dt><dd>{etudiant.quartier ?? "—"}</dd></div>
                <div><dt>Parent / tuteur</dt><dd>{[etudiant.tuteurPrenom, etudiant.tuteurNom].filter(Boolean).join(" ") || "—"}{etudiant.tuteurTelephone ? ` · ${etudiant.tuteurTelephone}` : ""}</dd></div>
                {inscription && <div><dt>Inscription</dt><dd>{inscription.anneeScolaire}{inscription.viaBourse ? " · boursier" : ""}</dd></div>}
              </dl>
              <p className="stu-footnote">Une information est fausse ? Signale-la à la scolarité.</p>
            </Section>

            <button type="button" className="stu-button stu-button-danger stu-button-block" onClick={signOut}>
              <LogOut size={18} aria-hidden="true" /> Se déconnecter
            </button>
          </>
        )}
      </Loaded>
    </div>
  );
}

// ---------- Carte d'étudiant ----------

export function CardScreen({ profile, photo }: { profile: StudentProfile | null; photo: string | null }) {
  const card = useStudentResource<CardInfo>("/etudiant/moi/carte");
  const [qr, setQr] = useState<string | null>(null);
  const token = card.data?.carte?.jeton;

  useEffect(() => {
    if (!token) return;
    let active = true;
    void import("qrcode").then(({ default: QRCode }) =>
      QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 1, width: 640, color: { dark: "#0c1b43", light: "#ffffff" } }).then((url) => {
        if (active) setQr(url);
      }),
    );
    return () => {
      active = false;
    };
  }, [token]);

  const student = profile?.etudiant;
  const inscription = profile?.inscription;
  return (
    <div className="stu-screen stu-card-screen">
      <ScreenHeader title="Ma carte d'étudiant" back="/etudiant" />
      <Loaded resource={card} lines={5}>
        {(data) =>
          data.carte ? (
            <>
              <article className="stu-idcard">
                <div className="stu-idcard-top">
                  <Image src="/etudiant/icon-192.png" alt="" width={36} height={36} />
                  <div>
                    <strong>IPAIM University</strong>
                    <span>Carte d&apos;étudiant · {data.anneeScolaire}</span>
                  </div>
                </div>
                <div className="stu-idcard-id">
                  <Avatar photo={photo} name={student ? `${student.prenom} ${student.nom}` : ""} size={76} />
                  <div>
                    <h2>{student?.nom}</h2>
                    <p>{student?.prenom}</p>
                    <dl>
                      <div><dt>Matricule</dt><dd>{student?.matricule ?? "—"}</dd></div>
                      <div><dt>Filière</dt><dd>{inscription ? `${inscription.filiere} · ${inscription.niveau}` : "—"}</dd></div>
                    </dl>
                  </div>
                </div>
                <div className="stu-idcard-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR généré sur l'appareil */}
                  {qr ? <img src={qr} alt="Code QR de la carte d'étudiant" /> : <span className="stu-qr-placeholder" />}
                </div>
                <p className="stu-idcard-valid"><ShieldCheck size={15} aria-hidden="true" /> Valable jusqu&apos;au {shortDate(data.carte.valableJusquau, { day: "numeric", month: "long", year: "numeric" })}</p>
              </article>
              <p className="stu-footnote stu-footnote-center"><Sun size={14} aria-hidden="true" /> Monte la luminosité de ton écran pour le contrôle à l&apos;entrée. La carte reste disponible sans connexion.</p>
            </>
          ) : (
            <div className="stu-info">
              <IdCard size={17} aria-hidden="true" />
              <p>Tu n&apos;as pas encore de carte valable pour {data.anneeScolaire}. Elle sera disponible ici dès que la scolarité l&apos;aura éditée.</p>
            </div>
          )
        }
      </Loaded>
    </div>
  );
}

// ---------- Mot de passe ----------

export function PasswordScreen() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (next.length < 8) return setMessage({ tone: "bad", text: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
    if (next !== confirm) return setMessage({ tone: "bad", text: "Les deux mots de passe ne sont pas identiques." });
    setBusy(true);
    setMessage(null);
    try {
      const result = await studentPost<{ access_token: string }>("/etudiant/moi/mot-de-passe", { motDePasse: current, nouveauMotDePasse: next });
      setStudentToken(result.access_token);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ tone: "ok", text: "Mot de passe changé. Tes autres appareils ont été déconnectés." });
    } catch (failure) {
      setMessage({ tone: "bad", text: failure instanceof Error ? failure.message : "Changement impossible." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stu-screen">
      <ScreenHeader title="Mot de passe" back="/etudiant/profil" />
      <form className="stu-form stu-card" onSubmit={(event) => void submit(event)}>
        <label className="stu-field"><span>Mot de passe actuel</span><input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required /></label>
        <label className="stu-field"><span>Nouveau mot de passe</span><input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <label className="stu-field"><span>Confirme le nouveau mot de passe</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required /></label>
        {message && <p className={message.tone === "ok" ? "stu-form-ok" : "stu-form-error"} role="status">{message.text}</p>}
        <button type="submit" className="stu-button stu-button-primary stu-button-block" disabled={busy}>{busy ? "Un instant…" : "Changer le mot de passe"}</button>
      </form>
    </div>
  );
}
