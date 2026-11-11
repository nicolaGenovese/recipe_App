"use client";

import { useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { CHECKLIST_LABELS } from "@/components/safety/ChecklistDialog";
import { ChecklistTable, CookingTable, DeliveryChecksTable, TemperatureTable } from "@/components/safety/SafetyTables";
import { addDays, dateKey } from "@/lib/num";
import { missingToday } from "@/lib/safety/rules";
import type { ChecklistKind } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

type Tab = "temperature" | "cooking" | "delivery" | "checklist";
const TABS: [Tab, string][] = [["temperature", "Temperature"], ["cooking", "Cottura e abbattimento"], ["delivery", "Consegne"], ["checklist", "Checklist e pulizie"]];

/** Food safety records: what is still due today, any failed checks, and one register per kind of check. */
export function SafetyView() {
  const { data, openDialog, f, t, fmt } = useApp();
  const [today] = useState(() => dateKey(new Date()));
  const [tab, setTab] = useState<Tab>("temperature");
  const [from, setFrom] = useState(() => addDays(today, -6));
  const [to, setTo] = useState(today);
  const [printing, setPrinting] = useState(false);

  const rules = data.settings.foodSafety;
  const missing = missingToday(data.safetyLogs, today, rules);
  const failures = data.safetyLogs.filter((log) => !log.ok && log.date >= from && log.date <= to).length;
  const missingLabel = (key: string) => {
    const [kind, value] = key.split(":");
    return kind === "temperature" ? t("Temperature") + " · " + t(value === "am" ? "Mattina" : "Sera") : t("Checklist") + " · " + t(CHECKLIST_LABELS[value as ChecklistKind]);
  };
  const openMissing = (key: string) => {
    const [kind, value] = key.split(":");
    if (kind === "temperature") openDialog({ kind: "safetyTemperature" });
    else openDialog({ kind: "safetyChecklist", list: value as ChecklistKind });
  };

  const table = (print = false) => (
    tab === "temperature" ? <TemperatureTable from={from} to={to} print={print} />
      : tab === "cooking" ? <CookingTable from={from} to={to} print={print} />
        : tab === "delivery" ? <DeliveryChecksTable from={from} to={to} print={print} />
          : <ChecklistTable from={from} to={to} print={print} />
  );
  const addButton = tab === "temperature" ? [t("Registra temperature"), () => openDialog({ kind: "safetyTemperature" })]
    : tab === "cooking" ? [t("Registra controllo"), () => openDialog({ kind: "safetyCooking" })]
      : tab === "delivery" ? [t("Controllo senza fattura"), () => openDialog({ kind: "safetyDelivery" })]
        : null;

  function print() {
    flushSync(() => setPrinting(true));
    window.print();
    setPrinting(false);
  }

  return (
    <section className="safety-view">
      <div className={"safety-today" + (missing.length ? "" : " done")}>
        <div>
          <strong>{missing.length ? t("Da fare oggi") : t("Controlli di oggi completati")}</strong>
          <span>{f.stockDate(today)}</span>
        </div>
        <div className="safety-today-items">
          {missing.map((key) => <button key={key} type="button" className="button button-secondary button-small" onClick={() => openMissing(key)}>{missingLabel(key)}</button>)}
        </div>
        {failures ? <span className="safety-status bad">{fmt(failures === 1 ? t("{0} anomalia nel periodo") : t("{0} anomalie nel periodo"), failures)}</span> : null}
      </div>

      <div className="stock-head">
        <div className="editor-tabs stock-tabs">
          {TABS.map(([key, label]) => <button key={key} type="button" className={"editor-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>{t(label)}</button>)}
        </div>
        <button className="button button-quiet" type="button" onClick={() => openDialog({ kind: "safetySettings" })}>{t("Impostazioni sicurezza")}</button>
      </div>

      <div className="safety-bar">
        <label>{t("Dal")} <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>{t("al")} <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <span className="rota-actions-spacer" />
        {tab === "checklist" ? (Object.keys(CHECKLIST_LABELS) as ChecklistKind[]).map((list) => (
          <button key={list} className="button button-secondary button-small" type="button" onClick={() => openDialog({ kind: "safetyChecklist", list })}>{t("Compila")} · {t(CHECKLIST_LABELS[list])}</button>
        )) : addButton ? <button className="button button-primary button-small" type="button" onClick={addButton[1] as () => void}>{addButton[0] as string}</button> : null}
        <button className="button button-quiet button-small" type="button" onClick={print}>{t("Stampa registro")}</button>
      </div>

      <div className="stock-table-wrap">{table()}</div>
      <p className="field-hint">{t("Clicca una riga per aprirla o correggerla. I controlli fuori limite chiedono sempre l'azione correttiva.")}</p>

      {printing ? createPortal(
        <div className="safety-print">
          <h3>{t("Registro sicurezza alimentare")} · {t(TABS.find(([key]) => key === tab)?.[1] ?? "")}</h3>
          <p>{f.stockDate(from)} – {f.stockDate(to)}</p>
          {table(true)}
        </div>, document.body) : null}
    </section>
  );
}
