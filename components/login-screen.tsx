"use client";

import { FormEvent, useState } from "react";
import { login, notifySessionChanged } from "@/lib/api";
import { enrollOfflineAccount, unlockOfflineAccount } from "@/lib/offline";
import { User } from "@/lib/types";
import { BrandLogo } from "@/components/brand-logo";

export function LoginScreen({
  onLoggedIn,
}: {
  onLoggedIn: (token: string, user: User, offlineReady?: boolean) => void;
}) {
  const [form, setForm] = useState({ email: "", motDePasse: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (!navigator.onLine) {
      try {
        if (!(await openLocalSession(form.email, form.motDePasse, onLoggedIn)))
          setError(offlineLoginUnavailable);
      } catch {
        setError("Le déverrouillage local est indisponible sur cet appareil.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const result = await login(form.email, form.motDePasse);
      const userId = result.utilisateur.id ?? userIdFromToken(result.access_token);
      let offlineReady = false;
      if (userId) {
        try {
          await enrollOfflineAccount(form.email, form.motDePasse, userId, result.utilisateur);
          offlineReady = true;
        } catch {
          offlineReady = false;
        }
      }
      window.sessionStorage.removeItem("ipaim-offline-session");
      window.sessionStorage.setItem("ipaim-token", result.access_token);
      window.sessionStorage.setItem(
        "ipaim-user",
        JSON.stringify(result.utilisateur),
      );
      notifySessionChanged();
      onLoggedIn(result.access_token, result.utilisateur, offlineReady);
    } catch (failure) {
      if (failure instanceof TypeError) {
        try {
          if (await openLocalSession(form.email, form.motDePasse, onLoggedIn)) return;
        } catch {
          setError("Le déverrouillage local est indisponible sur cet appareil.");
          return;
        }
        setError(offlineLoginUnavailable);
      } else {
        setError(failure instanceof Error ? failure.message : "Connexion impossible.");
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-shell">
      <section className="login-art">
        <BrandLogo />
        <p className="eyebrow">
          Institut Polytechnique Africain d&apos;Innovation et de Management
        </p>
        <h1>Chaque dossier mérite un suivi attentif.</h1>
        <p className="login-art-copy">
          Pilotez les admissions, les bourses et les inscriptions depuis un
          espace clair et partagé.
        </p>
        <div className="login-art-footer">
          <span>IPAIM</span>
          <span>Gestion scolaire</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="mobile-brand">
          <BrandLogo compact />
          <strong>IPAIM</strong>
        </div>
        <div className="login-heading">
          <p className="eyebrow">Espace équipe</p>
          <h2>Bienvenue.</h2>
          <p>Connectez-vous pour retrouver votre activité.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            Adresse email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              placeholder="vous@ipaim.edu"
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              required
              value={form.motDePasse}
              onChange={(event) =>
                setForm({ ...form, motDePasse: event.target.value })
              }
              placeholder="Votre mot de passe"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>
            {busy ? "Connexion..." : "Ouvrir mon espace"}
            <span>↗</span>
          </button>
        </form>
        <p className="login-note">Après une première connexion en ligne, une empreinte salée de votre mot de passe permettra le déverrouillage local. Le mot de passe lui-même n’est pas conservé.</p>
        <p className="powered-by">Powered by PEJOSOFT CORPORATION</p>
      </section>
    </main>
  );
}

const offlineLoginUnavailable = "Impossible de vérifier vos identifiants en ligne. Pour ouvrir l’espace hors ligne, connectez-vous d’abord en ligne sur cet appareil et utilisez le même courriel et mot de passe.";

async function openLocalSession(email: string, password: string, onLoggedIn: (token: string, user: User, offlineReady?: boolean) => void) {
  const localAccount = await unlockOfflineAccount(email, password);
  if (!localAccount) return false;
  window.sessionStorage.removeItem("ipaim-token");
  window.sessionStorage.setItem("ipaim-user", JSON.stringify(localAccount.user));
  window.sessionStorage.setItem("ipaim-offline-session", JSON.stringify(localAccount));
  notifySessionChanged();
  onLoggedIn("", localAccount.user, true);
  return true;
}

function userIdFromToken(token: string) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).sub as string | undefined;
  } catch {
    return undefined;
  }
}
