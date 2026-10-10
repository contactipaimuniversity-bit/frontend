"use client";

import { PAYMENT_MODE_LABELS } from "@/lib/types";

// Par où l'argent entre ou sort : la comptabilité l'inscrit en caisse, en banque ou en mobile money.
export function PaymentModeSelect({ value, onChange, label = "Mode de paiement" }: { value: string; onChange: (value: string) => void; label?: string }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {Object.entries(PAYMENT_MODE_LABELS).map(([mode, text]) => <option key={mode} value={mode}>{text}</option>)}
      </select>
    </label>
  );
}
