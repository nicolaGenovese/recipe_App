"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PhotoButton } from "@/components/safety/PhotoButton";
import { flipSign } from "@/lib/kitchen/today";
import { useApp } from "@/state/AppProvider";

export function readStored(key: string): string {
  try { return window.localStorage.getItem(key) ?? ""; } catch { return ""; }
}
export function store(key: string, value: string | null) {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* Private mode: nothing to keep. */ }
}

/** Keeps the tablet screen on while the kitchen screen is open, where the browser allows it. */
export function useWakeLock() {
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

/** The current time, refreshed every minute so a screen left on overnight moves to the new day. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

interface TempProps {
  label: string;
  /** The limit, shown under the label. */
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** Colours the card once a value is written. */
  ok: boolean | null;
  photoId?: string;
  onPhoto: (id: string | undefined) => void;
  requirePhoto: boolean;
}

/**
 * One temperature to write: large number field, a ± key for keypads without a minus, and the
 * thermometer photo. A div, not a label: buttons inside a label would catch taps on the name.
 */
export function KitchenTemp({ label, hint, value, onChange, ok, photoId, onPhoto, requirePhoto }: TempProps) {
  const { t } = useApp();
  const written = value.trim() !== "" && value.trim() !== "-";
  return (
    <div className={"kitchen-reading" + (!written || ok === null ? "" : ok ? " ok" : " out")}>
      <span className="kitchen-reading-name">{label}{hint ? <small>{hint}</small> : null}</span>
      <span className="kitchen-reading-input">
        <button type="button" className="kitchen-sign" aria-label={t("Cambia segno") + " · " + label} onClick={() => onChange(flipSign(value))}>±</button>
        <input type="text" inputMode="decimal" value={value} aria-label={label + " °C"} onChange={(event) => onChange(event.target.value.replace(",", "."))} />
        <span aria-hidden="true">°C</span>
        <PhotoButton big value={photoId} onChange={onPhoto} label={label} needed={requirePhoto && written && !photoId} />
      </span>
    </div>
  );
}

export function KitchenAction({ title, hint, value, onChange }: { title: string; hint: string; value: string; onChange: (value: string) => void }) {
  const { t } = useApp();
  return (
    <label className="kitchen-action">
      <strong>{title}</strong>
      <span>{hint}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("Es. spostato il cibo nel frigo 2, chiamato il tecnico, ricontrollato dopo 30 minuti…")} />
    </label>
  );
}

/** The big save button; until someone is picked at the top it asks for that instead. */
export function KitchenSave({ by, label, onSave }: { by: string; label: string; onSave: () => void }) {
  const { t } = useApp();
  return <button className="kitchen-button kitchen-save" type="button" onClick={onSave} disabled={!by}>{by ? label : t("Scegli chi sta lavorando")}</button>;
}

/** A large on/off choice, for yes/no checks such as packaging and dates. */
export function KitchenToggle({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" className={"kitchen-task" + (checked ? " done" : " off")} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span className="kitchen-check" aria-hidden="true">{checked ? "✓" : "✕"}</span>
      <span className="kitchen-task-main"><strong className="no-strike">{children}</strong></span>
    </button>
  );
}

export interface TodayItem { id: string; time: string; title: string; detail: string; ok: boolean; photos: number }

/** Today's records of one kind; tapping one loads it back into the form to correct it. */
export function KitchenToday({ title, items, activeId, onPick }: { title: string; items: TodayItem[]; activeId: string | null; onPick: (id: string) => void }) {
  const { t } = useApp();
  if (!items.length) return null;
  return (
    <section className="kitchen-today">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className={item.id === activeId ? "active" : ""} onClick={() => onPick(item.id)}>
              <span className="kitchen-today-time">{item.time}</span>
              <span className="kitchen-today-main"><strong>{item.title}</strong><small>{item.detail}{item.photos ? " · 📷 " + item.photos : ""}</small></span>
              <span className={"safety-status" + (item.ok ? " ok" : " bad")}>{t(item.ok ? "OK" : "Fuori limite")}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
