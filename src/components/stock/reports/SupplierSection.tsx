"use client";

import { Fragment } from "react";
import { num } from "@/lib/num";
import { BATCH_SUPPLIER, closingValue, linesForSupplier } from "@/lib/stock/report";
import { MEASURE_LABELS } from "@/lib/stock/sources";
import type { ReportLine } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

type LineField = "invoiceQty" | "delivered" | "closing" | "price";

/** One supplier's lines in the report, grouped by department. Inputs keep their own text while typing. */
export function SupplierSection({ lines, supplier, total, editable, onLine }: {
  lines: ReportLine[]; supplier: string; total: number; editable: boolean; onLine: (itemId: string, field: LineField, value: number) => void;
}) {
  const { f, t, fmt } = useApp();
  const rows = linesForSupplier(lines, supplier);
  const batch = supplier === BATCH_SUPPLIER;
  const columns = batch ? 7 : 9;
  const groups = Array.from(new Set(rows.map((row) => row.group || ""))).sort((a, b) => a.localeCompare(b));
  const heads = ["Prodotto", "Apertura", ...(batch ? [] : ["Qtà fattura", "Consegnato (da accettare)"]), "Misura", "Chiusura", "Prezzo", "Unità di vendita", "Valore chiusura"];

  const cell = (line: ReportLine, field: LineField, label: string) => editable
    ? <input type="number" min="0" step="0.01" defaultValue={num(line[field])} aria-label={t(label) + " · " + line.name} onChange={(event) => onLine(line.itemId, field, num(event.target.value))} />
    : f.quantity(line[field]);

  return (
    <section className="stock-supplier">
      <h3>{t(supplier) || "—"}</h3>
      <div className="stock-table-wrap">
        <table className="stock-table stock-lines">
          <thead><tr>{heads.map((label) => <th key={label}>{t(label)}</th>)}</tr></thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group}>
                {group ? <tr className="stock-group"><td colSpan={columns}>{t(group)}</td></tr> : null}
                {rows.filter((row) => (row.group || "") === group).sort((a, b) => a.name.localeCompare(b.name)).map((line) => (
                  <tr key={line.itemId}>
                    <td>{line.name}</td>
                    <td>{f.quantity(line.opening)}</td>
                    {line.batch ? null : <>
                      <td>{cell(line, "invoiceQty", "Qtà fattura")}{num(line.receivedQty) > 0 ? <small className="stock-received">{fmt(t("+{0} da consegne"), f.quantity(line.receivedQty))}</small> : null}</td>
                      <td>{cell(line, "delivered", "Consegnato (da accettare)")}</td>
                    </>}
                    <td>{t(MEASURE_LABELS[line.measurement] || line.measurement || "")}</td>
                    <td>{cell(line, "closing", "Chiusura")}</td>
                    <td>{editable ? cell(line, "price", "Prezzo") : f.money(line.price)}</td>
                    <td>{t(line.unitOfSale)}</td>
                    <td className="stock-value">{f.money(closingValue(line))}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot><tr className="stock-total"><td colSpan={columns - 1}>{t("Totale")}</td><td>{f.money(total)}</td></tr></tfoot>
        </table>
      </div>
    </section>
  );
}
