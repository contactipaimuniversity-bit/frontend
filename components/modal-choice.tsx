"use client";

import { useEffect, useState } from "react";

type Choice = { value: string; label: string; detail?: string };

export function ModalChoice({
  label,
  value,
  placeholder,
  choices,
  loadChoices,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  choices?: Choice[];
  loadChoices?: () => Promise<Choice[]>;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Choice[]>(choices ?? []);
  const [loading, setLoading] = useState(Boolean(loadChoices));
  const [error, setError] = useState("");
  const selected = items.find((item) => item.value === value);

  useEffect(() => {
    if (!open || !loadChoices) return;
    let active = true;
    void loadChoices()
      .then((loaded) => {
        if (active) setItems(loaded);
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Impossible de charger les options.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadChoices, open]);

  return (
    <>
      <label>
        {label}
        <button
          type="button"
          className={`choice-trigger ${!selected ? "placeholder" : ""} ${required ? "choice-required" : ""}`}
          onClick={() => setOpen(true)}
        >
          <span>{selected?.label ?? placeholder}</span>
          <span className="choice-trigger-icon">⌄</span>
        </button>
      </label>
      {open && (
        <div className="modal-backdrop choice-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="modal choice-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Sélection</p>
                <h3>{label}</h3>
              </div>
              <button className="modal-close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            {loading && <p className="empty-state">Chargement...</p>}
            {error && <p className="form-error">{error}</p>}
            {!loading && !error && (
              <div className="choice-list">
                {items.map((item) => (
                  <button
                    type="button"
                    className={`choice-option ${item.value === value ? "selected" : ""}`}
                    key={item.value}
                    onClick={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      {item.detail && <small>{item.detail}</small>}
                    </span>
                    {item.value === value && <span>✓</span>}
                  </button>
                ))}
                {!items.length && <p className="empty-state">Aucune option disponible.</p>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
