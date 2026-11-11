"use client";

import { useState } from "react";
import { ActionField, StaffField, TempInput, nowTime, tempText, tempValue } from "@/components/safety/fields";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { SelectField, TextField } from "@/components/ui/Field";
import { dateKey } from "@/lib/num";
import { readingOk } from "@/lib/safety/rules";
import type { Equipment, TemperatureLog } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

export function rangeText(equipment: Pick<Equipment, "min" | "max">): string {
  if (equipment.min !== null && equipment.max !== null) return equipment.min + "…" + equipment.max + " °C";
  if (equipment.max !== null) return "≤ " + equipment.max + " °C";
  if (equipment.min !== null) return "≥ " + equipment.min + " °C";
  return "—";
}

/** One round of fridge and freezer readings, morning or evening. */
export function TemperatureDialog({ id }: { id?: string }) {
  const { data, closeDialog, t } = useApp();
  const guard = useGuard();
  const { saveLog, deleteLog } = useSafetyActions();
  const base = data.safetyLogs.find((log): log is TemperatureLog => log.id === id && log.kind === "temperature");
  const equipment = data.settings.foodSafety.equipment;

  const [date, setDate] = useState(base?.date ?? dateKey(new Date()));
  const [time, setTime] = useState(base?.time ?? nowTime());
  const [slot, setSlot] = useState<"am" | "pm">(base?.slot ?? (new Date().getHours() < 14 ? "am" : "pm"));
  const [by, setBy] = useState(base?.by ?? "");
  const [action, setAction] = useState(base?.action ?? "");
  const [notes, setNotes] = useState(base?.notes ?? "");
  // Equipment removed from the settings still shows on old records.
  const rows = equipment.map((item) => ({ equipmentId: item.id, name: item.name, item }))
    .concat((base?.readings ?? []).filter((reading) => !equipment.some((item) => item.id === reading.equipmentId)).map((reading) => ({ equipmentId: reading.equipmentId, name: reading.name, item: { min: null, max: null } as Equipment })));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((base?.readings ?? []).map((reading) => [reading.equipmentId, tempText(reading.value)])));

  const readings = rows.map((row) => ({ equipmentId: row.equipmentId, name: row.name, value: tempValue(values[row.equipmentId] ?? ""), ok: readingOk(tempValue(values[row.equipmentId] ?? ""), row.item) }));
  const failing = readings.some((reading) => !reading.ok);

  const submit = guard(() => saveLog({ id: base?.id, createdAt: base?.createdAt, kind: "temperature", date, time, slot, by, action: failing ? action : "", notes, readings }));

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("SICUREZZA ALIMENTARE")} title={t("Temperature frigoriferi e congelatori")} subtitle={t("Scrivi la temperatura letta su ogni apparecchio.")} />
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="dialog-body">
          <div className="form-grid cols-3">
            <TextField label={t("Data")} name="safetyDate" type="date" value={date} onChange={setDate} />
            <SelectField label={t("Giro")} name="safetySlot" value={slot} onChange={(value) => setSlot(value as "am" | "pm")} options={[{ value: "am", label: t("Mattina") }, { value: "pm", label: t("Sera") }]} />
            <TextField label={t("Ora")} name="safetyTime" value={time} onChange={setTime} placeholder="09:00" />
          </div>
          <table className="stock-table safety-readings">
            <thead><tr><th>{t("Apparecchio")}</th><th>{t("Limite")}</th><th>{t("Temperatura °C")}</th></tr></thead>
            <tbody>
              {readings.map((reading, index) => (
                <tr key={reading.equipmentId} className={reading.ok ? "" : "safety-bad"}>
                  <td>{t(reading.name)}</td>
                  <td>{rangeText(rows[index].item)}</td>
                  <td><TempInput value={values[reading.equipmentId] ?? ""} invalid={!reading.ok} label={reading.name} onChange={(value) => setValues((old) => ({ ...old, [reading.equipmentId]: value }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length ? null : <p className="field-hint">{t("Nessun apparecchio: aggiungili dalle impostazioni della sicurezza alimentare.")}</p>}
          {failing ? <ActionField value={action} onChange={setAction} /> : null}
          <div className="form-grid">
            <StaffField value={by} date={date} onChange={setBy} />
            <TextField label={t("Note")} name="safetyNotes" value={notes} onChange={setNotes} />
          </div>
        </div>
        <footer className="dialog-footer">
          <div>{base ? <button className="button button-quiet" type="button" onClick={guard(() => deleteLog(base.id))}>{t("Elimina")}</button> : <span />}</div>
          <div className="dialog-footer-right">
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
            <button className="button button-primary" type="submit">{t("Salva")}</button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
