"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, UserRound } from "lucide-react";
import { askConfirm, toast } from "@/components/feedback";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/offline";
import { Person, User } from "@/lib/types";

const PHOTO_MAX_SIDE = 900;
const messageOf = (failure: unknown, fallback: string) => (failure instanceof Error ? failure.message : fallback);

// Réduit la photo avant l'envoi : une prise de vue de téléphone pèse plusieurs Mo.
export async function preparePhoto(source: Blob): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new Error("Ce fichier n'est pas une image lisible (JPG, PNG ou WEBP).");
  }
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("La photo n'a pas pu être préparée.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export function uploadPersonPhoto(personId: string, photo: File) {
  const form = new FormData();
  form.append("photo", photo);
  return apiFetch<Person>(`/personnes/${personId}/photo`, { method: "POST", body: form, silent: true });
}

// Joint la photo après l'enregistrement d'un dossier, sans jamais remettre en cause ce dernier.
// Hors ligne, la photo est mise en file derrière le dossier et part avec lui au retour du serveur.
export async function attachPhotoAfterSave(personId: string | undefined, photo: File | null) {
  if (!photo) return;
  if (!personId) {
    toast("Dossier enregistré sans la photo. Ajoutez-la depuis la fiche du dossier.", "info");
    return;
  }
  try {
    await uploadPersonPhoto(personId, photo);
  } catch (failure) {
    toast(`Dossier enregistré, mais la photo n'a pas été envoyée : ${messageOf(failure, "erreur inconnue")} Ajoutez-la depuis la fiche du dossier.`, "error");
  }
}

