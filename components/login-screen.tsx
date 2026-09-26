"use client";

import { FormEvent, useState } from "react";
import { login, notifySessionChanged } from "@/lib/api";
import { User } from "@/lib/types";
import { BrandLogo } from "@/components/brand-logo";

export function LoginScreen({
  onLoggedIn,
}: {
  onLoggedIn: (token: string, user: User) => void;
}) {
  const [form, setForm] = useState({ email: "", motDePasse: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await login(form.email, form.motDePasse);
      window.sessionStorage.setItem("ipaim-token", result.access_token);
      window.sessionStorage.setItem(
        "ipaim-user",
        JSON.stringify(result.utilisateur),
      );
      notifySessionChanged();
      onLoggedIn(result.access_token, result.utilisateur);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Connexion impossible.",
      );
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
        <p className="login-note">Accès réservé aux équipes autorisées</p>
        <p className="powered-by">Powered by PEJOSOFT CORPORATION</p>
      </section>
    </main>
  );
}
