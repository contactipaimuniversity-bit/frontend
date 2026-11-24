"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Download, MonitorSmartphone, Share, SquarePlus, WifiOff, Zap } from "lucide-react";
import { useInstall } from "@/lib/student-install";

// Installer l'espace de gestion comme une application (PWA).
// Chrome et Edge (ordinateur, Android) savent l'installer d'un clic ; sur iPhone
// et iPad, Safari demande un geste qu'on explique. « Plus tard » ne repropose
// rien pendant une semaine ; le menu garde toujours le bouton « Installer ».
const DISMISS_KEY = "ipaim-gestion-install-plus-tard";
const OPEN_EVENT = "ipaim-install-open";
const DELAY_MS = 4000;

export function InstallAppModal() {
  const install = useInstall(DISMISS_KEY);
  const [forced, setForced] = useState(false);
  const [ready, setReady] = useState(false);

  // Proposé quelques secondes après l'arrivée, et seulement quand aucune autre
  // fenêtre n'est ouverte (bienvenue, confirmation, saisie en cours...).
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.querySelector(".modal-backdrop")) return;
      setReady(true);
      window.clearInterval(timer);
    }, DELAY_MS);
    const open = () => setForced(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(OPEN_EVENT, open);
    };
  }, []);

  const open = install.available && (forced || (ready && !install.dismissed));
  if (!open) return null;
  const close = () => {
    setForced(false);
    install.dismiss();
  };
  const installNow = async () => {
    await install.prompt();
    setForced(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section className="modal install-app-modal" role="dialog" aria-modal="true" aria-labelledby="install-app-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="install-app-head">
          <Image src="/etudiant/icon-192.png" alt="" width={64} height={64} />
          <div>
            <p className="eyebrow">Application IPAIM</p>
            <h3 id="install-app-title">Installer IPAIM sur cet appareil</h3>
          </div>
        </div>
        <ul className="install-app-points">
          <li><MonitorSmartphone size={18} aria-hidden="true" /> <span>Une icône sur le bureau ou l&apos;écran d&apos;accueil, et une fenêtre à part, sans barre d&apos;adresse.</span></li>
          <li><Zap size={18} aria-hidden="true" /> <span>Ouverture immédiate, comme un logiciel.</span></li>
          <li><WifiOff size={18} aria-hidden="true" /> <span>Vos dossiers restent consultables sans connexion, et vos saisies partent au retour du réseau.</span></li>
        </ul>
        {install.canPrompt ? (
          <p className="install-app-note">Rien à télécharger depuis un site : votre navigateur installe l&apos;application lui-même, et vous pourrez la désinstaller à tout moment.</p>
        ) : (
          <ol className="install-app-steps">
            <li>Dans Safari, touchez <Share size={15} aria-label="Partager" /> <strong>Partager</strong>, en bas de l&apos;écran.</li>
            <li>Choisissez <SquarePlus size={15} aria-hidden="true" /> <strong>Sur l&apos;écran d&apos;accueil</strong>.</li>
            <li>Touchez <strong>Ajouter</strong> : l&apos;icône IPAIM apparaît sur votre écran d&apos;accueil.</li>
          </ol>
        )}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={close}>{install.canPrompt ? "Plus tard" : "J'ai compris"}</button>
          {install.canPrompt && <button type="button" className="primary-button" onClick={() => void installNow()}><Download size={16} aria-hidden="true" /> Installer l&apos;application</button>}
        </div>
      </section>
    </div>
  );
}

// Entrée du menu, tant que l'application n'est pas installée sur cet appareil.
export function InstallAppButton({ onDone }: { onDone?: () => void }) {
  const install = useInstall(DISMISS_KEY);
  if (!install.available) return null;
  return (
    <button
      type="button"
      title="Installer l'application sur cet appareil"
      className="nav-item"
      onClick={() => {
        onDone?.();
        window.dispatchEvent(new Event(OPEN_EVENT));
      }}
    >
      <span className="nav-icon"><Download size={19} strokeWidth={1.7} aria-hidden="true" focusable="false" /></span>
      <span className="nav-text">Installer l&apos;application</span>
    </button>
  );
}
