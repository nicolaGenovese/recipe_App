"use client";

import { InventoryTableRow } from "@/components/stock/inventory/InventoryTableRow";
import { Callout, MetricTile } from "@/components/ui/bits";
import { CheckPill } from "@/components/ui/Field";
import { inventoryRow } from "@/lib/stock/inventory";
import { INVENTORY_COLUMNS, sortInventory } from "@/lib/stock/inventory-sort";
import { MEASURE_LABELS } from "@/lib/stock/sources";
import { useApp } from "@/state/AppProvider";
import type { InventorySortKey } from "@/state/view";

export function InventoryTab() {
  const { data, stockView, setStockView, openDialog, f, t } = useApp();
  const { inventoryQuery, inventoryGroup, inventoryReorderOnly, inventorySort } = stockView;
  const all = data.stockItems.map((item) => ({ item, data: inventoryRow(item, data.stockReports, data.stockDeliveries) }));
  const groups = Array.from(new Set(data.stockItems.map((item) => item.group).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const query = inventoryQuery.trim().toLocaleLowerCase();
  const unitLabel = (item: { measurement: string }) => t(MEASURE_LABELS[item.measurement] || item.measurement || "");

  const rows = sortInventory(all.filter(({ item, data: row }) => (!inventoryGroup || item.group === inventoryGroup) &&
    (!query || [item.code, item.name, item.supplier, item.group].join(" ").toLocaleLowerCase().includes(query)) &&
    (!inventoryReorderOnly || row.status === "reorder")), inventorySort.key, inventorySort.dir, unitLabel);

  const sortBy = (key: InventorySortKey) => setStockView((view) => ({ inventorySort: { key, dir: view.inventorySort.key === key ? (-view.inventorySort.dir as 1 | -1) : 1 } }));

  return (
    <>
      <div className="pill-metrics stock-inv-metrics">
        <MetricTile label={t("Valore totale")}>{f.money(all.reduce((total, row) => total + row.data.value, 0))}</MetricTile>
        <MetricTile label={t("Prodotti da riordinare")}>{all.filter((row) => row.data.status === "reorder").length}</MetricTile>
      </div>
      <div className="stock-toolbar">
        <input type="search" value={inventoryQuery} placeholder={t("Cerca prodotti, fornitori…")} aria-label={t("Cerca prodotti, fornitori…")} onChange={(event) => setStockView({ inventoryQuery: event.target.value })} />
        <select aria-label={t("Reparto")} value={inventoryGroup} onChange={(event) => setStockView({ inventoryGroup: event.target.value })}>
          <option value="">{t("Tutti i reparti")}</option>
          {groups.map((group) => <option key={group} value={group}>{t(group)}</option>)}
        </select>
        <CheckPill checked={inventoryReorderOnly} onChange={(checked) => setStockView({ inventoryReorderOnly: checked })}>{t("Solo da riordinare")}</CheckPill>
        <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "stockItem" })}>{t("Nuovo prodotto")}</button>
      </div>
      <Callout title={t("Conteggio")}>{t("Le celle gialle si salvano da sole. Una giacenza corretta qui vale finché non invii un nuovo report; le consegne successive si sommano.")}</Callout>
      <div className="stock-table-wrap">
        <table className="stock-table stock-inventory">
          <thead>
            <tr>
              {INVENTORY_COLUMNS.map(([column, label, numeric]) => {
                if (!column) return <th key="actions">{t(label)}</th>;
                const active = column === inventorySort.key;
                return (
                  <th key={column} className={"stock-sortable" + (numeric ? " stock-num" : "")} aria-sort={active ? (inventorySort.dir > 0 ? "ascending" : "descending") : "none"}>
                    <button type="button" className="stock-sort" onClick={() => sortBy(column)}>
                      {t(label)}<span className="stock-sort-mark" aria-hidden="true">{active ? (inventorySort.dir > 0 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(({ item, data: row }) => <InventoryTableRow key={item.id} item={item} row={row} unit={unitLabel(item)} />)
              : <tr><td colSpan={11} className="stock-empty">{t("Nessun prodotto trovato.")}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
