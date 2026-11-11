"use client";

import { DeliveriesTab } from "@/components/stock/deliveries/DeliveriesTab";
import { InventoryTab } from "@/components/stock/inventory/InventoryTab";
import { ReportsTab } from "@/components/stock/reports/ReportsTab";
import { draftReport, latestSubmitted } from "@/lib/stock/report";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";
import type { StockTab } from "@/state/view";

const TABS: [StockTab, string][] = [["reports", "Report"], ["deliveries", "Consegne"], ["inventory", "Inventario"]];

export function StockView() {
  const { data, stockView, setStockView, openDialog, t } = useApp();
  const guard = useGuard();
  const { ensureStockCodes } = useStockActions();
  const draft = draftReport(data.stockReports);

  const switchTab = guard(async (tab: StockTab) => {
    if (tab === "inventory") await ensureStockCodes();
    setStockView({ tab, page: 1 });
  });

  return (
    <section className="stock-view">
      {draft ? (
        <div className="stock-banner">
          <span>{t("Il report stock non è stato inviato.")}</span>
          <button className="button button-secondary button-small" type="button" onClick={() => openDialog({ kind: "stockReport", id: draft.id })}>{t("Apri bozza")}</button>
        </div>
      ) : null}
      <div className="stock-head">
        <div className="editor-tabs stock-tabs">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" className={"editor-tab" + (stockView.tab === key ? " active" : "")} onClick={() => switchTab(key)}>{t(label)}</button>
          ))}
        </div>
        <button className="button button-secondary" type="button" onClick={() => openDialog({ kind: "stockPicker" })}>{t("Crea ricetta dal magazzino")}</button>
      </div>
      {/* A new submitted report moves the suggested period, so the form starts over. */}
      {stockView.tab === "reports" ? <ReportsTab key={latestSubmitted(data.stockReports)?.id ?? "none"} /> : null}
      {stockView.tab === "deliveries" ? <DeliveriesTab /> : null}
      {stockView.tab === "inventory" ? <InventoryTab /> : null}
    </section>
  );
}
