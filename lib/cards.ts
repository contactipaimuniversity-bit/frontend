"use client";

import { send } from "@/components/ui-kit";
import { API_URL } from "@/lib/offline";
import { StudentCard, studentCardsPdf } from "@/lib/pdf-docs";
import { logPrint } from "@/lib/print-log";

type IssuedCard = {
  carteId: string;
  jeton: string;
  valableJusquau: string;
  inscriptionId: string;
  personne: { id: string; nom: string; prenom: string; matricule: string; photoUrl?: string | null };
  annee: string;
  filiere: string;
  niveau: string;
};

// Photo d'identité lue via le serveur (avec la session), recadrée au format
// 4:5 et compressée en JPEG pour le PDF. Sans photo, la carte affiche les initiales.
async function cardPhoto(personId: string): Promise<string | null> {
  try {
    const token = window.sessionStorage.getItem("ipaim-token");
    const response = await fetch(`${API_URL}/personnes/${personId}/photo`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 450;
    const ratio = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * ratio;
    const height = bitmap.height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  }
}

/**
 * Édite les cartes d'étudiant : le serveur délivre (ou retrouve) la carte de
 * chaque inscription et son jeton, puis le PDF recto verso est produit ici.
 * « renouveler » remplace la carte : l'ancienne ne passe plus au contrôle.
 */
export async function printStudentCards(inscriptionIds: string[], options: { renouveler?: boolean; fileName: string; libelle: (card: IssuedCard) => string }) {
  const issued = await send<IssuedCard[]>("/cartes", "POST", { inscriptionIds, renouveler: Boolean(options.renouveler) }, true);
  const photos = await Promise.all(issued.map((card) => (card.personne.photoUrl ? cardPhoto(card.personne.id) : Promise.resolve(null))));
  const cards: StudentCard[] = issued.map((card, index) => ({
    carteId: card.carteId,
    jeton: card.jeton,
    nom: card.personne.nom,
    prenom: card.personne.prenom,
    matricule: card.personne.matricule,
    filiere: card.filiere,
    niveau: card.niveau,
    annee: card.annee,
    valableJusquau: card.valableJusquau,
    photo: photos[index],
  }));
  await studentCardsPdf(cards, options.fileName);
  for (const card of issued)
    logPrint({ typeDocument: "CARTE_ETUDIANT", mode: "PDF", dossierType: "inscription", dossierId: card.inscriptionId, libelle: options.libelle(card), reference: `${card.personne.matricule} · ${card.carteId.slice(0, 8).toUpperCase()}` });
  return issued.length;
}
