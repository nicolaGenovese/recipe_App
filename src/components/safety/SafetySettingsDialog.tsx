"use client";

import { useState } from "react";
import { CHECKLIST_LABELS } from "@/components/safety/ChecklistDialog";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { clone, newId, num } from "@/lib/num";
import type { ChecklistKind, Equipment, FoodSafetySettings } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSettingsActions } from "@/state/actions/useSettingsActions";

type NumberKey = "cookMin" | "reheatMin" | "hotHoldMin" | "coolTarget" | "coolMinutes" | "chilledDeliveryMax" | "frozenDeliveryMax" | "defaultShelfLifeDays";
const LIMITS: [NumberKey, string][] = [
  ["cookMin", "Cottura: minimo al cuore °C"], ["reheatMin", "Rigenerazione: minimo °C"], ["hotHoldMin", "Mantenimento a caldo: minimo °C"],
  ["coolTarget", "Abbattimento: sotto °C"], ["coolMinutes", "Abbattimento: entro minuti"], ["chilledDeliveryMax", "Consegna refrigerati: massimo °C"],
  ["frozenDeliveryMax", "Consegna surgelati: massimo °C"], ["defaultShelfLifeDays", "Etichette: giorni di conservazione predefiniti"]
];
const KINDS: [Equipment["kind"], string][] = [["fridge", "Frigorifero"], ["freezer", "Congelatore"], ["hot", "Banco caldo"]];
const DEFAULT_RANGE: Record<Equipment["kind"], [number | null, number | null]> = { fridge: [0, 5], freezer: [null, -18], hot: [63, null] };

const limitText = (value: number | null) => (value === null ? "" : String(value));
const limitValue = (value: string) => (value.trim() === "" || !Number.isFinite(Number(value)) ? null : Number(value));

/** Equipment, limits and checklist items of the food safety records. */
export function SafetySettingsDialog() {
  const { data, closeDialog, t } = useApp();
  const guard = useGuard();
  const { saveSettings } = useSettingsActions();
  const [draft, setDraft] = useState<FoodSafetySettings>(() => clone(data.settings.foodSafety));
  const [lists, setLists] = useState(() => Object.fromEntries(Object.entries(draft.checklists).map(([key, items]) => [key, items.join("\n")])) as Record<ChecklistKind, string>);

  const setEquipment = (index: number, change: Partial<Equipment>) => setDraft((old) => ({ ...old, equipment: old.equipment.map((row, at) => (at === index ? { ...row, ...change } : row)) }));

  const save = guard(() => saveSettings({
    ...data.settings,
    foodSafety: {
      ...draft,
      equipment: draft.equipment.filter((row) => row.name.trim()).map((row) => ({ ...row, name: row.name.trim() })),
      checklists: Object.fromEntries(Object.entries(lists).map(([key, value]) => [key, value.split("\n").map((line) => line.trim()).filter(Boolean)])) as Record<ChecklistKind, string[]>
    }
  }));

  return (
    <Dialog>
      <DialogHeader kicker={t("SICUREZZA ALIMENTARE")} title={t("Impostazioni della sicurezza alimentare")} subtitle={t("Apparecchi da controllare, limiti di temperatura e voci delle checklist.")} />
      <div className="dialog-body">
        <section className="form-section">
          <h3 className="form-section-title">{t("Frigoriferi, congelatori e banchi caldi")}</h3>
          <table className="stock-table safety-equipment">
            <thead><tr><th>{t("Nome")}</th><th>{t("Tipo")}</th><th>{t("Minimo °C")}</th><th>{t("Massimo °C")}</th><th /></tr></thead>
            <tbody>
              {draft.equipment.map((row, index) => (
                <tr key={row.id}>
                  <td><input value={row.name} aria-label={t("Nome")} onChange={(event) => setEquipment(index, { name: event.target.value })} /></td>
                  <td>
                    <select value={row.kind} aria-label={t("Tipo")} onChange={(event) => {
                      const kind = event.target.value as Equipment["kind"];
                      setEquipment(index, { kind, min: DEFAULT_RANGE[kind][0], max: DEFAULT_RANGE[kind][1] });
                    }}>
                      {KINDS.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                    </select>
                  </td>
                  <td><input type="number" step="0.5" value={limitText(row.min)} aria-label={t("Minimo °C")} onChange={(event) => setEquipment(index, { min: limitValue(event.target.value) })} /></td>
                  <td><input type="number" step="0.5" value={limitText(row.max)} aria-label={t("Massimo °C")} onChange={(event) => setEquipment(index, { max: limitValue(event.target.value) })} /></td>
                  <td><button className="card-action" type="button" aria-label={t("Rimuovi")} onClick={() => setDraft((old) => ({ ...old, equipment: old.equipment.filter((_, at) => at !== index) }))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="button button-secondary button-small stock-add-line" type="button"
            onClick={() => setDraft((old) => ({ ...old, equipment: [...old.equipment, { id: newId(), name: "", kind: "fridge", min: 0, max: 5 }] }))}>{t("Aggiungi apparecchio")}</button>
        </section>
        <section className="form-section">
          <h3 className="form-section-title">{t("Limiti")}</h3>
          <div className="form-grid">
            {LIMITS.map(([key, label]) => (
              <TextField key={key} label={t(label)} name={"limit-" + key} type="number" step="0.5" min={-60} value={draft[key]}
                onChange={(value) => setDraft((old) => ({ ...old, [key]: num(value) }))} />
            ))}
          </div>
        </section>
        <section className="form-section">
          <h3 className="form-section-title">{t("Voci delle checklist")} <small>{t("una per riga")}</small></h3>
          <div className="form-grid cols-3">
            {(Object.keys(CHECKLIST_LABELS) as ChecklistKind[]).map((key) => (
              <TextAreaField key={key} label={t(CHECKLIST_LABELS[key])} name={"list-" + key} value={lists[key]} onChange={(value) => setLists((old) => ({ ...old, [key]: value }))} />
            ))}
          </div>
        </section>
      </div>
      <footer className="dialog-footer">
        <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
        <button className="button button-primary" type="button" onClick={save}>{t("Salva impostazioni")}</button>
      </footer>
    </Dialog>
  );
}
