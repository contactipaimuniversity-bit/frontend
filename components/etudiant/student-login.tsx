"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn } from "lucide-react";
import { setStudentToken, studentPost } from "@/lib/student-api";

type Mode = "connexion" | "activation";

// Connexion à l'espace étudiant, ou première connexion avec le code remis
// par la scolarité (le même écran sert quand on a oublié son mot de passe).
export function StudentLogin() {
  const [mode, setMode] = useState<Mode>("connexion");
  const [matricule, setMatricule] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "activation") {
      if (password.length < 8) return setError("Ton mot de passe doit contenir au moins 8 caractères.");
      if (password !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
    }
    setBusy(true);
    try {
      const result =
        mode === "connexion"
          ? await studentPost<{ access_token: string }>("/etudiant/auth/connexion", { matricule: matricule.trim(), motDePasse: password }, false)
          : await studentPost<{ access_token: string }>("/etudiant/auth/activation", { matricule: matricule.trim(), code, motDePasse: password }, false);
      setStudentToken(result.access_token);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="stu-login">
      <div className="stu-login-brand">
        <Image src="/etudiant/icon-192.png" alt="IPAIM University" width={84} height={84} priority />
        <p className="stu-eyebrow">IPAIM University</p>
        <h1>{mode === "connexion" ? "Ton espace étudiant" : "Active ton accès"}</h1>
        <p>{mode === "connexion" ? "Emploi du temps, notes, paiements et carte d'étudiant, au même endroit." : "Saisis le code remis par la scolarité, puis choisis ton mot de passe."}</p>
      </div>

      <div className="stu-segmented" role="tablist" aria-label="Type de connexion">
        <button type="button" role="tab" aria-selected={mode === "connexion"} className={mode === "connexion" ? "on" : ""} onClick={() => switchMode("connexion")}>Se connecter</button>
        <button type="button" role="tab" aria-selected={mode === "activation"} className={mode === "activation" ? "on" : ""} onClick={() => switchMode("activation")}>J&apos;ai un code</button>
      </div>

      <form className="stu-form" onSubmit={(event) => void submit(event)}>
        <label className="stu-field">
          <span>Matricule</span>
          <input value={matricule} onChange={(event) => setMatricule(event.target.value.toUpperCase())} autoComplete="username" autoCapitalize="characters" spellCheck={false} placeholder="Ex. 26INF0012" required />
        </label>
        {mode === "activation" && (
          <label className="stu-field">
            <span>Code d&apos;activation</span>
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX" className="stu-code-input" required />
          </label>
        )}
        <label className="stu-field">
          <span>{mode === "connexion" ? "Mot de passe" : "Nouveau mot de passe"}</span>
          <div className="stu-input-with-button">
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "connexion" ? "current-password" : "new-password"} required minLength={mode === "activation" ? 8 : undefined} />
            <button type="button" className="stu-icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </label>
        {mode === "activation" && (
          <label className="stu-field">
            <span>Confirme le mot de passe</span>
            <input type={showPassword ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
          </label>
        )}
        {error && <p className="stu-form-error" role="alert">{error}</p>}
        <button type="submit" className="stu-button stu-button-primary stu-button-block" disabled={busy}>
          {mode === "connexion" ? <LogIn size={18} aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
          {busy ? "Un instant…" : mode === "connexion" ? "Se connecter" : "Activer mon accès"}
        </button>
      </form>

      <p className="stu-login-help">
        {mode === "connexion" ? (
          <>Mot de passe oublié ? Demande un nouveau code à la scolarité, puis choisis <button type="button" className="stu-link" onClick={() => switchMode("activation")}>« J&apos;ai un code »</button>.</>
        ) : (
          <>Pas de code ? Passe à la scolarité avec ta carte ou ton reçu d&apos;inscription.</>
        )}
      </p>
    </main>
  );
}
