"use client";

import { useState } from "react";
import { ActionField, StaffField, TempInput, nowTime, tempText, tempValue } from "@/components/safety/fields";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { Datalist, FieldShell, SelectField, TextField } from "@/components/ui/Field";
import { dateKey } from "@/lib/num";
import { cookingOk, processLimit } from "@/lib/safety/rules";
import type { CookingLog, CookingProcess } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

export const PROCESS_LABELS: Record<CookingProcess, string> = { cook: "Cottura", cool: "Abbattimento", reheat: "Rigenerazione", hotHold: "Mantenimento a caldo" };

/** A core temperature check, linked to the recipe it was taken on. Cooling also records how long it took. */
export function CookingDialog({ id, recipeId }: { id?: string; recipeId?: string }) {
  const { data, closeDialog, t, fmt } = useApp();
  const guard = useGuard();
  const { saveLog, deleteLog } = useSafetyActions();
  const rules = data.settings.foodSafety;
  const base = data.safetyLogs.find((log): log is CookingLog => log.id === id && log.kind === "cooking");
  const startRecipe = data.recipes.find((recipe) => recipe.id === (base?.recipeId ?? recipeId));

  const [date, setDate] = useState(base?.date ?? dateKey(new Date()));
  const [time, setTime] = useState(base?.time ?? nowTime());
  const [process, setProcess] = useState<CookingProcess>(base?.process ?? "cook");
  const [item, setItem] = useState(base?.item ?? startRecipe?.name ?? "");
  const [temperature, setTemperature] = useState(tempText(base?.temperature));
  const [startTime, setStartTime] = useState(base?.startTime ?? "");
  const [endTime, setEndTime] = useState(base?.endTime ?? "");
  const [startTemperature, setStartTemperature] = useState(tempText(base?.startTemperature));
  const [by, setBy] = useState(base?.by ?? "");
  const [action, setAction] = useState(base?.action ?? "");
  const [notes, setNotes] = useState(base?.notes ?? "");

  const recipe = data.recipes.find((row) => row.name.trim().toLocaleLowerCase() === item.trim().toLocaleLowerCase());
  const draft = { process, temperature: tempValue(temperature), startTime, endTime };
  const filled = draft.temperature !== null && (process !== "cool" || (startTime && endTime));
  const failing = Boolean(filled) && !cookingOk(draft, rules);
  const limit = process === "cool"
    ? fmt(t("Sotto {0} °C entro {1} minuti"), rules.coolTarget, rules.coolMinutes)
    : fmt(t("Almeno {0} °C al cuore"), processLimit(process, rules));

  const submit = guard(() => saveLog({
    id: base?.id, createdAt: base?.createdAt, kind: "cooking", date, time, process, item: item.trim(), recipeId: recipe?.id, temperature: draft.temperature,
    ...(process === "cool" ? { startTime, endTime, startTemperature: tempValue(startTemperature) } : {}), by, action: failing ? action : "", notes
  }));

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("SICUREZZA ALIMENTARE")} title={t("Cottura, abbattimento e rigenerazione")} subtitle={limit} />
      <form onSubmit={(event) => { event.preventDefault(); if (!item.trim()) return; void submit(); }}>
        <div className="dialog-body">
          <div className="form-grid">
            <SelectField label={t("Controllo")} name="safetyProcess" value={process} onChange={(value) => setProcess(value as CookingProcess)}
              options={(Object.keys(PROCESS_LABELS) as CookingProcess[]).map((value) => ({ value, label: t(PROCESS_LABELS[value]) }))} />
            <FieldShell label={t("Piatto o preparazione *")} htmlFor="field-safetyItem" hint={recipe ? t("Collegato alla ricetta.") : undefined}>
              <input id="field-safetyItem" list="safetyRecipes" value={item} required onChange={(event) => setItem(event.target.value)} />
            </FieldShell>
            <TextField label={t("Data")} name="safetyDate" type="date" value={date} onChange={setDate} />
            <TextField label={t("Ora")} name="safetyTime" value={time} onChange={setTime} placeholder="12:30" />
          </div>
          {process === "cool" ? (
            <div className="form-grid cols-3 safety-cool">
              <TextField label={t("Inizio")} name="coolStart" value={startTime} onChange={setStartTime} placeholder="14:00" />
              <TextField label={t("Fine")} name="coolEnd" value={endTime} onChange={setEndTime} placeholder="15:20" />
              <FieldShell label={t("Temperatura iniziale °C")} htmlFor="coolStartTemp"><TempInput value={startTemperature} onChange={setStartTemperature} label={t("Temperatura iniziale °C")} /></FieldShell>
            </div>
          ) : null}
          <FieldShell label={process === "cool" ? t("Temperatura finale °C *") : t("Temperatura al cuore °C *")} htmlFor="safetyTemp">
            <TempInput value={temperature} onChange={setTemperature} invalid={failing} label={t("Temperatura °C")} />
          </FieldShell>
          {failing ? <ActionField value={action} onChange={setAction} /> : null}
          <div className="form-grid">
            <StaffField value={by} date={date} onChange={setBy} />
            <TextField label={t("Note")} name="safetyNotes" value={notes} onChange={setNotes} />
          </div>
          <Datalist id="safetyRecipes" values={data.recipes.map((row) => row.name)} />
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
