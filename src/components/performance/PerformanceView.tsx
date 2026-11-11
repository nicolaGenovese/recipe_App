"use client";

import { useMemo, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { MenuAnalysisTab } from "@/components/performance/MenuAnalysisTab";
import { SalesTab } from "@/components/performance/SalesTab";
import { SummaryTab } from "@/components/performance/SummaryTab";
import { WasteTab } from "@/components/performance/WasteTab";
import { addDays } from "@/lib/num";
import { makeRotaFormat } from "@/lib/rota/format";
import { mondayOf } from "@/lib/rota/weeks";
import { useApp } from "@/state/AppProvider";

type Tab = "summary" | "sales" | "waste" | "menu";
const TABS: [Tab, string][] = [["summary", "Riepilogo"], ["sales", "Vendite"], ["waste", "Sprechi"], ["menu", "Analisi menu"]];

/** The week in numbers: sales, theoretical and actual GP, waste and labour. */
export function PerformanceView() {
  const { f, t } = useApp();
  const format = useMemo(() => makeRotaFormat(f.locale), [f.locale]);
  const [thisWeek] = useState(() => mondayOf(new Date()));
  const [weekId, setWeekId] = useState(thisWeek);
  const [tab, setTab] = useState<Tab>("summary");
  const [printing, setPrinting] = useState(false);

  function print() {
    flushSync(() => setPrinting(true));
    window.print();
    setPrinting(false);
  }

  return (
    <section className="perf-view">
      <div className="rota-nav">
        <button className="rota-nav-button" type="button" aria-label={t("Settimana precedente")} onClick={() => setWeekId(addDays(weekId, -7))}>←</button>
        <div className="rota-current">
          <p>{weekId === thisWeek ? t("Questa settimana") : weekId < thisWeek ? t("Settimana passata") : t("Settimana futura")}</p>
          <h2>{format.weekLabel(weekId)}</h2>
        </div>
        <button className="rota-nav-button" type="button" aria-label={t("Settimana successiva")} onClick={() => setWeekId(addDays(weekId, 7))}>→</button>
      </div>
      <div className="stock-head">
        <div className="editor-tabs stock-tabs">
          {TABS.map(([key, label]) => <button key={key} type="button" className={"editor-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>{t(label)}</button>)}
        </div>
        <div>
          {weekId !== thisWeek ? <button className="button button-quiet button-small" type="button" onClick={() => setWeekId(thisWeek)}>{t("Torna alla settimana corrente")}</button> : null}
          {tab === "summary" ? <button className="button button-quiet button-small" type="button" onClick={print}>{t("Stampa")}</button> : null}
        </div>
      </div>
      {/* Keys reset the editors when the week changes. */}
      {tab === "summary" ? <SummaryTab weekId={weekId} /> : null}
      {tab === "sales" ? <SalesTab key={weekId} weekId={weekId} /> : null}
      {tab === "waste" ? <WasteTab weekId={weekId} /> : null}
      {tab === "menu" ? <MenuAnalysisTab weekId={weekId} /> : null}
      {printing ? createPortal(
        <div className="perf-print">
          <h3>{t("Riepilogo settimanale")}</h3>
          <p>{format.weekLabel(weekId)}</p>
          <SummaryTab weekId={weekId} />
        </div>, document.body) : null}
    </section>
  );
}
