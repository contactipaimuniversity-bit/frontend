"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { ModalChoice } from "@/components/modal-choice";
import { applyColorMode, applyColorPreset, COLOR_PRESETS, ColorMode, ColorPresetId, readColorMode, readColorPreset, subscribeToColorMode, subscribeToColorPreset } from "@/lib/theme";
import { User } from "@/lib/types";
import { ACCESS_FEATURES, AccessArea, AccessPermission } from "@/lib/access";
import { JobPosition } from "@/lib/types";

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

function PermissionEditor({ permissions, onChange }: { permissions: string[]; onChange: (value: string[]) => void }) {
  const toggle = (area: AccessArea, mode: "view" | "edit", enabled: boolean) => {
    const updated = new Set(permissions);
    const key = `${mode}:${area}` as AccessPermission;
    if (enabled) updated.add(key);
    else updated.delete(key);
    if (mode === "edit" && enabled) updated.add(`view:${area}` as AccessPermission);
    if (mode === "view" && !enabled) updated.delete(`edit:${area}` as AccessPermission);
    onChange([...updated]);
  };
  return (
    <div className="permissions-grid">
      <div className="permission-heading"><span>Fonctionnalité</span><span>Consulter</span><span>Modifier</span></div>
      {ACCESS_FEATURES.map((feature) => (
        <div className="permission-row" key={feature.key}>
          <strong>{feature.label}</strong>
          {(["view", "edit"] as const).map((mode) => (
            <label className="permission-toggle" key={mode}>
              <input type="checkbox" checked={permissions.includes(`${mode}:${feature.key}`)} onChange={(event) => toggle(feature.key, mode, event.target.checked)} />
              <span className="sr-only">{mode === "view" ? "Consulter" : "Modifier"} : {feature.label}</span>
            </label>
          ))}
        </div>
      ))}
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
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const colorPreset = useSyncExternalStore(
    subscribeToColorPreset,
    readColorPreset,
    () => "ipa" as ColorPresetId,
  );
  const colorMode = useSyncExternalStore(subscribeToColorMode, readColorMode, () => "light" as ColorMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [accessUser, setAccessUser] = useState<User | null>(null);
  const [accessForm, setAccessForm] = useState({ posteId: "", permissions: [] as string[] });
  const [positionForm, setPositionForm] = useState({ id: "", nom: "", permissions: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nom: "",
    email: "",
    motDePasse: "",
    role: "employe",
    posteId: "",
  });
  const chooseColorPreset = (id: ColorPresetId) => {
    applyColorPreset(id);
  };
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
  const loadPositions = async () => {
    try {
      setPositions(await apiFetch<JobPosition[]>("/utilisateurs/postes"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Impossible de charger les postes.");
    }
  };
  useEffect(() => {
    let active = true;
    void Promise.all([apiFetch<User[]>("/utilisateurs"), apiFetch<JobPosition[]>("/utilisateurs/postes")])
      .then(([userData, positionData]) => {
        if (active) { setUsers(userData); setPositions(positionData); }
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : "Impossible de charger les paramètres.");
      });
    return () => {
      active = false;
    };
  }, [onRefresh]);
  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/utilisateurs", {
        method: "POST",
        body: JSON.stringify({ ...form, permissions: positions.find((position) => position.id === form.posteId)?.permissions ?? [] }),
      });
      setForm({ nom: "", email: "", motDePasse: "", role: "employe", posteId: "" });
      setModalOpen(false);
      await loadUsers();
      await loadPositions();
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
  const savePosition = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(positionForm.id ? `/utilisateurs/postes/${positionForm.id}` : "/utilisateurs/postes", {
        method: positionForm.id ? "PATCH" : "POST",
        body: JSON.stringify({ nom: positionForm.nom, permissions: positionForm.permissions }),
      });
      setPositionModalOpen(false);
      await loadPositions();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Enregistrement du poste impossible.");
    } finally {
      setBusy(false);
    }
  };
  const saveUserAccess = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessUser?.id) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/utilisateurs/${accessUser.id}/acces`, {
        method: "PATCH",
        body: JSON.stringify({ posteId: accessForm.posteId || null, permissions: accessForm.permissions }),
      });
      setAccessUser(null);
      await loadUsers();
      onRefresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Modification des accès impossible.");
    } finally {
      setBusy(false);
    }
  };
  const removeUser = async (id: string) => {
    if (id === currentUser?.id) return;
    const motif = window.prompt("Motif de suppression (5 caractères minimum)")?.trim();
    if (!motif) return;
    if (motif.length < 5) {
      setError("Le motif doit contenir au moins 5 caractères.");
      return;
    }
    if (!window.confirm("Déplacer cet utilisateur vers la corbeille ?")) return;
    setError("");
    try {
      await apiFetch(`/utilisateurs/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ motif }),
      });
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
        <div className="form-actions">
          <button className="outline-button small" onClick={() => { setPositionForm({ id: "", nom: "", permissions: [] }); setPositionModalOpen(true); }}>+ Nouveau poste</button>
          <button className="primary-button compact" onClick={() => setModalOpen(true)}>+ Nouvel utilisateur</button>
        </div>
      </div>
      {error && <div className="api-error">{error}</div>}
      <section className="panel full-panel color-settings-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Apparence</p>
            <h3>Couleurs de l’interface</h3>
          </div>
        </div>
        <div className="appearance-mode-row">
          <div><p className="eyebrow">Affichage du contenu</p><strong>{colorMode === "dark" ? "Mode sombre" : "Mode clair"}</strong></div>
          <div className="appearance-mode-control">
            <span>Clair</span>
            <input className="appearance-mode-slider" type="range" min="0" max="1" step="1" value={colorMode === "dark" ? 1 : 0} aria-label="Basculer entre le mode clair et le mode sombre" aria-valuetext={colorMode === "dark" ? "Mode sombre" : "Mode clair"} onChange={(event) => applyColorMode(Number(event.target.value) === 1 ? "dark" : "light")} />
            <span>Sombre</span>
          </div>
        </div>
        <div className="color-preset-grid" role="radiogroup" aria-label="Préréglages de couleurs">
          {COLOR_PRESETS.map((preset) => (
            <button
              type="button"
              role="radio"
              aria-checked={colorPreset === preset.id}
              className={`color-preset-option ${colorPreset === preset.id ? "selected" : ""}`}
              key={preset.id}
              onClick={() => chooseColorPreset(preset.id)}
            >
              <span className="color-preset-swatches" aria-hidden="true">
                {preset.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
              </span>
              <strong>{preset.label}</strong>
              <span className="color-preset-selection" aria-hidden="true">{colorPreset === preset.id ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Postes métiers</p>
            <h3>Postes et accès par défaut</h3>
          </div>
        </div>
        <div className="position-list">
          {positions.map((position) => (
            <div className="position-row" key={position.id}>
              <div><strong>{position.nom}</strong><span>{position._count?.utilisateurs ?? 0} utilisateur(s) · {position.permissions.filter((permission) => permission.startsWith("view:")).length} page(s) consultable(s)</span></div>
              <button className="outline-button small" onClick={() => { setPositionForm({ id: position.id, nom: position.nom, permissions: [...position.permissions] }); setPositionModalOpen(true); }}>Modifier</button>
            </div>
          ))}
          {!positions.length && <p className="empty-state">Aucun poste métier créé.</p>}
        </div>
      </section>
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
                <th>Poste</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td className="strong-cell">{item.nom}</td>
                  <td>{item.email}</td>
                  <td>
                    <span className="status status-complete">{item.role === "admin" ? "Administrateur" : "Employé"}</span>
                  </td>
                  <td>
                    {item.poste?.nom ?? "—"}
                  </td>
                  <td className="user-access-actions">
                    {item.role !== "admin" && <button className="outline-button small" onClick={() => { setAccessUser(item); setAccessForm({ posteId: item.posteId ?? "", permissions: [...(item.permissions ?? [])] }); }}>Accès</button>}
                    {item.id === currentUser?.id ? <span className="muted-action">Session actuelle</span> : <button className="danger-button" onClick={() => void removeUser(item.id ?? "")}>Supprimer</button>}
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={5} className="empty-state">
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
            <form className="entity-form" onSubmit={createUser}>
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
              <ModalChoice label="Rôle" placeholder="Sélectionner un rôle" value={form.role} choices={[{ value: "employe", label: "Employé" }, { value: "admin", label: "Administrateur" }]} onChange={(role) => setForm({ ...form, role, posteId: role === "admin" ? "" : form.posteId })} />
              {form.role !== "admin" && <label>Poste métier<select value={form.posteId} onChange={(event) => setForm({ ...form, posteId: event.target.value })}><option value="">Aucun poste</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.nom}</option>)}</select></label>}
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
      {positionModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setPositionModalOpen(false)}>
          <section className="modal permission-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><h3>{positionForm.id ? "Modifier le poste" : "Créer un poste métier"}</h3><button className="modal-close" onClick={() => setPositionModalOpen(false)}>×</button></div>
            <form className="entity-form" onSubmit={savePosition}>
              <label>Nom du poste<input required value={positionForm.nom} onChange={(event) => setPositionForm({ ...positionForm, nom: event.target.value })} placeholder="Ex. Gestionnaire des inscriptions" /></label>
              <PermissionEditor permissions={positionForm.permissions} onChange={(permissions) => setPositionForm({ ...positionForm, permissions })} />
              {error && <p className="form-error">{error}</p>}
              <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setPositionModalOpen(false)}>Annuler</button><button className="primary-button compact" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer le poste"}</button></div>
            </form>
          </section>
        </div>
      )}
      {accessUser && (
        <div className="modal-backdrop" onMouseDown={() => setAccessUser(null)}>
          <section className="modal permission-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><h3>Accès de {accessUser.prenom ? `${accessUser.prenom} ` : ""}{accessUser.nom}</h3><button className="modal-close" onClick={() => setAccessUser(null)}>×</button></div>
            <form className="entity-form" onSubmit={saveUserAccess}>
              <label>Poste métier<select value={accessForm.posteId} onChange={(event) => { const posteId = event.target.value; const position = positions.find((item) => item.id === posteId); setAccessForm({ posteId, permissions: [...(position?.permissions ?? [])] }); }}><option value="">Aucun poste</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.nom}</option>)}</select></label>
              <PermissionEditor permissions={accessForm.permissions} onChange={(permissions) => setAccessForm({ ...accessForm, permissions })} />
              {error && <p className="form-error">{error}</p>}
              <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setAccessUser(null)}>Annuler</button><button className="primary-button compact" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer les accès"}</button></div>
            </form>
          </section>
        </div>
      )}
      <p className="powered-by settings-credit">Powered by PEJOSOFT CORPORATION</p>
    </div>
  );
}
