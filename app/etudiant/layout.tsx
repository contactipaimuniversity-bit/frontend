import type { Metadata, Viewport } from "next";
import "./etudiant.css";

// Espace étudiant : application installable (PWA), séparée de l'espace de gestion.
export const metadata: Metadata = {
  title: "IPAIM Étudiant",
  description: "Ton espace étudiant IPAIM University : emploi du temps, notes, paiements et carte d'étudiant.",
  manifest: "/etudiant.webmanifest",
  applicationName: "IPAIM Étudiant",
  appleWebApp: { capable: true, title: "IPAIM", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/etudiant/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/etudiant/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/etudiant/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function EtudiantLayout({ children }: { children: React.ReactNode }) {
  return children;
}
