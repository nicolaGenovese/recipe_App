"use client";

import { useEffect, useRef, useState } from "react";
import { cellLabel } from "@/lib/rota/format";
import { DAY_OFF, HOLIDAY, isInvalidShift, shiftKind } from "@/lib/rota/shifts";
import { useApp } from "@/state/AppProvider";

interface Props {
  value: string;
  label: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}

/** One day of one person: a time range typed by hand, or "day off" / "holiday" picked from the small menu. */
export function ShiftCell({ value, label, readOnly, onChange }: Props) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLTableCellElement>(null);
  const kind = shiftKind(value);
  const labels = { dayOff: t("Riposo"), holiday: t("Ferie") };

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (next: string) => { onChange(next); setOpen(false); };

  return (
    <td ref={box} className={"rota-cell" + (kind === "dayOff" ? " day-off" : kind === "holiday" ? " holiday" : "") + (isInvalidShift(value) ? " invalid" : "")}>
      <input
        className="rota-shift" value={kind === "shift" ? value : cellLabel(value, labels)} placeholder="00:00-00:00" aria-label={label}
        readOnly={readOnly} title={isInvalidShift(value) ? t("Formato non valido: usa 09:00-17:00") : value && kind === "shift" ? value : undefined}
        // Typing into a day-off or holiday cell turns it back into a normal shift.
        onFocus={() => { if (!readOnly && kind !== "shift") onChange(""); }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      />
      {readOnly ? null : (
        <button type="button" className="rota-menu-toggle" aria-haspopup="menu" aria-expanded={open} aria-label={label + ": " + t("riposo o ferie")} onClick={() => setOpen((old) => !old)}>▾</button>
      )}
      {open ? (
        <div className="rota-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => pick(DAY_OFF)}>{labels.dayOff}</button>
          <button type="button" role="menuitem" onClick={() => pick(HOLIDAY)}>{labels.holiday}</button>
          {value ? <button type="button" role="menuitem" onClick={() => pick("")}>{t("Svuota")}</button> : null}
        </div>
      ) : null}
    </td>
  );
}
