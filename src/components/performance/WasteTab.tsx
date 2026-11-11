"use client";

import { REASON_LABELS } from "@/components/performance/WasteDialog";
import { addDays } from "@/lib/num";
import { wasteBetween, wasteCost, wasteTotals } from "@/lib/performance/waste";
import { useApp } from "@/state/AppProvider";

/** The waste register of the week. */
export function WasteTab({ weekId }: { weekId: string }) {
  const { data, openDialog, f, t } = useApp();
  const logs = wasteBetween(data.wasteLogs, weekId, addDays(weekId, 6));
  const totals = wasteTotals(logs);
  return (
    <div className="perf-waste">
      <div className="safety-bar">
        <strong className="perf-waste-total">{t("Totale settimana")}: {f.money(totals.total)}</strong>
        <span className="rota-actions-spacer" />
        <button className="button button-primary button-small" type="button" onClick={() => openDialog({ kind: "waste" })}>{t("Registra spreco")}</button>
      </div>
      <div className="stock-table-wrap">
        <table className="stock-table safety-table">
          <thead><tr><th>{t("Data")}</th><th>{t("Cosa")}</th><th>{t("Quantità")}</th><th>{t("Motivo")}</th><th>{t("Costo")}</th><th>{t("Registrato da")}</th><th>{t("Note")}</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} onClick={() => openDialog({ kind: "waste", id: log.id })}>
                <td>{f.stockDate(log.date)}</td>
                <td>{log.name}</td>
                <td>{log.quantity} {log.unit}</td>
                <td>{t(REASON_LABELS[log.reason])}</td>
                <td className="stock-value">{f.money(wasteCost(log))}</td>
                <td>{log.by}</td>
                <td>{log.notes || "—"}</td>
              </tr>
            ))}
            {logs.length ? null : <tr><td colSpan={7} className="safety-empty">{t("Nessuno spreco registrato.")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
