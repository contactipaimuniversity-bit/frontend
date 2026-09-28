"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ModalChoice } from "@/components/modal-choice";
import { User } from "@/lib/types";

export function ProfilePage({
  user,
  onLogout,
  onUpdated,
}: {
  user: User | null;
  onLogout: () => void;
  onUpdated: (user: User) => void;
}) {
  const [form, setForm] = useState({ nom: user?.nom ?? "", prenom: user?.prenom ?? "", email: user?.email ?? "", ancienMotDePasse: "", nouveauMotDePasse: "", confirmationMotDePasse: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.nouveauMotDePasse && form.nouveauMotDePasse !== form.confirmationMotDePasse) {
      setError("La confirmation du nouveau mot de passe ne correspond pas.");
      return;
    }
    setBusy(true);
    try {
      const updated = await apiFetch<User>("/utilisateurs/me", { method: "PATCH", body: JSON.stringify({ nom: form.nom, prenom: form.prenom, email: form.email, ancienMotDePasse: form.ancienMotDePasse || undefined, nouveauMotDePasse: form.nouveauMotDePasse || undefined }) });
      onUpdated(updated);
      setForm({ ...form, ancienMotDePasse: "", nouveauMotDePasse: "", confirmationMotDePasse: "" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Modification impossible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="content-scroll">
      <section className="account-hero">
        <div className="account-avatar">{user?.nom?.slice(0, 1) ?? "A"}</div>
        <div>
          <p className="eyebrow">Compte connecté</p>
          <h2>{user ? `${user.prenom ? `${user.prenom} ` : ""}${user.nom}` : "Administrateur"}</h2>
          <p>
            {user?.role ?? "Equipe"} · {user?.email}
          </p>
        </div>
      </section>
      <section className="account-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Informations personnelles</p>
              <h3>Votre profil</h3>
            </div>
          </div>
          <form className="entity-form profile-form" onSubmit={submit}>
            <div className="form-grid"><label>Nom<input required value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} /></label><label>Prénom<input value={form.prenom} onChange={(event) => setForm({ ...form, prenom: event.target.value })} /></label></div>
            <label>Adresse email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <p className="eyebrow form-section-label">Changer le mot de passe</p>
            <label>Ancien mot de passe<input type="password" value={form.ancienMotDePasse} onChange={(event) => setForm({ ...form, ancienMotDePasse: event.target.value })} /></label>
            <div className="form-grid"><label>Nouveau mot de passe<input minLength={8} type="password" value={form.nouveauMotDePasse} onChange={(event) => setForm({ ...form, nouveauMotDePasse: event.target.value })} /></label><label>Confirmation<input minLength={8} type="password" value={form.confirmationMotDePasse} onChange={(event) => setForm({ ...form, confirmationMotDePasse: event.target.value })} /></label></div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions"><button className="primary-button compact" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer les modifications"}</button></div>
          </form>
          <dl className="profile-details">
            <div>
              <dt>Adresse email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Rôle</dt>
              <dd>
                <span className="status status-complete">{user?.role}</span>
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel account-action-panel">
          <p className="eyebrow">Session</p>
          <h3>Accès sécurisé</h3>
          <p>Vous êtes connecté à l’espace de gestion IPAIM.</p>
          <button className="secondary-button" onClick={onLogout}>
            Se déconnecter
          </button>
        </article>
      </section>
    </div>
  );
}

export function SettingsPage({
  currentUser,
  onRefresh,
}: {
  currentUser: User | null;
  onRefresh: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nom: "",
    email: "",
    motDePasse: "",
    role: "admin",
  });
  const loadUsers = async () => {
    try {
      setUsers(await apiFetch<User[]>("/utilisateurs"));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Impossible de charger les administrateurs.",
      );
    }
  };
  useEffect(() => {
    let active = true;
    void apiFetch<User[]>("/utilisateurs")
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Impossible de charger les administrateurs.",
          );
      });
    return () => {
      active = false;
    };
  }, [onRefresh]);
  const createAdmin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/utilisateurs", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ nom: "", email: "", motDePasse: "", role: "admin" });
      setModalOpen(false);
      await loadUsers();
      onRefresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Impossible de créer l’administrateur.",
      );
    } finally {
      setBusy(false);
    }
  };
  const removeUser = async (id: string) => {
    if (
      id === currentUser?.id ||
      !window.confirm("Supprimer cet utilisateur ?")
    )
      return;
    setError("");
    try {
      await apiFetch(`/utilisateurs/${id}`, { method: "DELETE" });
      await loadUsers();
      onRefresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Suppression impossible.",
      );
    }
  };
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Administration</p>
          <h2>Paramètres</h2>
          <p>Gérez les accès à l’espace de gestion.</p>
        </div>
        <button
          className="primary-button compact"
          onClick={() => setModalOpen(true)}
        >
          + Nouvel administrateur
        </button>
      </div>
      {error && <div className="api-error">{error}</div>}
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Utilisateurs autorisés</p>
            <h3>Administrateurs et équipe</h3>
          </div>
          <button
            className="outline-button small"
            onClick={() => void loadUsers()}
          >
            Actualiser
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td className="strong-cell">{item.nom}</td>
                  <td>{item.email}</td>
                  <td>
                    <span className="status status-complete">{item.role}</span>
                  </td>
                  <td>
                    {item.id === currentUser?.id ? (
                      <span className="muted-action">Session actuelle</span>
                    ) : (
                      <button
                        className="danger-button"
                        onClick={() => void removeUser(item.id ?? "")}
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    Aucun utilisateur chargé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <section
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Créer un administrateur</h3>
              <button
                className="modal-close"
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="entity-form" onSubmit={createAdmin}>
              <label>
                Nom
                <input
                  required
                  value={form.nom}
                  onChange={(event) =>
                    setForm({ ...form, nom: event.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </label>
              <label>
                Mot de passe
                <input
                  required
                  minLength={8}
                  type="password"
                  value={form.motDePasse}
                  onChange={(event) =>
                    setForm({ ...form, motDePasse: event.target.value })
                  }
                />
              </label>
              <ModalChoice
                label="Rôle"
                placeholder="Sélectionner un rôle"
                value={form.role}
                choices={[{ value: "admin", label: "Administrateur" }, { value: "staff", label: "Équipe" }]}
                onChange={(value) => setForm({ ...form, role: value })}
              />
              {error && <p className="form-error">{error}</p>}
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalOpen(false)}
                >
                  Annuler
                </button>
                <button className="primary-button compact" disabled={busy}>
                  {busy ? "Création..." : "Créer l’utilisateur"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <p className="powered-by settings-credit">Powered by PEJOSOFT CORPORATION</p>
    </div>
  );
}
