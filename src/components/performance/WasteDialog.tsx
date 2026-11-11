"use client";

import { useState } from "react";
import { StaffField } from "@/components/safety/fields";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { Datalist, FieldShell, SelectField, TextField } from "@/components/ui/Field";
import { dateKey, num } from "@/lib/num";
import { WASTE_REASONS, wasteUnitCost } from "@/lib/performance/waste";
import type { WasteLog, WasteReason } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { usePerformanceActions } from "@/state/actions/usePerformanceActions";

export const REASON_LABELS: Record<WasteReason, string> = { expired: "Scaduto", error: "Errore in cucina", leftover: "Avanzo", damaged: "Danneggiato", other: "Altro" };

/** One thing thrown away. Naming a product or a recipe fills in its cost; anything else takes a cost by hand. */
export function WasteDialog({ id }: { id?: string }) {
  const { data, closeDialog, f, t } = useApp();
  const guard = useGuard();
  const { saveWaste, deleteWaste } = usePerformanceActions();
  const base = data.wasteLogs.find((log) => log.id === id);

  const [date, setDate] = useState(base?.date ?? dateKey(new Date()));
  const [name, setName] = useState(base?.name ?? "");
  const [quantity, setQuantity] = useState(base ? String(base.quantity) : "");
  const [unit, setUnit] = useState(base?.unit ?? "");
  const [unitCost, setUnitCost] = useState(base ? String(base.unitCost) : "");
  const [reason, setReason] = useState<WasteReason>(base?.reason ?? "expired");
  const [by, setBy] = useState(base?.by ?? "");
  const [notes, setNotes] = useState(base?.notes ?? "");

  const key = name.trim().toLocaleLowerCase();
  const recipe = data.recipes.find((row) => row.name.trim().toLocaleLowerCase() === key);
  const product = recipe ? undefined : data.stockItems.find((row) => row.name.trim().toLocaleLowerCase() === key);
  const source: WasteLog["source"] = recipe ? "recipe" : product ? "product" : "other";
  const itemId = recipe?.id ?? product?.id;

  /** Picking a known item sets its unit and cost; the cost can still be changed by hand. */
  function changeName(value: string) {
    setName(value);
    const lower = value.trim().toLocaleLowerCase();
    const r = data.recipes.find((row) => row.name.trim().toLocaleLowerCase() === lower);
    const p = r ? undefined : data.stockItems.find((row) => row.name.trim().toLocaleLowerCase() === lower);
    if (!r && !p) return;
    const nextUnit = r ? "porz" : p!.recipeUnit;
    setUnit(nextUnit);
    const cost = wasteUnitCost(r ? "recipe" : "product", (r ?? p)!.id, nextUnit, data.recipes, data.stockItems);
    setUnitCost(cost === null ? "" : String(cost));
  }

  const total = num(quantity) * num(unitCost);
  const submit = guard(() => saveWaste({
    id: base?.id, createdAt: base?.createdAt, date, source, itemId, name: name.trim(), quantity: num(quantity), unit: unit.trim(), unitCost: num(unitCost), reason, by, notes
  }));

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("SPRECHI")} title={t(base ? "Spreco" : "Registra spreco")} subtitle={t("Cosa si butta, quanto e perché. Il costo arriva dal prodotto o dalla ricetta.")} />
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="dialog-body">
          <div className="form-grid">
            <FieldShell label={t("Cosa *")} htmlFor="field-wasteName" hint={source === "recipe" ? t("Ricetta: costo per porzione.") : source === "product" ? t("Prodotto del magazzino.") : t("Voce libera: scrivi il costo a mano.")}>
              <input id="field-wasteName" list="wasteItems" value={name} required onChange={(event) => changeName(event.target.value)} />
            </FieldShell>
            <SelectField label={t("Motivo")} name="wasteReason" value={reason} onChange={(value) => setReason(value as WasteReason)} options={WASTE_REASONS.map((value) => ({ value, label: t(REASON_LABELS[value]) }))} />
            <TextField label={t("Quantità *")} name="wasteQty" type="number" step="0.01" value={quantity} onChange={setQuantity} />
            <TextField label={t("Unità")} name="wasteUnit" value={unit} onChange={setUnit} placeholder="kg, l, pz, porz" />
            <TextField label={f.withCurrency(t("Costo per unità €"))} name="wasteCost" type="number" step="0.0001" value={unitCost} onChange={setUnitCost} hint={f.withCurrency(t("Totale")) + ": " + f.money(total)} />
            <TextField label={t("Data")} name="wasteDate" type="date" value={date} onChange={setDate} />
            <StaffField value={by} date={date} onChange={setBy} label={t("Registrato da *")} />
            <TextField label={t("Note")} name="wasteNotes" value={notes} onChange={setNotes} />
          </div>
          <Datalist id="wasteItems" values={[...data.recipes.map((row) => row.name), ...data.stockItems.map((row) => row.name)]} />
        </div>
        <footer className="dialog-footer">
          <div>{base ? <button className="button button-quiet" type="button" onClick={guard(() => deleteWaste(base.id))}>{t("Elimina")}</button> : <span />}</div>
          <div className="dialog-footer-right">
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
            <button className="button button-primary" type="submit">{t("Salva")}</button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
