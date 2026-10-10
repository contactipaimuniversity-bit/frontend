"use client";

import { DateOrder } from "@/lib/types";

export function DateOrderControl({
  value,
  onChange,
}: {
  value: DateOrder;
  onChange: (value: DateOrder) => void;
}) {
  return (
    <label className="date-order-control">
      Trier par date
      <select
        aria-label="Ordre chronologique"
        value={value}
        onChange={(event) => onChange(event.target.value as DateOrder)}
      >
        <option value="desc">Plus récent</option>
        <option value="asc">Plus ancien</option>
      </select>
    </label>
  );
}