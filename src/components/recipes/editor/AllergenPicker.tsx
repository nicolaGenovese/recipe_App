"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/state/AppProvider";

const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

/**
 * Allergens of one ingredient, picked from the kitchen's list in Settings.
 * The value stays a comma-separated text, so old ingredients with allergens outside the list keep them.
 */
export function AllergenPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data, t } = useApp();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const selected = split(value);
  // The settings list first, then anything already on the ingredient that the list does not have.
  const options = Array.from(new Set([...data.settings.allergens, ...selected]));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const toggle = (item: string, on: boolean) => onChange((on ? [...selected, item] : selected.filter((other) => other !== item)).join(", "));

  return (
    <div className="allergen-picker" ref={box}>
      <button type="button" className="allergen-picker-toggle" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((old) => !old)}>
        {selected.length
          ? <span className="allergen-picker-chips">{selected.map((item) => <span key={item} className="allergen-tag">{t(item)}</span>)}</span>
          : <span className="allergen-picker-empty">{t("Nessun allergene: clicca per sceglierli")}</span>}
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="allergen-picker-menu" role="listbox" aria-multiselectable="true" aria-label={t("Allergeni")}>
          {options.map((item) => (
            <label key={item} className={selected.includes(item) ? "checked" : ""}>
              <input type="checkbox" checked={selected.includes(item)} onChange={(event) => toggle(item, event.target.checked)} />
              <span>{t(item)}</span>
            </label>
          ))}
          {options.length ? null : <p className="field-hint">{t("Aggiungi gli allergeni in Impostazioni → Allergeni.")}</p>}
          {selected.length ? <button type="button" className="allergen-picker-clear" onClick={() => onChange("")}>{t("Nessun allergene")}</button> : null}
        </div>
      ) : null}
    </div>
  );
}