function LiveCamera({ onCapture, onCancel }: { onCapture: (shot: Blob) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((opened) => {
        if (!active || !video.current) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        video.current.srcObject = opened;
        void video.current.play().then(() => { if (active) setReady(true); });
      })
      .catch(() => {
        if (active) setError("La caméra est indisponible ou son accès a été refusé. Autorisez la caméra dans le navigateur, ou utilisez « Galerie / Parcourir ».");
      });
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const capture = () => {
    const element = video.current;
    if (!element?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    canvas.toBlob((shot) => { if (shot) onCapture(shot); }, "image/jpeg", 0.92);
  };
  return (
    <div className="photo-camera">
      {error ? <p className="form-error" role="alert">{error}</p> : <video ref={video} playsInline muted aria-label="Aperçu de la caméra" />}
      <div className="photo-actions">
        {!error && <button type="button" className="primary-button compact" disabled={!ready} onClick={capture}>{ready ? "Prendre la photo" : "Ouverture de la caméra..."}</button>}
        <button type="button" className="secondary-button" onClick={onCancel}>{error ? "Fermer" : "Annuler"}</button>
      </div>
    </div>
  );
}

type PhotoOwner = Pick<Person, "id" | "photoUrl">;

// La photo enregistrée est lue via le serveur, avec la session : l'hébergeur
// de fichiers ne la diffuse pas publiquement.
function useStoredPhoto(owner?: PhotoOwner | null, resource: "personnes" | "utilisateurs" = "personnes") {
  const personId = owner?.photoUrl ? owner.id : null;
  // Change à chaque nouvelle photo, pour ne pas réafficher l'ancienne depuis le cache.
  const version = owner?.photoUrl?.split("/").pop() ?? "";
  const key = personId ? `${personId}/${version}` : null;
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!personId) return;
    let active = true;
    let objectUrl: string | null = null;
    const token = window.sessionStorage.getItem("ipaim-token");
    fetch(`${API_URL}/${resource}/${personId}/photo?v=${encodeURIComponent(version)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error("Photo indisponible"))))
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key: `${personId}/${version}`, url: objectUrl });
      })
      // Hors ligne ou photo illisible : l'emplacement reste vide.
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [personId, resource, version]);
  return loaded && loaded.key === key ? loaded.url : null;
}

// Pastille ronde d'un utilisateur : sa photo de profil, ou une silhouette s'il n'en a pas.
export function UserAvatar({ user, className = "avatar" }: { user: User | null; className?: string }) {
  const photo = useStoredPhoto(user?.id ? { id: user.id, photoUrl: user.photoUrl } : null, "utilisateurs");
  return (
    <span className={`${className} user-avatar`}>
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt="" />
        : <UserRound aria-hidden="true" focusable="false" strokeWidth={1.6} />}
    </span>
  );
}

export function PhotoFrame({ url, owner, alt }: { url?: string | null; owner?: PhotoOwner | null; alt: string }) {
  const stored = useStoredPhoto(url ? null : owner);
  const source = url ?? stored;
  return (
    <span className="photo-frame">
      {/* Aperçu local ou image relue via le serveur (blob:) : next/image n'apporterait rien. */}
      {source
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={source} alt={alt} />
        : <UserRound aria-hidden="true" focusable="false" strokeWidth={1.3} />}
    </span>
  );
}

// Les deux façons de fournir une photo : la caméra de l'appareil ou un fichier existant.
function PhotoSources({ busy, hasPhoto, onPicked, onRemove, onError }: { busy: boolean; hasPhoto: boolean; onPicked: (photo: File) => void; onRemove?: () => void; onError: (message: string) => void }) {
  const [camera, setCamera] = useState(false);
  const gallery = useRef<HTMLInputElement>(null);
  const nativeCamera = useRef<HTMLInputElement>(null);
  const accept = async (source: Blob | undefined) => {
    if (!source) return;
    onError("");
    try {
      onPicked(await preparePhoto(source));
    } catch (failure) {
      onError(messageOf(failure, "Photo illisible."));
    }
  };
  const fromInput = (event: ChangeEvent<HTMLInputElement>) => {
    void accept(event.target.files?.[0]);
    event.target.value = "";
  };
  const openCamera = () => {
    onError("");
    // Sans accès direct à la caméra (page non sécurisée, ancien navigateur),
    // on laisse le téléphone ouvrir son propre appareil photo.
    if (typeof navigator.mediaDevices?.getUserMedia === "function") setCamera(true);
    else nativeCamera.current?.click();
  };
  if (camera) return <LiveCamera onCancel={() => setCamera(false)} onCapture={(shot) => { setCamera(false); void accept(shot); }} />;
  return (
    <div className="photo-actions">
      <button type="button" className="outline-button small" disabled={busy} onClick={openCamera}><Camera size={15} aria-hidden="true" focusable="false" /> Ouvrir la caméra</button>
      <button type="button" className="outline-button small" disabled={busy} onClick={() => gallery.current?.click()}><ImagePlus size={15} aria-hidden="true" focusable="false" /> Galerie / Parcourir</button>
      {hasPhoto && onRemove && <button type="button" className="row-action danger-row-action" disabled={busy} onClick={onRemove}><Trash2 size={14} aria-hidden="true" focusable="false" /> Retirer</button>}
      <input ref={gallery} hidden type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} onChange={fromInput} />
      <input ref={nativeCamera} hidden type="file" accept="image/*" capture="user" tabIndex={-1} onChange={fromInput} />
    </div>
  );
}

// Champ facultatif d'un formulaire : la photo choisie n'est envoyée qu'après l'enregistrement du dossier.
export function PhotoField({ value, onChange, current }: { value: File | null; onChange: (photo: File | null) => void; current?: PhotoOwner | null }) {
  const [error, setError] = useState("");
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <section className="photo-field">
      <PhotoFrame url={preview} owner={current} alt="Photo de l'étudiant" />
      <div className="photo-field-body">
        <p className="eyebrow">Photo de l&apos;étudiant (facultatif)</p>
        <p className="panel-subtitle">{value ? "Photo prête : elle sera jointe à l'enregistrement." : current?.photoUrl ? "Cette personne a déjà une photo. Vous pouvez la remplacer." : "Prenez la photo avec la caméra ou choisissez une image. Vous pouvez aussi l'ajouter plus tard."}</p>
        <PhotoSources busy={false} hasPhoto={Boolean(value)} onPicked={onChange} onRemove={() => onChange(null)} onError={setError} />
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

// Photo de profil du compte connecté : chacun ajoute, remplace ou retire la sienne.
export function ProfilePhotoCard({ user, onUpdated }: { user: User | null; onUpdated: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<User>, done: string) => {
    setBusy(true);
    setError("");
    try {
      onUpdated(await action());
      toast(done);
    } catch (failure) {
      setError(messageOf(failure, "La photo n'a pas pu être mise à jour."));
    } finally {
      setBusy(false);
    }
  };
  const upload = (photo: File) => {
    const form = new FormData();
    form.append("photo", photo);
    void run(() => apiFetch<User>("/utilisateurs/me/photo", { method: "POST", body: form, silent: true }), "Photo de profil enregistrée.");
  };
  const remove = async () => {
    if (!(await askConfirm({ title: "Retirer la photo de profil ?", message: "Une silhouette la remplacera.", confirmLabel: "Retirer", danger: true }))) return;
    void run(() => apiFetch<User>("/utilisateurs/me/photo", { method: "DELETE", silent: true }), "Photo de profil retirée.");
  };
  return (
    <div className="profile-photo">
      <UserAvatar user={user} className="profile-photo-preview" />
      <div className="profile-photo-body">
        <p className="panel-subtitle">{busy ? "Envoi en cours..." : user?.photoUrl ? "Elle apparaît à côté de votre nom dans le menu." : "Aucune photo : une silhouette s'affiche à côté de votre nom."}</p>
        <PhotoSources busy={busy} hasPhoto={Boolean(user?.photoUrl)} onPicked={upload} onRemove={() => void remove()} onError={setError} />
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

// Emplacement de la photo sur la fiche d'un dossier : affichage, ajout, remplacement, retrait.
export function PersonPhotoCard({ person, onChanged }: { person: Person; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      toast(done);
      onChanged();
    } catch (failure) {
      setError(messageOf(failure, "La photo n'a pas pu être mise à jour."));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await askConfirm({ title: "Retirer la photo ?", message: "La photo sera retirée de la fiche de cette personne. Le dossier lui-même n'est pas modifié.", confirmLabel: "Retirer", danger: true }))) return;
    void run(() => apiFetch(`/personnes/${person.id}/photo`, { method: "DELETE", silent: true }), "Photo retirée.");
  };
  return (
    <div className="photo-card">
      <PhotoFrame owner={person} alt={`Photo de ${person.prenom} ${person.nom}`} />
      {!person.photoUrl && <small className="photo-card-note">Aucune photo</small>}
      {busy && <small className="photo-card-note">Envoi en cours...</small>}
      <PhotoSources busy={busy} hasPhoto={Boolean(person.photoUrl)} onPicked={(photo) => void run(() => uploadPersonPhoto(person.id, photo), "Photo enregistrée.")} onRemove={() => void remove()} onError={setError} />
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
