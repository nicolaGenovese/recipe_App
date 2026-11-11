"use client";

import { useState } from "react";
import { SupplierSection } from "@/components/stock/reports/SupplierSection";
import { Callout, MetricTile } from "@/components/ui/bits";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { num } from "@/lib/num";
import { gpClass, gpFormula, salesLabel } from "@/lib/stock/gp-text";
import { draftReport, latestSubmitted, summarizeReport, supplierNames, supplierTotals } from "@/lib/stock/report";
import type { StockReport } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";

/** A stock report: editable while it is a draft, read-only once submitted. */
export function StockReportDialog({ id }: { id: string }) {
  const { data, gpRules, f, t, fmt } = useApp();
  const guard = useGuard();
  const actions = useStockActions();
  const [report, setReport] = useState<StockReport | null>(() => actions.prepareReport(id));
  const [invoices, setInvoices] = useState(() => (report?.invoicesTotal ?? "").toString());
  if (!report) return null;

  const editable = report.status === "draft";
  const current: StockReport = { ...report, invoicesTotal: invoices.trim() === "" ? null : num(invoices) };
  const summary = summarizeReport(current, gpRules);
  const totals = supplierTotals(current);
  const last = latestSubmitted(data.stockReports);
  const canReopen = !editable && last?.id === report.id && !draftReport(data.stockReports);
  const period = f.stockDate(report.dateFrom) + " – " + f.stockDate(report.dateTo);

  const setField = (field: "netSales" | "transfer", value: string) => setReport({ ...report, [field]: num(value) });
  const setLine = (itemId: string, field: string, value: number) =>
    setReport((old) => old && { ...old, lines: old.lines.map((line) => (line.itemId === itemId ? { ...line, [field]: value } : line)) });

  return (
    <Dialog size="wide">
      <DialogHeader kicker={t("REPORT STOCK")} title={fmt(t("Stock {0}"), report.number)} subtitle={period + " · " + t("Creato il") + " " + f.stockDate(report.createdAt)} />
      <form id="stockReportForm" onSubmit={(event) => event.preventDefault()}>
        <div className="dialog-body">
          <div className="stock-print-head"><h2>{fmt(t("Stock {0}"), report.number)}</h2><p>{period}</p></div>
          <div className="pill-metrics">
            <MetricTile label={t("Giacenza di apertura")}>{f.money(summary.openingTotal)}</MetricTile>
            <MetricTile label={t("Totale giacenza di chiusura")}>{f.money(summary.closingTotal)}</MetricTile>
            <MetricTile label={t("Costo del venduto")}>{f.money(summary.costOfSales)}</MetricTile>
            <MetricTile label={t("GP")} id="stockSumGp" foot={<small className="field-hint" id="stockSumTarget">{summary.target > 0 ? fmt(t("Obiettivo {0}"), f.percent(summary.target)) : ""}</small>}>
              <span className={gpClass(summary)}>{f.percent(summary.gp)}</span>
            </MetricTile>
          </div>
          <div className="form-grid cols-3 stock-inputs">
            <div className="form-field">
              <label htmlFor="stockSales">{salesLabel(summary.rules, t)}</label>
              <input id="stockSales" type="number" min="0" step="0.01" defaultValue={num(report.netSales)} disabled={!editable} onChange={(event) => setField("netSales", event.target.value)} />
              <small className="field-hint">{summary.rules.salesIncludeVat ? fmt(t("Al netto dell'IVA: {0}"), f.money(summary.netSales)) : ""}</small>
            </div>
            <div className="form-field">
              <label htmlFor="stockTransfer">{t("Trasferimenti stock")}</label>
              <input id="stockTransfer" type="number" step="0.01" defaultValue={num(report.transfer)} disabled={!editable} onChange={(event) => setField("transfer", event.target.value)} />
              <small className="field-hint">{t(summary.rules.includeTransfers ? "Positivo se in entrata, negativo se in uscita." : "Esclusi dal GP nelle impostazioni.")}</small>
            </div>
            <div className="form-field">
              <label htmlFor="stockInvoices">{t("Totale fatture (vuoto = calcolo automatico)")}</label>
              <input id="stockInvoices" type="number" min="0" step="0.01" value={invoices} disabled={!editable} onChange={(event) => setInvoices(event.target.value)} />
              <small className="field-hint">{fmt(t("Calcolo automatico: {0}"), f.money(summary.invoicesAuto))}</small>
            </div>
          </div>
          <Callout title={t("Calcolo")}>{gpFormula(summary.rules, t)}</Callout>
          {editable ? <Callout title={t("Consegne")}>{t("Le consegne registrate sono già incluse. In Qtà fattura inserisci solo eventuali aggiunte a mano.")}</Callout> : null}
          {supplierNames(current.lines).map((supplier, index) => (
            <SupplierSection key={supplier} lines={current.lines} supplier={supplier} total={totals[index].total} editable={editable} onLine={setLine} />
          ))}
        </div>
        <footer className="dialog-footer">
          <div>
            {editable ? <button className="button button-quiet" type="button" onClick={guard(() => actions.deleteDraft(report))}>{t("Elimina bozza")}</button>
              : canReopen ? <button className="button button-quiet" type="button" onClick={guard(() => actions.reopenReport(report))}>{t("Riapri")}</button> : <span />}
          </div>
          <div className="dialog-footer-right">
            <button className="button button-secondary" type="button" onClick={() => window.print()}>{t("Stampa report")}</button>
            {editable ? <>
              <button className="button button-secondary" type="button" onClick={guard(() => actions.saveDraft(current))}>{t("Salva bozza")}</button>
              <button className="button button-primary" type="button" onClick={guard(() => actions.submitReport(current))}>{t("Invia report")}</button>
            </> : null}
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
