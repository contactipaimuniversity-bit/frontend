"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/connectivity";

type Question = { id: string; question: string; reponse: string };

// Questions fréquentes publiées depuis l'administration.
export function SiteFaq() {
  const [items, setItems] = useState<Question[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/vitrine/questions`)
      .then((response) => (response.ok ? response.json() : []))
      .then((list: Question[]) => active && setItems(Array.isArray(list) ? list : []))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);

  if (items === null) return <div className="news-loading" aria-hidden="true" />;
  if (!items.length) return <p className="muted">Une question ? Le service d&apos;information vous répond au +242 06 400 04 71.</p>;
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.id}>
          <summary>{item.question}</summary>
          {item.reponse.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </details>
      ))}
    </div>
  );
}
