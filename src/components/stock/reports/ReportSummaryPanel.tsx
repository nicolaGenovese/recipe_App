"use client";

import { gpClass } from "@/lib/stock/gp-text";
import { wasteBetween, wasteTotals } from "@/lib/performance/waste";
import { summarizeReport, supplierTotals } from "@/lib/stock/report";
import type { StockReport } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

/** Totals per supplier and the report figures, shown when a report row is expanded. */
export function ReportSummaryPanel({ report }: { report: StockReport }) {
  const { data, gpRules, openDialog, f, t } = useApp();
  const waste = wasteTotals(wasteBetween(data.wasteLogs, report.dateFrom, report.dateTo)).total;
  const summary = summarizeReport(report, gpRules);
  const totals: [string, React.ReactNode][] = [
    ["Totale giacenza di chiusura", f.money(summary.closingTotal)], ["Totale fatture", f.money(summary.invoicesTotal)],
    ["Trasferimenti stock", f.money(summary.transfer)], ["Vendite food nette", f.money(summary.netSales)],
    ["GP", <span key="gp" className={gpClass(summary)}>{f.percent(summary.gp)}</span>],
    // Recorded waste explains part of the cost of sales.
    ["Sprechi registrati nel periodo", <span key="waste">{f.money(waste)}{summary.netSales > 0 ? " · " + ((waste / summary.netSales) * 100).toFixed(1) + "%" : ""}</span>]
  ];
  return (
    <>
      <table className="stock-table stock-summary">
        <thead><tr><th>{t("Nome fornitore")}</th><th>{t("Totale")}</th></tr></thead>
        <tbody>
          {supplierTotals(report).map((row) => <tr key={row.supplier}><td>{t(row.supplier) || "—"}</td><td>{f.money(row.total)}</td></tr>)}
          {totals.map(([label, value]) => <tr key={label} className="stock-total"><td>{t(label)}</td><td>{value}</td></tr>)}
        </tbody>
      </table>
      <button className="button button-primary button-small" type="button" onClick={() => openDialog({ kind: "stockReport", id: report.id })}>{t("Vedi dettagli")}</button>
    </>
  );
}
