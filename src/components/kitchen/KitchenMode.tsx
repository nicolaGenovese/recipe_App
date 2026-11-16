"use client";

import { useState } from "react";
import { KitchenChecklists } from "@/components/kitchen/KitchenChecklists";
import { KitchenCooking } from "@/components/kitchen/KitchenCooking";
import { KitchenDeliveries } from "@/components/kitchen/KitchenDeliveries";
import { KitchenPrep } from "@/components/kitchen/KitchenPrep";
import { KitchenTemperatures } from "@/components/kitchen/KitchenTemperatures";
import { readStored, store, useNow, useWakeLock } from "@/components/kitchen/parts";
import { KITCHEN_KEY, kitchenPrepLists, slotOf, uncheckedDeliveries } from "@/lib/kitchen/today";
import { dateKey } from "@/lib/num";
import { missingToday } from "@/lib/safety/rules";
import { staffNames } from "@/lib/safety/staff";
import { useApp } from "@/state/AppProvider";

type Panel = "prep" | "temperature" | "cooking" | "delivery" | "checklist";

const BY_KEY = "recipe-studio:kitchen-by";

/** How a tab shows what is left: a red count to do, a grey count of today's records, or a tick. */
type Badge = { count: number; tone: "todo" | "info" | "done" | "none" };

/**
 * Full-screen view for the kitchen tablet: large buttons, today's prep and every food safety record
 * (temperature rounds, cooking and cooling, deliveries, checklists). Whoever is working is picked
 * once and signs every record.
 */
export function KitchenMode() {
  const { data, setView, t, f } = useApp();
  useWakeLock();
  const now = useNow();
  const today = dateKey(now);
  const [panel, setPanel] = useState<Panel>("prep");
  const [by, setBy] = useState(() => readStored(BY_KEY));
  const names = staffNames(data.rotaWeeks, today, data.settings.staff);
  const missing = missingToday(data.safetyLogs, today, data.settings.foodSafety);
  const lists = kitchenPrepLists(data.prepLists, today);
  const prepLeft = lists.reduce((total, list) => total + list.tasks.filter((task) => !task.done).length, 0);
  const missingOf = (kind: string) => missing.filter((key) => key.startsWith(kind + ":")).length;
  const todaysOf = (kind: "cooking" | "delivery") => data.safetyLogs.filter((log) => log.kind === kind && log.date === today).length;
  const pending = uncheckedDeliveries(data.stockDeliveries, data.safetyLogs, today).length;

  const pickBy = (name: string) => { setBy(name); store(BY_KEY, name); };
  // Leaving is remembered on this device: it opens in the normal app until kitchen mode is chosen again.
  const leave = () => store(KITCHEN_KEY, "0");
  const exit = () => { leave(); setView({ filter: "all", menuId: null }); };

  const todo = (count: number): Badge => ({ count, tone: count ? "todo" : "done" });
  const info = (count: number): Badge => ({ count, tone: count ? "info" : "none" });
  const tabs: [Panel, string, Badge][] = [
    ["prep", t("Prep list"), todo(prepLeft)],
    ["temperature", t("Temperature"), todo(missingOf("temperature"))],
    ["cooking", t("Cottura e abbattimento"), info(todaysOf("cooking"))],
    ["delivery", t("Consegne"), pending ? todo(pending) : info(todaysOf("delivery"))],
    ["checklist", t("Checklist"), todo(missingOf("checklist"))]
  ];

  return (
    <div className="kitchen">
      <header className="kitchen-head">
        <div className="kitchen-when">
          <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
          <span>{f.stockDate(today)}</span>
        </div>
        <label className="kitchen-who">
          <span>{t("Chi sta lavorando")}</span>
          <select value={names.includes(by) ? by : by ? "__current" : ""} onChange={(event) => {
            const value = event.target.value;
            if (value === "__other") { const typed = window.prompt(t("Nome")); if (typed?.trim()) pickBy(typed.trim()); }
            else if (value !== "__current") pickBy(value);
          }}>
            <option value="">{t("Scegli…")}</option>
            {names.map((name) => <option key={name} value={name}>{name}</option>)}
            {by && !names.includes(by) ? <option value="__current">{by}</option> : null}
            <option value="__other">{t("Un altro nome…")}</option>
          </select>
        </label>
        <button className="kitchen-exit" type="button" onClick={exit}>{t("Esci dalla modalità cucina")}</button>
      </header>

      <nav className="kitchen-tabs" aria-label={t("Modalità cucina")}>
        {tabs.map(([key, label, badge]) => (
          <button key={key} type="button" className={"kitchen-tab" + (panel === key ? " active" : "")} aria-pressed={panel === key} onClick={() => setPanel(key)}>
            <span>{label}</span>
            {badge.tone === "todo" || badge.tone === "info" ? <span className={"kitchen-badge" + (badge.tone === "info" ? " info" : "")}>{badge.count}</span>
              : badge.tone === "done" ? <span className="kitchen-badge done" aria-label={t("Fatto")}>✓</span> : null}
          </button>
        ))}
      </nav>

      <main className="kitchen-body">
        {panel === "prep" ? <KitchenPrep today={today} onLeave={leave} />
          : panel === "temperature" ? <KitchenTemperatures today={today} by={by} slotNow={slotOf(now)} />
            : panel === "cooking" ? <KitchenCooking today={today} by={by} />
              : panel === "delivery" ? <KitchenDeliveries today={today} by={by} />
                : <KitchenChecklists today={today} by={by} />}
      </main>
    </div>
  );
}
