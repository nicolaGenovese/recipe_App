"use client";

import { Fragment, useState } from "react";
import { ReportSummaryPanel } from "@/components/stock/reports/ReportSummaryPanel";
import { Pager } from "@/components/ui/bits";
import { addDays, dateKey, num } from "@/lib/num";
import { latestSubmitted } from "@/lib/stock/report";
import type { StockReport } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";

const PAGE_SIZE = 10;

/** The week after the last submitted report, or the last seven days when there is none. */
function defaultPeriod(reports: StockReport[]) {
  const last = latestSubmitted(reports);
  const from = last ? addDays(last.dateTo, 1) : addDays(dateKey(new Date()), -6);
  return { from, to: addDays(from, 6) };
}

export function StatusTag({ report }: { report: StockReport }) {
  const { t } = useApp();
  return <span className={"category-tag" + (report.status === "draft" ? " batch" : "")}>{t(report.status === "draft" ? "Bozza" : "Inviato")}</span>;
}

export function ReportsTab() {
  const { data, stockView, setStockView, f, t, fmt } = useApp();
  const guard = useGuard();
  const { generateReport } = useStockActions();
  const period = defaultPeriod(data.stockReports);
  const [dateFrom, setDateFrom] = useState(period.from);
  const [dateTo, setDateTo] = useState(period.to);

  const reports = [...data.stockReports].sort((a, b) => num(b.number) - num(a.number));
  const pages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const page = Math.min(stockView.page, pages);
  const visible = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggle = (id: string) => setStockView((view) => ({ open: view.open.includes(id) ? view.open.filter((item) => item !== id) : [...view.open, id] }));

  return (
    <>
      <div className="stock-generate">
        <div className="form-field"><label htmlFor="stockDateFrom">{t("Dal")}</label><input id="stockDateFrom" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="stockDateTo">{t("Al")}</label><input id="stockDateTo" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
        <button className="button button-primary" type="button" onClick={guard(() => generateReport(dateFrom, dateTo))}>{t("Genera")}</button>
      </div>
      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead><tr><th>{t("Numero report")}</th><th>{t("Dal")}</th><th>{t("Al")}</th><th>{t("Creato il")}</th><th>{t("Stato")}</th></tr></thead>
          <tbody>
            {visible.length ? visible.map((report) => {
              const open = stockView.open.includes(report.id);
              return (
                <Fragment key={report.id}>
                  <tr>
                    <td><button className="stock-link" type="button" aria-expanded={open} onClick={() => toggle(report.id)}>{fmt(t("Vedi Stock {0}"), report.number)}</button></td>
                    <td>{f.stockDate(report.dateFrom)}</td><td>{f.stockDate(report.dateTo)}</td><td>{f.stockDate(report.createdAt)}</td><td><StatusTag report={report} /></td>
                  </tr>
                  {open ? <tr className="stock-expansion"><td colSpan={5}><ReportSummaryPanel report={report} /></td></tr> : null}
                </Fragment>
              );
            }) : <tr><td colSpan={5} className="stock-empty">{t("Nessun report: scegli il periodo e premi Genera.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager pages={pages} page={page} onPage={(next) => setStockView({ page: next })} />
    </>
  );
}
