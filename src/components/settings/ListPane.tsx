"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/state/AppProvider";

/** An editable list of labels (categories, allergens, checks…). */
export function ListPane({ title, description, items, onChange }: { title: string; description: string; items: string[]; onChange: (items: string[]) => void }) {
  const { t } = useApp();
  const listRef = useRef<HTMLDivElement>(null);
  const added = useRef(false);

  // A newly added row gets the focus, ready to type.
  useEffect(() => {
    if (!added.current) return;
    added.current = false;
    listRef.current?.querySelector<HTMLInputElement>(".editable-row:last-child input")?.focus();
  }, [items.length]);

  return (
    <section className="settings-pane active">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="editable-list" ref={listRef}>
        {items.map((item, index) => (
          <div key={index} className="editable-row">
            <input value={item} aria-label={title} onChange={(event) => onChange(items.map((old, at) => (at === index ? event.target.value : old)))} />
            <button type="button" aria-label={t("Rimuovi")} onClick={() => onChange(items.filter((_, at) => at !== index))}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="settings-add" onClick={() => { added.current = true; onChange([...items, ""]); }}>{t("+ Aggiungi voce")}</button>
    </section>
  );
}
