"use client";

import { useState } from "react";
import { KitchenSave } from "@/components/kitchen/parts";
import { REASON_LABELS } from "@/components/performance/WasteDialog";
import { num } from "@/lib/num";
import { WASTE_REASONS, wasteCost, wasteUnitCost } from "@/lib/performance/waste";
import { isFood } from "@/lib/stock/kind";
import { unitText } from "@/lib/stock/units";
import type { WasteLog, WasteReason } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { usePerformanceActions } from "@/state/actions/usePerformanceActions";

/** How much one tap on − or + changes: half a kilo or litre, 50 g or ml, one piece or portion. */
function stepFor(unit: string): number {
  const key = unit.trim().toLowerCase();
  return key === "kg" || key === "l" ? 0.5 : key === "g" || key === "ml" ? 50 : 1;
}
const round = (value: number) => Math.round(value * 1000) / 1000;
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Waste in a few taps: what (a recent item, or a dish, base or food product found by name), how much
 * with large − and + keys, why, and save as whoever is working. The cost comes from the product or
 * the recipe; a free entry is saved without cost and can be completed in Performance.
 */
export function KitchenWaste({ today, by }: { today: string; by: string }) {
  const { data, f, t, fmt, can } = useApp();
  const guard = useGuard();
  const { saveWaste } = usePerformanceActions();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [reason, setReason] = useState<WasteReason>("expired");
  const [notes, setNotes] = useState("");
  const showCost = can("costs.view");

  const key = name.trim().toLocaleLowerCase();
  const recipe = key ? data.recipes.find((row) => row.name.trim().toLocaleLowerCase() === key) : undefined;
  const product = key && !recipe ? data.stockItems.find((row) => isFood(row) && row.name.trim().toLocaleLowerCase() === key) : undefined;
  const source: WasteLog["source"] = recipe ? "recipe" : product ? "product" : "other";
  const itemId = recipe?.id ?? product?.id;
  const unitCost = wasteUnitCost(source, itemId, unit, data.recipes, data.stockItems) ?? 0;
  const amount = num(quantity);

  // Items thrown away most recently, for one-tap repeats.
  const recent = Array.from(new Set([...data.wasteLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((log) => log.name.trim()).filter(Boolean))).slice(0, 8);
  const todays = data.wasteLogs.filter((log) => log.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /** Picking a known item sets its unit: portions for a recipe, the recipe unit for a product. */
  function pick(value: string) {
    setName(value);
    const lower = value.trim().toLocaleLowerCase();
    const r = data.recipes.find((row) => row.name.trim().toLocaleLowerCase() === lower);
    const p = r ? undefined : data.stockItems.find((row) => isFood(row) && row.name.trim().toLocaleLowerCase() === lower);
    if (r) setUnit("porz");
    else if (p) setUnit(p.recipeUnit || "pz");
  }
  const bump = (direction: 1 | -1) => setQuantity((old) => String(Math.max(0, round(num(old) + direction * stepFor(unit)))));

  const save = guard(async () => {
    if (!name.trim()) { document.getElementById("kitchenWasteItem")?.focus(); return; }
    const saved = await saveWaste({ date: today, source, itemId, name: name.trim(), quantity: amount, unit: unit.trim(), unitCost, reason, by, notes: notes.trim() });
    if (saved) { setName(""); setQuantity(""); setUnit(""); setNotes(""); setReason("expired"); }
  });

  return (
    <div className="kitchen-waste">
      <div className="kitchen-field">
        <label htmlFor="kitchenWasteItem">{t("Cosa si butta *")}</label>
        <input id="kitchenWasteItem" list="kitchenWasteItems" value={name} onChange={(event) => pick(event.target.value)} placeholder={t("Piatto, base o prodotto")} autoComplete="off" />
        <datalist id="kitchenWasteItems">
          {data.recipes.map((row) => <option key={"r" + row.id} value={row.name} />)}
          {data.stockItems.filter(isFood).map((row) => <option key={"p" + row.id} value={row.name} />)}
        </datalist>
        {recent.length && !name ? <div className="kitchen-chips">{recent.map((value) => <button key={value} type="button" onClick={() => pick(value)}>{value}</button>)}</div> : null}
        {name.trim() ? <small className="kitchen-waste-source">{t(source === "recipe" ? "Ricetta: costo per porzione." : source === "product" ? "Prodotto del magazzino." : "Voce libera: il costo si aggiunge da Andamento.")}</small> : null}
      </div>

      <div className="kitchen-field">
        <label htmlFor="kitchenWasteQty">{t("Quantità *")}</label>
        <div className="kitchen-waste-qty">
          <button type="button" className="kitchen-sign" onClick={() => bump(-1)} aria-label={t("Meno")} disabled={amount <= 0}>−</button>
          <input id="kitchenWasteQty" type="text" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(",", "."))} placeholder="0" />
          <button type="button" className="kitchen-sign" onClick={() => bump(1)} aria-label={t("Più")}>+</button>
          {source === "other" ? (
            <input className="kitchen-waste-unit" value={unit} onChange={(event) => setUnit(event.target.value)} aria-label={t("Unità")} placeholder={t("Unità")} />
          ) : <span className="kitchen-waste-unit-label">{unitText(unit, t)}</span>}
        </div>
      </div>

      <div className="kitchen-segment wrap" role="group" aria-label={t("Motivo")}>
        {WASTE_REASONS.map((value) => <button key={value} type="button" className={reason === value ? "active" : ""} aria-pressed={reason === value} onClick={() => setReason(value)}>{t(REASON_LABELS[value])}</button>)}
      </div>

      <div className="kitchen-field">
        <label htmlFor="kitchenWasteNotes">{t("Note")}</label>
        <input id="kitchenWasteNotes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("Facoltative")} autoComplete="off" />
      </div>

      {showCost && amount > 0 && unitCost > 0 ? <p className="kitchen-hint">{fmt(t("Costo dello spreco: {0}"), f.money(amount * unitCost))}</p> : null}
      <KitchenSave by={by} label={t("Registra spreco")} onSave={save} />

      {todays.length ? (
        <section className="kitchen-today kitchen-waste-today">
          <h3>{t("Sprechi di oggi")}</h3>
          <ul>
            {todays.map((log) => (
              <li key={log.id}>
                <span className="kitchen-today-time">{clock(log.createdAt)}</span>
                <span className="kitchen-today-main">
                  <strong>{log.name}</strong>
                  <small>{[num(log.quantity) + " " + unitText(log.unit, t), t(REASON_LABELS[log.reason]), log.by].filter(Boolean).join(" · ")}</small>
                </span>
                {showCost ? <span className="kitchen-waste-cost">{f.money(wasteCost(log))}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
