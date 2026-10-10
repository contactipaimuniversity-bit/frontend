import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Lora, Nunito, Poppins, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import "./design-system.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Polices proposées dans Paramètres → Apparence.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const sourceSans = Source_Sans_3({ variable: "--font-source", subsets: ["latin"] });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IPAIM | Gestion scolaire",
  description: "Tableau de bord de gestion des admissions et inscriptions",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${poppins.variable} ${nunito.variable} ${sourceSans.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
