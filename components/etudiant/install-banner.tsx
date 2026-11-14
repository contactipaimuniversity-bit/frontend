"use client";

import Image from "next/image";
import { Share, X } from "lucide-react";
import { useInstall } from "@/lib/student-install";

// Proposé à l'entrée (connexion et accueil) tant que l'app n'est pas installée.
// « Plus tard » le masque une semaine ; le Profil garde toujours le bouton.
export function InstallBanner() {
  const install = useInstall();
  if (!install.available || install.dismissed) return null;

  return (
    <aside className="stu-install" aria-label="Installer l'application">
      <Image src="/etudiant/icon-192.png" alt="" width={36} height={36} />
      <div>
        <strong>Installer IPAIM Étudiant</strong>
        {install.canPrompt ? (
          <p>Accès direct depuis l&apos;écran d&apos;accueil, même sans connexion.</p>
        ) : (
          <p>Touche <Share size={13} aria-label="Partager" /> puis « Sur l&apos;écran d&apos;accueil ».</p>
        )}
        <div className="stu-install-actions">
          {install.canPrompt && <button type="button" className="stu-button stu-button-primary stu-button-small" onClick={() => void install.prompt()}>Installer</button>}
          <button type="button" className="stu-link" onClick={install.dismiss}>Plus tard</button>
        </div>
      </div>
      <button type="button" className="stu-icon-button stu-install-close" onClick={install.dismiss} aria-label="Fermer">
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );
}
