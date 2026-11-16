"use client";

import { useState } from "react";
import { KitchenAction, KitchenSave, KitchenTemp } from "@/components/kitchen/parts";
import { rangeText } from "@/components/safety/TemperatureDialog";
import { nowTime, tempText, tempValue } from "@/components/safety/fields";
import { todaysTemperature } from "@/lib/kitchen/today";
import { newId } from "@/lib/num";
import { readingOk } from "@/lib/safety/rules";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

/** The morning or evening round of fridges, freezers and hot counters, with a photo of each reading. */
export function KitchenTemperatures({ today, by, slotNow }: { today: string; by: string; slotNow: "am" | "pm" }) {
  const { data, t } = useApp();
  const guard = useGuard();
  const { saveLog } = useSafetyActions();
  const equipment = data.settings.foodSafety.equipment;
  const requirePhoto = Boolean(data.settings.foodSafety.requireTemperaturePhotos);
  const [slot, setSlot] = useState(slotNow);
  const record = todaysTemperature(data.safetyLogs, today, slot);
  // A new id per round, kept while the form is filled; an existing record keeps its own.
  const [draftId, setDraftId] = useState(newId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string | undefined>>({});
  const [action, setAction] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Opening a round already entered shows its readings and photos, so it can be corrected.
  const key = slot + ":" + (record?.id ?? "new");
  if (loadedFor !== key) {
    setLoadedFor(key);
    setValues(Object.fromEntries((record?.readings ?? []).map((reading) => [reading.equipmentId, tempText(reading.value)])));
    setPhotos(Object.fromEntries((record?.readings ?? []).map((reading) => [reading.equipmentId, reading.photoId])));
    setAction(record?.action ?? "");
    if (!record) setDraftId(newId());
  }

  const readings = equipment.map((item) => {
    const value = tempValue(values[item.id] ?? "");
    const photoId = photos[item.id];
    return { equipmentId: item.id, name: item.name, value, ok: readingOk(value, item), ...(photoId ? { photoId } : {}) };
  });
  const failing = readings.some((reading) => !reading.ok);
  const doneSlot = (value: "am" | "pm") => Boolean(todaysTemperature(data.safetyLogs, today, value));
  const signer = by || record?.by || "";

  const save = guard(() => saveLog({
    id: record?.id ?? draftId, createdAt: record?.createdAt, kind: "temperature", date: today, time: record?.time ?? nowTime(), slot,
    by: signer, action: failing ? action : "", notes: record?.notes ?? "", readings
  }));

  if (!equipment.length) return <div className="kitchen-empty"><p>{t("Nessun apparecchio: aggiungili dalle impostazioni della sicurezza alimentare.")}</p></div>;
  return (
    <div className="kitchen-temps">
      <div className="kitchen-segment" role="group" aria-label={t("Giro")}>
        {(["am", "pm"] as const).map((value) => (
          <button key={value} type="button" className={slot === value ? "active" : ""} aria-pressed={slot === value} onClick={() => setSlot(value)}>
            {t(value === "am" ? "Mattina" : "Sera")} {doneSlot(value) ? "✓" : ""}
          </button>
        ))}
      </div>
      {record ? <p className="kitchen-hint">{t("Giro già registrato: puoi correggerlo e salvarlo di nuovo.")}</p> : null}
      {requirePhoto ? <p className="kitchen-hint">{t("Serve la foto del termometro per ogni temperatura scritta.")}</p> : null}
      <div className="kitchen-readings">
        {readings.map((reading, index) => (
          <KitchenTemp key={reading.equipmentId} label={t(reading.name)} hint={rangeText(equipment[index])} value={values[reading.equipmentId] ?? ""} ok={reading.ok}
            onChange={(value) => setValues((old) => ({ ...old, [reading.equipmentId]: value }))}
            photoId={photos[reading.equipmentId]} onPhoto={(id) => setPhotos((old) => ({ ...old, [reading.equipmentId]: id }))} requirePhoto={requirePhoto} />
        ))}
      </div>
      {failing ? <KitchenAction title={t("Fuori limite")} hint={t("Azione correttiva *")} value={action} onChange={setAction} /> : null}
      <KitchenSave by={signer} label={t("Salva temperature")} onSave={save} />
    </div>
  );
}
