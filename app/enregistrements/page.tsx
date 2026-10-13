import type { Metadata, Viewport } from "next";
import { PublicRegistration } from "@/components/public-registration";
import "./enregistrements.css";

// Page publique, indépendante de l'espace de gestion : aucun compte n'est nécessaire.
export const metadata: Metadata = {
  title: "IPAIM University · Fais-toi connaître",
  description: "Tu es au lycée et l'université t'intéresse ? Laisse-nous tes coordonnées en deux minutes.",
};

// Échelle fixe : la page ne zoome pas toute seule quand on touche un champ, et
// garde la même taille tout au long du formulaire.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function Page() {
  return <PublicRegistration />;
}
