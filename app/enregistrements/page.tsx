import type { Metadata, Viewport } from "next";
import { PublicRegistration } from "@/components/public-registration";
import "./enregistrements.css";

// Page publique, indépendante de l'espace de gestion : aucun compte n'est nécessaire.
export const metadata: Metadata = {
  title: "IPAIM University · Fais-toi connaître",
  description: "Tu es au lycée et l'université t'intéresse ? Laisse-nous tes coordonnées en deux minutes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14285c",
};

export default function Page() {
  return <PublicRegistration />;
}
