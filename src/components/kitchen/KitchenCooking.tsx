"use client";

import { useState } from "react";
import { KitchenAction, KitchenSave, KitchenTemp, KitchenToday, type TodayItem } from "@/components/kitchen/parts";
import { PROCESS_LABELS } from "@/components/safety/CookingDialog";
import { nowTime, tempText, tempValue } from "@/components/safety/fields";
import { newId } from "@/lib/num";
import { photoIdsOf } from "@/lib/safety/photos";
import { cookingOk, processLimit } from "@/lib/safety/rules";
import type { CookingLog, CookingProcess } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

const PROCESSES = Object.keys(PROCESS_LABELS) as CookingProcess[];
const temp = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value + " °C");

/** Core temperature checks: cooking, cooling (with times), reheating and hot holding. */
export function KitchenCooking({ today, by }: { today: string; by: string }) {
  const { data, t, fmt } = useApp();
  const guard = useGuard();
  const { saveLog } = useSafetyActions();
  const rules = data.settings.foodSafety;
  const requirePhoto = Boolean(rules.requireTemperaturePhotos);

  const [editing, setEditing] = useState<CookingLog | null>(null);
  const [draftId, setDraftId] = useState(newId);
  const [process, setProcess] = useState<CookingProcess>("cook");
  const [item, setItem] = useState("");
  const [temperature, setTemperature] = useState("");
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startTemperature, setStartTemperature] = useState("");
  const [startPhotoId, setStartPhotoId] = useState<string | undefined>();
  const [action, setAction] = useState("");

  const todays = data.safetyLogs.filter((log): log is CookingLog => log.kind === "cooking" && log.date === today).sort((a, b) => b.time.localeCompare(a.time));
  // Items checked most recently, for one-tap repeats ("Roast beef", "Gravy").
  const recent = Array.from(new Set(data.safetyLogs.filter((log): log is CookingLog => log.kind === "cooking").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((log) => log.item))).slice(0, 8);

  const draft = { process, temperature: tempValue(temperature), startTime, endTime };
  const filled = draft.temperature !== null && (process !== "cool" || (startTime && endTime));
  const failing = Boolean(filled) && !cookingOk(draft, rules);
  const limit = process === "cool"
    ? fmt(t("Sotto {0} °C entro {1} minuti"), rules.coolTarget, rules.coolMinutes)
    : fmt(t("Almeno {0} °C al cuore"), processLimit(process, rules));
  const signer = by || editing?.by || "";

  function load(log: CookingLog | null) {
    setEditing(log);
    if (!log) setDraftId(newId());
    setProcess(log?.process ?? process);
    setItem(log?.item ?? "");
    setTemperature(tempText(log?.temperature));
    setPhotoId(log?.photoId);
    setStartTime(log?.startTime ?? "");
    setEndTime(log?.endTime ?? "");
    setStartTemperature(tempText(log?.startTemperature));
    setStartPhotoId(log?.startPhotoId);
    setAction(log?.action ?? "");
  }

  const save = guard(async () => {
    if (!item.trim()) { document.getElementById("kitchenCookItem")?.focus(); return; }
    const recipe = data.recipes.find((row) => row.name.trim().toLocaleLowerCase() === item.trim().toLocaleLowerCase());
    const saved = await saveLog({
      id: editing?.id ?? draftId, createdAt: editing?.createdAt, kind: "cooking", date: editing?.date ?? today, time: editing?.time ?? nowTime(),
      process, item: item.trim(), recipeId: recipe?.id, temperature: draft.temperature, ...(photoId ? { photoId } : {}),
      ...(process === "cool" ? { startTime, endTime, startTemperature: tempValue(startTemperature), ...(startPhotoId ? { startPhotoId } : {}) } : {}),
      by: signer, action: failing ? action : "", notes: editing?.notes ?? ""
    });
    if (saved) load(null);
  });

  const items: TodayItem[] = todays.map((log) => ({
    id: log.id, time: log.time, title: log.item, ok: log.ok, photos: photoIdsOf(log).length,
    detail: t(PROCESS_LABELS[log.process]) + " · " + (log.process === "cool" ? temp(log.startTemperature) + " → " : "") + temp(log.temperature)
  }));

  return (
    <div className="kitchen-cooking">
      <div className="kitchen-segment wrap" role="group" aria-label={t("Controllo")}>
        {PROCESSES.map((value) => (
          <button key={value} type="button" className={process === value ? "active" : ""} aria-pressed={process === value}
            onClick={() => { setProcess(value); if (value === "cool" && !endTime) setEndTime(nowTime()); }}>{t(PROCESS_LABELS[value])}</button>
        ))}
      </div>
      {editing ? (
        <p className="kitchen-hint kitchen-editing">{fmt(t("Stai correggendo il controllo delle {0}."), editing.time)} <button type="button" className="link-button" onClick={() => load(null)}>{t("Nuovo controllo")}</button></p>
      ) : null}
      <div className="kitchen-field">
        <label htmlFor="kitchenCookItem">{t("Piatto o preparazione *")}</label>
        <input id="kitchenCookItem" list="kitchenRecipes" value={item} onChange={(event) => setItem(event.target.value)} placeholder={t("Es. Roast beef, ragù, pollo")} autoComplete="off" />
        <datalist id="kitchenRecipes">{data.recipes.map((recipe) => <option key={recipe.id} value={recipe.name} />)}</datalist>
        {recent.length && !item ? <div className="kitchen-chips">{recent.map((name) => <button key={name} type="button" onClick={() => setItem(name)}>{name}</button>)}</div> : null}
      </div>
      {process === "cool" ? (
        <>
          <div className="kitchen-times">
            <div className="kitchen-field"><label htmlFor="kitchenCoolStart">{t("Inizio")}</label><input id="kitchenCoolStart" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
            <div className="kitchen-field"><label htmlFor="kitchenCoolEnd">{t("Fine")}</label><input id="kitchenCoolEnd" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div>
          </div>
          <KitchenTemp label={t("Temperatura iniziale")} value={startTemperature} onChange={setStartTemperature} ok={null}
            photoId={startPhotoId} onPhoto={setStartPhotoId} requirePhoto={requirePhoto} />
        </>
      ) : null}
      <KitchenTemp label={t(process === "cool" ? "Temperatura finale" : "Temperatura al cuore")} hint={limit} value={temperature} onChange={setTemperature}
        ok={filled ? !failing : null} photoId={photoId} onPhoto={setPhotoId} requirePhoto={requirePhoto} />
      {failing ? <KitchenAction title={t("Fuori limite")} hint={t("Azione correttiva *")} value={action} onChange={setAction} /> : null}
      <KitchenSave by={signer} label={t(editing ? "Salva la correzione" : "Salva controllo")} onSave={save} />
      <KitchenToday title={t("Controlli di oggi")} items={items} activeId={editing?.id ?? null} onPick={(id) => load(todays.find((log) => log.id === id) ?? null)} />
    </div>
  );
}
