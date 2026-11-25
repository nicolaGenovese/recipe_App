"use client";

import { useEffect, useMemo, useState } from "react";
import { KitchenChecklists } from "@/components/kitchen/KitchenChecklists";
import { KitchenCooking } from "@/components/kitchen/KitchenCooking";
import { KitchenDeliveries } from "@/components/kitchen/KitchenDeliveries";
import { KitchenOrders } from "@/components/kitchen/KitchenOrders";
import { KitchenPrep } from "@/components/kitchen/KitchenPrep";
import { KitchenTemperatures } from "@/components/kitchen/KitchenTemperatures";
import { readStored, store, useNow, useWakeLock } from "@/components/kitchen/parts";
import { KITCHEN_KEY, kitchenPrepLists, slotOf, uncheckedDeliveries } from "@/lib/kitchen/today";
import { dateKey } from "@/lib/num";
import { missingToday } from "@/lib/safety/rules";
import { staffNames } from "@/lib/safety/staff";
import { staffAtSite } from "@/lib/staff";
import { useApp } from "@/state/AppProvider";
import { makeChime, useOrdersFeed } from "@/state/useOrdersFeed";

type Panel = "orders" | "prep" | "temperature" | "cooking" | "delivery" | "checklist";

const BY_KEY = "recipe-studio:kitchen-by";
/** Remembered on each device, so a screen fixed at a station opens on it again after a restart. */
export const PANEL_KEY = "recipe-studio:kitchen-panel";
export const STATION_KEY = "recipe-studio:station";
export const ORDERS_ONLY_KEY = "recipe-studio:orders-only";
const SOUND_KEY = "recipe-studio:orders-sound";

/** How a tab shows what is left: a red count to do, a grey count of today's records, or a tick. */
type Badge = { count: number; tone: "todo" | "info" | "done" | "none" };

/**
 * Full-screen view for the kitchen tablet: large buttons, today's prep and every food safety record
 * (temperature rounds, cooking and cooling, deliveries, checklists). Whoever is working is picked
 * once and signs every record.
 */
export function KitchenMode() {
  const { data, setView, t, f, access, can, notify } = useApp();
  useWakeLock();
  const now = useNow();
  const today = dateKey(now);
  const ordersAllowed = can("orders.view");
  const [panel, setPanelState] = useState<Panel>(() => (ordersAllowed && readStored(PANEL_KEY) === "orders" ? "orders" : "prep"));
  const setPanel = (next: Panel) => { setPanelState(next); store(PANEL_KEY, next); };
  const [ordersOnly, setOrdersOnlyState] = useState(() => readStored(ORDERS_ONLY_KEY) === "1");
  const setOrdersOnly = (on: boolean) => { setOrdersOnlyState(on); store(ORDERS_ONLY_KEY, on ? "1" : null); };
  const [station, setStationState] = useState(() => readStored(STATION_KEY));
  const setStation = (id: string) => { setStationState(id); store(STATION_KEY, id || null); };
  const [sound, setSoundState] = useState(() => readStored(SOUND_KEY) !== "0");
  const chime = useMemo(() => makeChime(), []);
  const setSound = (on: boolean) => { setSoundState(on); store(SOUND_KEY, on ? "1" : "0"); if (on) { chime.unlock(); chime.play("new"); } };
  // Orders keep coming while another tab is open, so the badge and the chime work everywhere in kitchen mode.
  const feed = useOrdersFeed(ordersAllowed, (kind) => { if (sound) chime.play(kind); }, (message) => notify(t(message), true));
  // Browsers play sound only after a tap: the first tap on the screen allows it.
  useEffect(() => {
    const unlock = () => chime.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [chime]);
  // A link like ?comande&partita=Forno names the station; it becomes its id once the stations are known.
  useEffect(() => {
    if (!station || feed.config.stations.some((row) => row.id === station)) return;
    const named = feed.config.stations.find((row) => row.name.trim().toLocaleLowerCase() === station.trim().toLocaleLowerCase());
    if (named) setStation(named.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.config.stations, station]);
  // An account linked to a staff member signs as that person; otherwise the name last picked on this device.
  const linked = data.settings.staff.find((member) => member.id === access?.staffId)?.name;
  const [by, setBy] = useState(() => linked || readStored(BY_KEY));
  const names = staffNames(data.rotaWeeks, today, staffAtSite(data.settings.staff, access?.site.id));
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
  const openOrders = feed.orders.filter((order) => order.status === "open").length;
  const tabs: [Panel, string, Badge][] = [
    ...(ordersAllowed ? [["orders", t("Comande"), info(openOrders)] as [Panel, string, Badge]] : []),
    ["prep", t("Prep list"), todo(prepLeft)],
    ["temperature", t("Temperature"), todo(missingOf("temperature"))],
    ["cooking", t("Cottura e abbattimento"), info(todaysOf("cooking"))],
    ["delivery", t("Consegne"), pending ? todo(pending) : info(todaysOf("delivery"))],
    ["checklist", t("Checklist"), todo(missingOf("checklist"))]
  ];

  const who = (
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
  );
  const orders = (
    <KitchenOrders feed={feed} by={by} station={feed.config.stations.some((row) => row.id === station) ? station : ""} onStation={setStation}
      sound={sound} onSound={setSound} ordersOnly={ordersOnly && panel === "orders"} onOrdersOnly={setOrdersOnly} who={ordersOnly ? who : undefined} />
  );

  // A screen for orders only (fixed at the pass or a station): no clock, tabs or other sections.
  if (panel === "orders" && ordersOnly) return <div className="kitchen kitchen-orders-only"><h1 className="visually-hidden">{t("Comande")}</h1>{orders}</div>;

  return (
    <div className="kitchen">
      <h1 className="visually-hidden">{t("Modalità cucina")}</h1>
      <header className="kitchen-head">
        <div className="kitchen-when">
          <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
          <span>{f.stockDate(today)}</span>
        </div>
        {who}
        <button className="kitchen-exit" type="button" onClick={exit} aria-label={t("Esci dalla modalità cucina")}>
          <span className="kitchen-exit-long">{t("Esci dalla modalità cucina")}</span><span className="kitchen-exit-short">{t("Esci|kitchen")}</span>
        </button>
      </header>

      <nav className={"kitchen-tabs" + (ordersAllowed ? " with-orders" : "")} aria-label={t("Modalità cucina")}>
        {tabs.map(([key, label, badge]) => (
          <button key={key} type="button" className={"kitchen-tab" + (panel === key ? " active" : "")} aria-pressed={panel === key} onClick={() => setPanel(key)}>
            <span>{label}</span>
            {badge.tone === "todo" || badge.tone === "info" ? <span className={"kitchen-badge" + (badge.tone === "info" ? " info" : "")}>{badge.count}</span>
              : badge.tone === "done" ? <span className="kitchen-badge done" aria-label={t("Fatto")}>✓</span> : null}
          </button>
        ))}
      </nav>

      <main className="kitchen-body">
        {panel === "orders" ? orders
          : panel === "prep" ? <KitchenPrep today={today} onLeave={leave} />
          : panel === "temperature" ? <KitchenTemperatures today={today} by={by} slotNow={slotOf(now)} />
            : panel === "cooking" ? <KitchenCooking today={today} by={by} />
              : panel === "delivery" ? <KitchenDeliveries today={today} by={by} />
                : <KitchenChecklists today={today} by={by} />}
      </main>
    </div>
  );
}
