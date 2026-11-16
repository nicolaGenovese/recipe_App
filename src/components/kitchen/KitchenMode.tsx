"use client";

import { useEffect, useState } from "react";
import { CHECKLIST_LABELS } from "@/components/safety/ChecklistDialog";
import { rangeText } from "@/components/safety/TemperatureDialog";
import { nowTime, tempText, tempValue } from "@/components/safety/fields";
import { KITCHEN_KEY, checklistItems, flipSign, kitchenPrepLists, slotOf, todaysChecklist, todaysTemperature } from "@/lib/kitchen/today";
import { dateKey, newId } from "@/lib/num";
import { leftToPrep, prepProgress } from "@/lib/prep/prep";
import { missingToday, readingOk } from "@/lib/safety/rules";
import { staffNames } from "@/lib/safety/staff";
import type { ChecklistKind } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { usePrepActions } from "@/state/actions/usePrepActions";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

type Panel = "prep" | "temperature" | "checklist";

const BY_KEY = "recipe-studio:kitchen-by";

function readStored(key: string): string {
  try { return window.localStorage.getItem(key) ?? ""; } catch { return ""; }
}
function store(key: string, value: string | null) {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* Private mode: nothing to keep. */ }
}

/** Keeps the tablet screen on while the kitchen screen is open, where the browser allows it. */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<Lock> } };
    let lock: Lock | null = null;
    const ask = () => { if (document.visibilityState === "visible") nav.wakeLock?.request("screen").then((value) => { lock = value; }).catch(() => undefined); };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => { document.removeEventListener("visibilitychange", ask); void lock?.release().catch(() => undefined); };
  }, []);
}

