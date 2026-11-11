"use client";

import { ShiftCell } from "@/components/rota/ShiftCell";
import { dailyLabourCosts, rateOf, rowLabourCost, type PayRules } from "@/lib/performance/labour";
import type { RotaFormat } from "@/lib/rota/format";
import { weekTotals } from "@/lib/rota/shifts";
import { findStaff } from "@/lib/staff";
import type { RotaRow } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

interface Props {
  weekId: string;
  rows: RotaRow[];
  readOnly: boolean;
  format: RotaFormat;
  onChange: (rows: RotaRow[]) => void;
  pay: PayRules;
}

/**
 * The week grid: one line per person, one column per day, hours and pay added up on the right and
 * at the bottom. People and hourly rates come from Settings → Staff; here only the shifts change.
 */
export function RotaTable({ weekId, rows, readOnly, format, onChange, pay }: Props) {
  const { f, t } = useApp();
  const heads = format.dayHeads(weekId);
  const totals = weekTotals(rows);
  const labourTotal = rows.reduce((total, row) => total + rowLabourCost(row, pay), 0);
  const labourByDay = dailyLabourCosts(rows, pay);

  const setShift = (index: number, day: number, value: string) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, shifts: row.shifts.map((shift, d) => (d === day ? value : shift)) } : row)));

  return (
    <div className="stock-table-wrap rota-wrap">
      <table className="stock-table rota-table">
        <thead>
          <tr>
            <th>{t("Staff")}</th>
            {heads.map((head) => <th key={head.key}><span className="rota-day">{head.name}</span><span className="rota-date">{head.day}</span></th>)}
            <th className="rota-total">{t("Ore")}</th>
            <th className="rota-total">{t("Costo")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const member = findStaff(pay.staff, row.name);
            const rate = rateOf(pay, row.name);
            const notes = [member?.role, rate ? f.money(rate) + "/h" : t("paga oraria mancante"),
              member && !member.active ? t("non più in organico") : !member && row.name ? t("non in Personale") : ""].filter(Boolean);
            return (
              <tr key={row.name + ":" + index}>
                <td className="rota-name-cell">
                  <span className="rota-name">{row.name || t("Senza nome")}</span>
                  <small className={"rota-person-meta" + (rate ? "" : " missing")}>{notes.join(" · ")}</small>
                </td>
                {row.shifts.map((shift, day) => (
                  <ShiftCell key={day} value={shift} readOnly={readOnly} onChange={(value) => setShift(index, day, value)} label={heads[day].name + ", " + (row.name || t("Senza nome"))} />
                ))}
                <td className="rota-total">{format.hours(totals.rows[index])}</td>
                <td className="rota-total">{rate ? f.money(rowLabourCost(row, pay)) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t("Totale giornaliero")}</th>
            {totals.days.map((hours, day) => <td key={day}>{format.hours(hours)}</td>)}
            <td className="rota-total rota-grand">{format.hours(totals.total)}</td>
            <td className="rota-total rota-grand">{f.money(labourTotal)}</td>
          </tr>
          <tr className="rota-cost-row">
            <th scope="row">{t("Costo giornaliero")}</th>
            {labourByDay.map((cost, day) => <td key={day}>{f.money(cost)}</td>)}
            <td />
            <td className="rota-total rota-grand">{f.money(labourTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
