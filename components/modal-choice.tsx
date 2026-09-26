"use client";

import { useEffect, useState } from "react";

type Choice = { value: string; label: string; detail?: string };
type ChoicePage = { choices: Choice[]; hasMore: boolean };

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
  loadChoices?: (query: string, page: number) => Promise<ChoicePage>;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Choice[]>(choices ?? []);
  const [selectedItem, setSelectedItem] = useState<Choice>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selected =
    selectedItem?.value === value
      ? selectedItem
      : (loadChoices ? items : choices ?? []).find((item) => item.value === value);
  const availableItems = loadChoices ? items : choices ?? [];
  const visibleItems = loadChoices
    ? availableItems
    : availableItems.filter((item) =>
        `${item.label} ${item.detail ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      );

  useEffect(() => {
    if (!open) return;
    if (!loadChoices) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void loadChoices(query.trim(), 1)
        .then((loaded) => {
          if (active) {
            setItems(loaded.choices);
            setPage(1);
            setHasMore(loaded.hasMore);
          }
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
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadChoices, open, query]);

  const loadMore = async () => {
    if (!loadChoices || loading || !hasMore) return;
    setLoading(true);
    setError("");
    try {
      const nextPage = page + 1;
      const loaded = await loadChoices(query.trim(), nextPage);
      setItems((current) => [...current, ...loaded.choices]);
      setPage(nextPage);
      setHasMore(loaded.hasMore);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Impossible de charger la suite des options.");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

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
        <div className="modal-backdrop choice-backdrop" onMouseDown={close}>
          <section className="modal choice-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Sélection</p>
                <h3>{label}</h3>
              </div>
              <button className="modal-close" onClick={close}>
                ×
              </button>
            </div>
            <label className="choice-search">
              Rechercher
              <input
                autoFocus
                type="search"
                placeholder={`Rechercher ${label.toLowerCase()}...`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {loading && <p className="empty-state">Chargement...</p>}
            {error && <p className="form-error">{error}</p>}
            {!loading && !error && (
              <div className="choice-list">
                {visibleItems.map((item) => (
                  <button
                    type="button"
                    className={`choice-option ${item.value === value ? "selected" : ""}`}
                    key={item.value}
                    onClick={() => {
                      onChange(item.value);
                      setSelectedItem(item);
                      close();
                    }}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      {item.detail && <small>{item.detail}</small>}
                    </span>
                    {item.value === value && <span>✓</span>}
                  </button>
                ))}
                {!visibleItems.length && <p className="empty-state">Aucune option disponible.</p>}
                {loadChoices && hasMore && <button type="button" className="outline-button small" disabled={loading} onClick={() => void loadMore()}>{loading ? "Chargement..." : "Afficher plus"}</button>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
