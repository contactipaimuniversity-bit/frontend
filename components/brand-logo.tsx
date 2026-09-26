import Image from "next/image";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <Image className={compact ? "brand-logo brand-logo-compact" : "brand-logo"} src="/WhatsApp Image 2026-07-17 at 18.26.50.jpeg" alt="IPAIM University" width={compact ? 46 : 220} height={compact ? 46 : 220} priority />;
}
