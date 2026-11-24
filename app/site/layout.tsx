import type { Metadata, Viewport } from "next";
import { Figtree, Montserrat } from "next/font/google";
import "./site.css";

// Montserrat pour les titres et le texte, Figtree pour le menu et les libellés.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], display: "swap" });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

// Vitrine publique d'IPAIM University, indépendante de l'espace de gestion.
export const metadata: Metadata = {
  title: "IPAIM University · Institut Polytechnique Africain d'Innovation et de Management",
  description: "Établissement privé d'enseignement supérieur à Brazzaville : BTS et Licences en informatique, télécoms, management, droit, logistique et métiers industriels. Bourses d'études et pré-inscription en ligne.",
  applicationName: "IPAIM University",
  openGraph: {
    title: "IPAIM University",
    description: "Innover. Former. Transformer. BTS et Licences professionnalisantes à Brazzaville.",
    type: "website",
    locale: "fr_FR",
    images: [{ url: "/etudiant/icon-512.png", width: 512, height: 512, alt: "IPAIM University" }],
  },
  icons: { icon: "/etudiant/icon-192.png", apple: "/etudiant/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c1b43",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${montserrat.variable} ${figtree.variable}`}>{children}</div>;
}
