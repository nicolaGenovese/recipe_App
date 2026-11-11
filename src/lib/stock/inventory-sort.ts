import type { InventoryRow } from "@/lib/stock/inventory";
import type { StockItem } from "@/lib/types";
import type { InventorySortKey } from "@/state/view";

export const INVENTORY_COLUMNS: [InventorySortKey | "", string, boolean?][] = [
  ["code", "Codice"], ["name", "Nome"], ["supplier", "Fornitore"], ["unit", "Unità"], ["par", "Livello minimo", true], ["stock", "Giacenza attuale", true],
  ["reorder", "Da riordinare", true], ["status", "Stato"], ["cost", "Costo per unità", true], ["value", "Valore", true], ["", "Azioni"]
];

// Products to reorder come first when sorting by status.
const STATUS_ORDER = { reorder: 0, ok: 1, none: 2 };

function sortValue(item: StockItem, data: InventoryRow, key: InventorySortKey, unitLabel: string): string | number | undefined {
  switch (key) {
    case "code": return item.code;
    case "name": return item.name;
    case "supplier": return item.supplier;
    case "unit": return unitLabel;
    case "par": return data.par;
    case "stock": return data.stock;
    case "reorder": return data.reorder;
    case "status": return STATUS_ORDER[data.status];
    case "cost": return data.unitCost;
    case "value": return data.value;
  }
}

const text = (value: unknown) => String(value || "");

/** Numbers sort by value, text in natural order (ING30 before ING121); ties fall back to the code. */
export function sortInventory<T extends { item: StockItem; data: InventoryRow }>(rows: T[], key: InventorySortKey, dir: 1 | -1, unitLabel: (item: StockItem) => string): T[] {
  return [...rows].sort((a, b) => {
    const x = sortValue(a.item, a.data, key, unitLabel(a.item));
    const y = sortValue(b.item, b.data, key, unitLabel(b.item));
    const order = typeof x === "number" && typeof y === "number" ? x - y : text(x).localeCompare(text(y), undefined, { numeric: true, sensitivity: "base" });
    return order * dir || text(a.item.code).localeCompare(text(b.item.code), undefined, { numeric: true });
  });
}
