"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Copy, Download, EllipsisVertical, ExternalLink, Share, SquarePlus, X } from "lucide-react";
import { InstallGuide, installGuide, isStandalone, openInBrowserLink, setInstallModalOpen, useInstall } from "@/lib/student-install";

const LATER_KEY = "ipaim-etudiant-install-rappel";
// « Plus tard » ne vaut que 10 minutes : la fenêtre revient ensuite, et à
// chaque ouverture ou retour sur la page, tant que l'app n'est pas installée.
const LATER_MS = 10 * 60 * 1000;

function laterUntil() {
  try {
    return Number(window.localStorage.getItem(LATER_KEY)) || 0;
  } catch {
    return 0;
  }
}

function Steps({ guide }: { guide: InstallGuide }) {
  if (guide === "ios-safari")
    return (
      <ol>
        <li>Touche <Share size={15} aria-label="Partager" /> en bas de Safari ;</li>
        <li>choisis <strong>« Sur l&apos;écran d&apos;accueil »</strong> <SquarePlus size={15} aria-hidden="true" /> ;</li>
        <li>touche <strong>Ajouter</strong>, puis ouvre IPAIM depuis l&apos;écran d&apos;accueil.</li>
      </ol>
    );
  if (guide === "ios-other")
    return (
      <ol>
        <li>Touche <Share size={15} aria-label="Partager" /> à côté de la barre d&apos;adresse ;</li>
        <li>choisis <strong>« Sur l&apos;écran d&apos;accueil »</strong> (iOS 16.4 ou plus) ;</li>
        <li>si tu ne le vois pas, ouvre cette page dans <strong>Safari</strong> et recommence.</li>
      </ol>
    );
  if (guide === "in-app")
    return (
      <ol>
        <li>Tu es dans le navigateur de WhatsApp, Facebook ou autre : il ne sait pas installer d&apos;application ;</li>
        <li>touche <EllipsisVertical size={15} aria-label="menu" /> (ou ⋯) et choisis <strong>« Ouvrir dans Chrome »</strong> / « Ouvrir dans le navigateur » ;</li>
        <li>ou copie le lien ci-dessous et colle-le dans Chrome.</li>
      </ol>
    );
  if (guide === "android")
    return (
      <ol>
        <li>Touche le menu <EllipsisVertical size={15} aria-label="⋮" /> en haut à droite de Chrome ;</li>
        <li>choisis <strong>« Installer l&apos;application »</strong>. S&apos;il n&apos;y est pas : <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>, puis <strong>« Installer »</strong> ;</li>
        <li>confirme, puis ouvre IPAIM depuis l&apos;écran d&apos;accueil.</li>
      </ol>
    );
  return (
    <ol>
      <li>Clique sur l&apos;icône d&apos;installation <Download size={15} aria-hidden="true" /> à droite de la barre d&apos;adresse ;</li>
      <li>ou ouvre le menu du navigateur et choisis <strong>« Installer IPAIM Étudiant »</strong>.</li>
    </ol>
  );
}

/**
 * Tant que l'espace étudiant est utilisé dans le navigateur (pas installé),
 * une fenêtre propose de l'installer : d'un bouton quand le navigateur le
 * permet, sinon avec le geste à faire pour ce téléphone et ce navigateur.
 */
export function InstallModal() {
  const install = useInstall(LATER_KEY);
  const [closed, setClosed] = useState(true);
  const [guide, setGuide] = useState<InstallGuide>("desktop");
  const [copied, setCopied] = useState(false);

  // Ouverture, retour sur la page, ou délai écoulé : elle revient si l'app n'est toujours pas installée.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible" && !isStandalone() && laterUntil() <= Date.now()) setClosed(false);
    };
    const first = window.setTimeout(() => {
      setGuide(installGuide());
      recheck();
    }, 600);
    const timer = window.setInterval(recheck, 60_000);
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, []);

  const visible = !closed && !install.installed;
  useEffect(() => {
    setInstallModalOpen(visible);
    return () => setInstallModalOpen(false);
  }, [visible]);

  if (!visible) return null;

  const later = () => {
    try {
      window.localStorage.setItem(LATER_KEY, String(Date.now() + LATER_MS));
    } catch {
      /* rien à retenir */
    }
    setClosed(true);
  };
  const installNow = async () => {
    await install.prompt();
    if (isStandalone()) setClosed(true);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/etudiant`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="stu-modal-backdrop" role="presentation">
      <section className="stu-modal" role="dialog" aria-modal="true" aria-labelledby="stu-install-title">
        <Image className="stu-modal-app-icon" src="/etudiant/icon-192.png" alt="" width={64} height={64} />
        <h2 id="stu-install-title">Installe l&apos;application</h2>
        <p>IPAIM Étudiant s&apos;ouvre alors comme une vraie application, depuis l&apos;écran d&apos;accueil : plus rapide, en plein écran, même sans connexion, et avec les notifications.</p>

        {install.canPrompt ? (
          <button type="button" className="stu-button stu-button-primary stu-button-block" onClick={() => void installNow()}>
            <Download aria-hidden="true" /> Installer maintenant
          </button>
        ) : (
          <div className="stu-modal-steps">
            {guide === "in-app" && openInBrowserLink() && (
              <a className="stu-button stu-button-primary stu-button-block stu-open-browser" href={openInBrowserLink() ?? "#"}>
                <ExternalLink aria-hidden="true" /> Ouvrir dans {/iphone|ipad|ipod/i.test(navigator.userAgent) ? "Safari" : "Chrome"}
              </a>
            )}
            <Steps guide={guide} />
            {guide === "in-app" && (
              <button type="button" className="stu-link" onClick={() => void copy()}>
                <Copy size={14} aria-hidden="true" /> {copied ? "Lien copié" : "Copier le lien"}
              </button>
            )}
          </div>
        )}

        <p className="stu-modal-note">Déjà installée ? Ouvre-la depuis l&apos;icône IPAIM de ton écran d&apos;accueil plutôt que depuis le navigateur.</p>
        <button type="button" className="stu-link stu-modal-later" onClick={later}>Plus tard</button>
      </section>
    </div>
  );
}

/** Rappel discret dans le Profil (la fenêtre reste le moyen principal). */
export function InstallBanner() {
  const install = useInstall();
  if (!install.available || install.dismissed) return null;
  return (
    <aside className="stu-install" aria-label="Installer l'application">
      <Image src="/etudiant/icon-192.png" alt="" width={36} height={36} />
      <div>
        <strong>Installer IPAIM Étudiant</strong>
        {install.canPrompt ? <p>Accès direct depuis l&apos;écran d&apos;accueil, même sans connexion.</p> : <p>Touche <Share size={13} aria-label="Partager" /> puis « Sur l&apos;écran d&apos;accueil ».</p>}
        <div className="stu-install-actions">
          {install.canPrompt && <button type="button" className="stu-button stu-button-primary stu-button-small" onClick={() => void install.prompt()}>Installer</button>}
          <button type="button" className="stu-link" onClick={install.dismiss}>Plus tard</button>
        </div>
      </div>
      <button type="button" className="stu-icon-button stu-install-close" onClick={install.dismiss} aria-label="Fermer"><X size={16} aria-hidden="true" /></button>
    </aside>
  );
}
