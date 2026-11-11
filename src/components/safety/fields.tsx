"use client";

import { Datalist, FieldShell } from "@/components/ui/Field";
import { staffNames } from "@/lib/safety/staff";
import { useApp } from "@/state/AppProvider";

/** "Who did it": the names on the rota for that day's week are suggested, any other name can be typed. */
export function StaffField({ value, date, onChange, label }: { value: string; date: string; onChange: (value: string) => void; label?: string }) {
  const { data, t } = useApp();
  const names = staffNames(data.rotaWeeks, date, data.settings.staff);
  return (
    <FieldShell label={label ?? t("Firmato da *")} htmlFor="field-safetyBy" hint={names.length ? undefined : t("Aggiungi il personale in Impostazioni → Personale per sceglierlo da qui.")}>
      <input id="field-safetyBy" list="safetyStaff" value={value} onChange={(event) => onChange(event.target.value)} placeholder={names[0] ?? ""} autoComplete="off" />
      <Datalist id="safetyStaff" values={names} />
    </FieldShell>
  );
}

/** A temperature in °C; empty stays empty instead of becoming 0. */
export function TempInput({ value, onChange, label, invalid }: { value: string; onChange: (value: string) => void; label: string; invalid?: boolean }) {
  return <input className={"safety-temp" + (invalid ? " out" : "")} type="number" step="0.1" inputMode="decimal" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} />;
}

export const tempValue = (value: string): number | null => (value.trim() === "" || !Number.isFinite(Number(value)) ? null : Number(value));
export const tempText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
export const nowTime = () => new Date().toTimeString().slice(0, 5);

/** The corrective action box, shown when a check fails. */
export function ActionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useApp();
  return (
    <div className="safety-alert">
      <strong>{t("Fuori limite")}</strong>
      <label htmlFor="field-safetyAction">{t("Azione correttiva *")}</label>
      <textarea id="field-safetyAction" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("Es. spostato il cibo nel frigo 2, chiamato il tecnico, ricontrollato dopo 30 minuti…")} />
    </div>
  );
}
