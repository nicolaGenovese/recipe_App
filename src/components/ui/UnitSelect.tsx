"use client";

import { UNIT_CATALOG } from "@/lib/stock/units";
import { useApp } from "@/state/AppProvider";

/**
 * A unit picked from the units chosen in Settings → General.
 * A value saved before (or set by a linked product) stays in the list even if the kitchen no longer offers it.
 */
export function UnitSelect({ value, onChange, id, label, className }: { value: string; onChange: (value: string) => void; id?: string; label?: string; className?: string }) {
  const { data, t } = useApp();
  // Known units in the Settings order (metric, imperial, counts), then any other unit already in use.
  const chosen = data.settings.units;
  const ordered = UNIT_CATALOG.map((unit) => unit.key).filter((key) => chosen.includes(key)).concat(chosen.filter((key) => !UNIT_CATALOG.some((unit) => unit.key === key)));
  const units = Array.from(new Set([...ordered, ...(value.trim() ? [value.trim()] : [])]));
  return (
    <select id={id} className={className} value={value.trim()} aria-label={label ?? t("Unità")} onChange={(event) => onChange(event.target.value)}>
      {value.trim() ? null : <option value="">{t("Unità")}</option>}
      {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
    </select>
  );
}
