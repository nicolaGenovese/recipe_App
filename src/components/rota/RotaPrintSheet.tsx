"use client";

import { createPortal } from "react-dom";
import type { ExportTexts } from "@/components/rota/exports";
import { cellLabel, type RotaFormat } from "@/lib/rota/format";
import { shiftKind, weekTotals } from "@/lib/rota/shifts";
import type { RotaRow } from "@/lib/types";

/** The printed rota. It lives outside the app shell, which print styles hide, and only exists while printing. */
export function RotaPrintSheet({ weekId, rows, format, texts }: { weekId: string; rows: RotaRow[]; format: RotaFormat; texts: ExportTexts }) {
  const totals = weekTotals(rows);
  return createPortal(
    <div className="rota-print">
      <h3>{texts.title}</h3>
      <p>{format.weekLabel(weekId)}</p>
      <table>
        <thead><tr><th>{texts.staff}</th>{format.dayHeads(weekId).map((head) => <th key={head.key}>{head.name} {head.day}</th>)}<th>{texts.total}</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.name}</td>
              {row.shifts.map((value, day) => <td key={day} className={shiftKind(value)}>{cellLabel(value, texts)}</td>)}
              <td>{format.hours(totals.rows[index])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th>{texts.dailyTotal}</th>{totals.days.map((hours, day) => <td key={day}>{format.hours(hours)}</td>)}<td>{format.hours(totals.total)}</td></tr></tfoot>
      </table>
    </div>,
    document.body
  );
}