/** Today's date, refreshed every minute so a screen left on overnight moves to the new day. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Full-screen view for the kitchen tablet: large buttons, only today's prep, the temperature rounds
 * and the checklists. Whoever is working is picked once and signs every record.
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

  const pickBy = (name: string) => { setBy(name); store(BY_KEY, name); };
  const exit = () => { store(KITCHEN_KEY, null); setView({ filter: "all", menuId: null }); };

  const tabs: [Panel, string, number][] = [
    ["prep", t("Prep list"), prepLeft],
    ["temperature", t("Temperature"), missingOf("temperature")],
    ["checklist", t("Checklist"), missingOf("checklist")]
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
          <select value={names.includes(by) ? by : by ? "__other" : ""} onChange={(event) => {
            const value = event.target.value;
            if (value === "__other") { const typed = window.prompt(t("Nome")); if (typed?.trim()) pickBy(typed.trim()); }
            else pickBy(value);
          }}>
            <option value="">{t("Scegli…")}</option>
            {names.map((name) => <option key={name} value={name}>{name}</option>)}
            {by && !names.includes(by) ? <option value="__other">{by}</option> : null}
            <option value="__other">{t("Un altro nome…")}</option>
          </select>
        </label>
        <button className="kitchen-exit" type="button" onClick={exit}>{t("Esci dalla modalità cucina")}</button>
      </header>

      <nav className="kitchen-tabs" aria-label={t("Modalità cucina")}>
        {tabs.map(([key, label, count]) => (
          <button key={key} type="button" className={"kitchen-tab" + (panel === key ? " active" : "")} aria-pressed={panel === key} onClick={() => setPanel(key)}>
            <span>{label}</span>
            {count ? <span className="kitchen-badge">{count}</span> : <span className="kitchen-badge done" aria-label={t("Fatto")}>✓</span>}
          </button>
        ))}
      </nav>

      <main className="kitchen-body">
        {panel === "prep" ? <KitchenPrep today={today} /> : panel === "temperature" ? <KitchenTemperatures today={today} by={by} slotNow={slotOf(now)} /> : <KitchenChecklists today={today} by={by} />}
      </main>
    </div>
  );
}

function KitchenPrep({ today }: { today: string }) {
  const { data, setView, t, f, fmt } = useApp();
  const guard = useGuard();
  const { toggleTask } = usePrepActions();
  const lists = kitchenPrepLists(data.prepLists, today);
  const names = new Map(data.recipes.map((recipe) => [recipe.id, recipe.name]));
  const [hideDone, setHideDone] = useState(false);

  if (!lists.length) {
    return (
      <div className="kitchen-empty">
        <p>{t("Nessuna prep list per oggi.")}</p>
        <button className="kitchen-button" type="button" onClick={() => { setView({ filter: "prep" }); }}>{t("Vai alle prep list")}</button>
      </div>
    );
  }
  return (
    <div className="kitchen-prep">
      <label className="kitchen-toggle"><input type="checkbox" checked={hideDone} onChange={(event) => setHideDone(event.target.checked)} /> {t("Nascondi le preparazioni fatte")}</label>
      {lists.map((list) => {
        const { done, total } = prepProgress(list);
        const tasks = hideDone ? list.tasks.filter((task) => !task.done) : list.tasks;
        return (
          <section key={list.id} className="kitchen-card">
            <header className="kitchen-card-head">
              <div>
                <h2>{list.name}</h2>
                <span className={list.date === today ? "" : "kitchen-warn"}>{list.date === today ? f.dateLabel(list.date) : fmt(t("Non è di oggi: {0}"), f.dateLabel(list.date))}</span>
              </div>
              <div className="kitchen-progress"><strong>{done}/{total}</strong><span><i style={{ width: total ? (done / total) * 100 + "%" : 0 }} /></span></div>
            </header>
            <ul className="kitchen-tasks">
              {tasks.map((task) => (
                <li key={task.id}>
                  <button type="button" className={"kitchen-task" + (task.done ? " done" : "")} aria-pressed={task.done} onClick={guard(() => toggleTask(list.id, task.id))}>
                    <span className="kitchen-check" aria-hidden="true">{task.done ? "✓" : ""}</span>
                    <span className="kitchen-task-main">
                      <strong>{task.name || t("Preparazione")}</strong>
                      {task.recipeIds.length || task.notes ? <small>{[task.recipeIds.map((id) => names.get(id) ?? "").filter(Boolean).join(", "), task.notes].filter(Boolean).join(" · ")}</small> : null}
                    </span>
                    {task.quantity ? <span className="kitchen-qty">{leftToPrep(task)} <small>{task.unit}</small></span> : null}
                  </button>
                </li>
              ))}
              {tasks.length ? null : <li className="kitchen-hint">{t(list.tasks.length ? "Tutto fatto." : "Nessuna preparazione.")}</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function KitchenTemperatures({ today, by, slotNow }: { today: string; by: string; slotNow: "am" | "pm" }) {
  const { data, t } = useApp();
  const guard = useGuard();
  const { saveLog } = useSafetyActions();
  const equipment = data.settings.foodSafety.equipment;
  const [slot, setSlot] = useState(slotNow);
  const record = todaysTemperature(data.safetyLogs, today, slot);
  // A new id per round, kept while the form is filled; an existing record keeps its own.
  const [draftId, setDraftId] = useState(newId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [action, setAction] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Opening a round already entered shows its readings, so it can be corrected.
  const key = slot + ":" + (record?.id ?? "new");
  if (loadedFor !== key) {
    setLoadedFor(key);
    setValues(Object.fromEntries((record?.readings ?? []).map((reading) => [reading.equipmentId, tempText(reading.value)])));
    setAction(record?.action ?? "");
    if (!record) setDraftId(newId());
  }

  const readings = equipment.map((item) => {
    const value = tempValue(values[item.id] ?? "");
    return { equipmentId: item.id, name: item.name, value, ok: readingOk(value, item) };
  });
  const failing = readings.some((reading) => !reading.ok);
  const doneSlot = (value: "am" | "pm") => Boolean(todaysTemperature(data.safetyLogs, today, value));

  const save = guard(() => saveLog({
    id: record?.id ?? draftId, createdAt: record?.createdAt, kind: "temperature", date: today, time: record?.time ?? nowTime(), slot,
    by: by || record?.by || "", action: failing ? action : "", notes: record?.notes ?? "", readings
  }));

  if (!equipment.length) return <div className="kitchen-empty"><p>{t("Nessun apparecchio: aggiungili dalle impostazioni della sicurezza alimentare.")}</p></div>;
  return (
    <div className="kitchen-temps">
      <div className="kitchen-segment" role="group" aria-label={t("Giro")}>
        {(["am", "pm"] as const).map((value) => (
          <button key={value} type="button" className={slot === value ? "active" : ""} aria-pressed={slot === value} onClick={() => setSlot(value)}>
            {t(value === "am" ? "Mattina" : "Sera")} {doneSlot(value) ? "✓" : ""}
          </button>
        ))}
      </div>
      {record ? <p className="kitchen-hint">{t("Giro già registrato: puoi correggerlo e salvarlo di nuovo.")}</p> : null}
      <div className="kitchen-readings">
        {readings.map((reading, index) => (
          <label key={reading.equipmentId} className={"kitchen-reading" + (reading.value !== null && !reading.ok ? " out" : reading.value !== null ? " ok" : "")}>
            <span className="kitchen-reading-name">{t(reading.name)}<small>{rangeText(equipment[index])}</small></span>
            <span className="kitchen-reading-input">
              <button type="button" className="kitchen-sign" aria-label={t("Cambia segno")} onClick={() => setValues((old) => ({ ...old, [reading.equipmentId]: flipSign(old[reading.equipmentId] ?? "") }))}>±</button>
              <input type="text" inputMode="decimal" pattern="-?[0-9]*[.,]?[0-9]*" value={values[reading.equipmentId] ?? ""} aria-label={reading.name}
                onChange={(event) => setValues((old) => ({ ...old, [reading.equipmentId]: event.target.value.replace(",", ".") }))} />
              <span aria-hidden="true">°C</span>
            </span>
          </label>
        ))}
      </div>
      {failing ? (
        <label className="kitchen-action">
          <strong>{t("Fuori limite")}</strong>
          <span>{t("Azione correttiva *")}</span>
          <textarea value={action} onChange={(event) => setAction(event.target.value)} placeholder={t("Es. spostato il cibo nel frigo 2, chiamato il tecnico, ricontrollato dopo 30 minuti…")} />
        </label>
      ) : null}
      <button className="kitchen-button kitchen-save" type="button" onClick={save} disabled={!by && !record?.by}>{by || record?.by ? t("Salva temperature") : t("Scegli chi sta lavorando")}</button>
    </div>
  );
}

const LISTS: ChecklistKind[] = ["opening", "closing", "cleaning"];

function KitchenChecklists({ today, by }: { today: string; by: string }) {
  const { data, t } = useApp();
  const guard = useGuard();
  const { saveLog } = useSafetyActions();
  const [list, setList] = useState<ChecklistKind>(() => (new Date().getHours() < 15 ? "opening" : "closing"));
  const record = todaysChecklist(data.safetyLogs, today, list);
  const settingsItems = data.settings.foodSafety.checklists[list];
  const [draftId, setDraftId] = useState(newId);
  const [items, setItems] = useState(() => checklistItems(settingsItems, record));
  const [action, setAction] = useState(record?.action ?? "");
  const [loadedFor, setLoadedFor] = useState(list + ":" + (record?.id ?? "new"));

  const key = list + ":" + (record?.id ?? "new");
  if (loadedFor !== key) {
    setLoadedFor(key);
    setItems(checklistItems(settingsItems, record));
    setAction(record?.action ?? "");
    if (!record) setDraftId(newId());
  }

  const toggle = (index: number) => setItems((old) => old.map((item, at) => (at === index
    ? { ...item, done: !item.done, by: !item.done ? item.by || by : item.by, at: !item.done ? item.at || nowTime() : "" }
    : item)));
  const failing = items.some((item) => !item.done);
  const doneList = (value: ChecklistKind) => Boolean(todaysChecklist(data.safetyLogs, today, value)?.ok);

  const save = guard(() => saveLog({
    id: record?.id ?? draftId, createdAt: record?.createdAt, kind: "checklist", list, date: today, time: nowTime(),
    by: by || record?.by || "", items, action: failing ? action : "", notes: record?.notes ?? ""
  }));

  return (
    <div className="kitchen-checklists">
      <div className="kitchen-segment" role="group" aria-label={t("Checklist")}>
        {LISTS.map((value) => (
          <button key={value} type="button" className={list === value ? "active" : ""} aria-pressed={list === value} onClick={() => setList(value)}>
            {t(CHECKLIST_LABELS[value])} {doneList(value) ? "✓" : ""}
          </button>
        ))}
      </div>
      {items.length ? (
        <ul className="kitchen-tasks">
          {items.map((item, index) => (
            <li key={item.label}>
              <button type="button" className={"kitchen-task" + (item.done ? " done" : "")} aria-pressed={item.done} onClick={() => toggle(index)}>
                <span className="kitchen-check" aria-hidden="true">{item.done ? "✓" : ""}</span>
                <span className="kitchen-task-main"><strong>{t(item.label)}</strong>{item.done ? <small>{[item.by, item.at].filter(Boolean).join(" · ")}</small> : null}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <div className="kitchen-empty"><p>{t("La lista è vuota: aggiungi le voci dalle impostazioni della sicurezza alimentare.")}</p></div>}
      {items.length && failing ? (
        <label className="kitchen-action">
          <strong>{t("Voci non fatte")}</strong>
          <span>{t("Se salvi così, scrivi perché (azione correttiva) *")}</span>
          <textarea value={action} onChange={(event) => setAction(event.target.value)} />
        </label>
      ) : null}
      {items.length ? <button className="kitchen-button kitchen-save" type="button" onClick={save} disabled={!by && !record?.by}>{by || record?.by ? t("Firma e salva") : t("Scegli chi sta lavorando")}</button> : null}
    </div>
  );
}
