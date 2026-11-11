"use client";

import { num } from "@/lib/num";
import type { InventoryRow } from "@/lib/stock/inventory";
import type { StockItem } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";

const rounded = (value: number) => Math.round(num(value) * 1000) / 1000;
const NEEDS_CHECK = /verify|check tub/i;

/** A yellow cell that saves when the value is committed (blur or Enter), like a spreadsheet. */
function CountCell({ value, label, onCommit }: { value: number; label: string; onCommit: (value: number) => void }) {
  return (
    <td className="stock-num">
      <input
        // A new value from the store remounts the input, so it never shows a stale number.
        key={value} className="stock-inv-input" type="number" min="0" step="0.01" defaultValue={rounded(value)} aria-label={label}
        onBlur={(event) => { if (num(event.target.value) !== rounded(value)) onCommit(num(event.target.value)); }}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
      />
    </td>
  );
}

export function InventoryTableRow({ item, row, unit }: { item: StockItem; row: InventoryRow; unit: string }) {
  const { openDialog, f, t } = useApp();
  const guard = useGuard();
  const { saveInventoryCell, deleteStockItem } = useStockActions();
  return (
    <tr>
      <td>{item.code}</td>
      <td>{item.name}{NEEDS_CHECK.test(item.note || "") ? <> <span className="stock-inv-warn" title={item.note} aria-label={item.note}>⚠</span></> : null}</td>
      <td>{item.supplier || "—"}</td>
      <td>{unit}</td>
      <CountCell value={row.par} label={t("Livello minimo") + " · " + item.name} onCommit={(value) => saveInventoryCell(item.id, "parLevel", value)} />
      <CountCell value={row.stock} label={t("Giacenza attuale") + " · " + item.name} onCommit={(value) => saveInventoryCell(item.id, "stock", value)} />
      <td className="stock-num">{f.quantity(row.reorder)}</td>
      <td>{row.status === "none" ? "—" : <span className={"stock-status stock-status-" + row.status}>{t(row.status === "reorder" ? "RIORDINA" : "OK")}</span>}</td>
      <td className="stock-num">{f.money(row.unitCost)}</td>
      <td className="stock-num stock-value">{f.money(row.value)}</td>
      <td className="stock-row-actions">
        <button className="card-action" type="button" onClick={() => openDialog({ kind: "stockItem", id: item.id })} aria-label={t("Modifica prodotto")}>↗</button>
        <button className="card-action" type="button" onClick={guard(() => deleteStockItem(item.id))} aria-label={t("Elimina")}>×</button>
      </td>
    </tr>
  );
}
