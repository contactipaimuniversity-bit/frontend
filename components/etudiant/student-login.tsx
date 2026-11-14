"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
      if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
      if (password !== confirm) return setError("Les deux mots de passe sont différents.");
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
      <div className="stu-login-top">
        <Image src="/etudiant/icon-192.png" alt="IPAIM University" width={32} height={32} priority />
      </div>

      <div className="stu-login-body">
        <h1>Espace <em>étudiant</em>.</h1>
        <p className="stu-lead">{mode === "connexion" ? "Connecte-toi avec ton matricule." : "Saisis le code remis par la scolarité, puis choisis ton mot de passe."}</p>

        <div className="stu-segmented" role="tablist" aria-label="Type de connexion">
          <button type="button" role="tab" aria-selected={mode === "connexion"} className={mode === "connexion" ? "on" : ""} onClick={() => switchMode("connexion")}>Connexion</button>
          <button type="button" role="tab" aria-selected={mode === "activation"} className={mode === "activation" ? "on" : ""} onClick={() => switchMode("activation")}>J&apos;ai un code</button>
        </div>

        <form className="stu-form" onSubmit={(event) => void submit(event)} style={{ marginTop: 24 }}>
          <div className="stu-box">
            <label className="stu-field">
              <span>Matricule</span>
              <input value={matricule} onChange={(event) => setMatricule(event.target.value.toUpperCase())} autoComplete="username" autoCapitalize="characters" spellCheck={false} placeholder="26INF0012" required />
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
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </label>
            {mode === "activation" && (
              <label className="stu-field">
                <span>Confirmation</span>
                <input type={showPassword ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />
              </label>
            )}
          </div>
          {error && <p className="stu-form-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
          <div className="stu-form-actions">
            <button type="submit" className="stu-button stu-button-primary" disabled={busy}>
              {busy ? "Un instant…" : mode === "connexion" ? "Se connecter" : "Activer mon accès"}
            </button>
          </div>
        </form>

        <p className="stu-login-help">
          {mode === "connexion" ? (
            <>Première connexion ou mot de passe oublié : demande un code à la scolarité, puis choisis <button type="button" className="stu-link" onClick={() => switchMode("activation")}>J&apos;ai un code</button>.</>
          ) : (
            <>Pas de code ? Adresse-toi à la scolarité.</>
          )}
        </p>
      </div>

      <p className="stu-login-foot">IPAIM University · {new Date().getFullYear()}</p>
    </main>
  );
}
