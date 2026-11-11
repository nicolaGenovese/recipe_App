"use client";

import { REASON_LABELS } from "@/components/performance/WasteDialog";
import { MetricTile } from "@/components/ui/bits";
import { weekSummary } from "@/lib/performance/summary";
import { makeRotaFormat } from "@/lib/rota/format";
import { WASTE_REASONS } from "@/lib/performance/waste";
import { useApp } from "@/state/AppProvider";

const pct = (value: number | null) => (value === null ? "—" : value.toFixed(1) + "%");

/** Sales, GP, waste and labour for one week on a single page. */
export function SummaryTab({ weekId }: { weekId: string }) {
  const { data, gpRules, f, t, fmt } = useApp();
  const summary = weekSummary(data, weekId);
  const { sales, waste, labour, reportSummary } = summary;
  const actualGp = reportSummary?.gp ?? null;
  const gap = actualGp !== null && sales.theoreticalGp !== null ? actualGp - sales.theoreticalGp : null;

  return (
    <div className="perf-summary">
      <div className="perf-tiles">
        <MetricTile label={t("Vendite nette")} foot={<small>{fmt(t("{0} piatti venduti"), sales.dishes)}</small>}>{f.money(sales.netSales)}</MetricTile>
        <MetricTile label={t("GP teorico")} foot={<small>{t("Dalle ricette, sui piatti venduti")}</small>}>{pct(sales.theoreticalGp)}</MetricTile>
        <MetricTile label={t("GP reale")} foot={<small>{summary.report ? fmt(t("Report {0}: {1} – {2}"), summary.report.number, f.stockDate(summary.report.dateFrom), f.stockDate(summary.report.dateTo)) : t("Nessun report inviato per questa settimana")}</small>}>
          <span className={actualGp !== null && actualGp < gpRules.target ? "perf-bad" : ""}>{pct(actualGp)}</span>
        </MetricTile>
        <MetricTile label={t("Sprechi")} foot={<small>{pct(summary.wastePercent)} {t("delle vendite")}</small>}>{f.money(waste.total)}</MetricTile>
        <MetricTile label={t("Costo del personale")} foot={<small>{pct(summary.labourPercent)} {t("delle vendite")} · {labour.hours.toFixed(1)} h</small>}>{f.money(labour.cost)}</MetricTile>
        <MetricTile label={t("Prime cost")} foot={<small>{pct(summary.primePercent)} · {t("cibo teorico + personale")}</small>}>{f.money(summary.primeCost)}</MetricTile>
      </div>

      <div className="perf-notes">
        {gap !== null ? (
          <p className={gap < -2 ? "perf-warn" : ""}>
            {fmt(t("Il GP reale è {0} punti {1} di quello teorico."), Math.abs(gap).toFixed(1), t(gap < 0 ? "sotto" : "sopra"))}{" "}
            {gap < -2 ? fmt(t("Gli sprechi registrati spiegano {0} della differenza; il resto può venire da porzioni più grandi, prezzi dei fornitori o merce non registrata."), f.money(waste.total)) : null}
          </p>
        ) : null}
        {sales.netSales > 0 && sales.theoreticalCost <= 0 ? <p className="perf-warn">{t("Le ricette vendute non hanno costi degli ingredienti: GP teorico, margini e prime cost non sono affidabili finché non inserisci prezzi e quantità.")}</p> : null}
        {sales.netSales <= 0 ? <p>{t("Inserisci le vendite della settimana per vedere GP teorico e percentuali.")}</p> : null}
        {labour.missingRates.length ? <p className="perf-warn">{fmt(t("Manca il costo orario di: {0}. Inseriscilo nei Turni."), labour.missingRates.join(", "))}</p> : null}
        {sales.unmatched.length ? <p>{fmt(t("Piatti venduti non collegati a una ricetta: {0}."), sales.unmatched.join(", "))}</p> : null}
      </div>

      <section className="perf-days">
        <h4>{t("Costo del personale per giorno")}</h4>
        <div className="stock-table-wrap">
          <table className="stock-table">
            <thead><tr>{makeRotaFormat(f.locale).dayHeads(weekId).map((head) => <th key={head.key}>{head.name} {head.day}</th>)}<th>{t("Totale")}</th></tr></thead>
            <tbody>
              <tr>
                {summary.labourByDay.map((cost, day) => <td key={day} className="stock-value">{f.money(cost)}</td>)}
                <td className="stock-value"><strong>{f.money(labour.cost)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="perf-columns">
        <section>
          <h4>{t("Sprechi per motivo")}</h4>
          <table className="stock-table">
            <tbody>
              {WASTE_REASONS.map((reason) => <tr key={reason}><td>{t(REASON_LABELS[reason])}</td><td className="stock-value">{f.money(waste.byReason[reason])}</td></tr>)}
              <tr className="stock-total"><td>{t("Totale")}</td><td className="stock-value">{f.money(waste.total)}</td></tr>
            </tbody>
          </table>
        </section>
        <section>
          <h4>{t("Cosa si butta di più")}</h4>
          <table className="stock-table">
            <tbody>
              {waste.byItem.slice(0, 6).map((row) => <tr key={row.name}><td>{row.name} <small>×{row.count}</small></td><td className="stock-value">{f.money(row.cost)}</td></tr>)}
              {waste.byItem.length ? null : <tr><td className="safety-empty">{t("Nessuno spreco registrato.")}</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
