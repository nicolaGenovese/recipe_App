"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { RotaPrintSheet } from "@/components/rota/RotaPrintSheet";
import { RotaTable } from "@/components/rota/RotaTable";
import { downloadRotaExcel, downloadRotaPdf, type ExportTexts } from "@/components/rota/exports";
import { makeRotaFormat } from "@/lib/rota/format";
import { payRules } from "@/lib/performance/labour";
import { isEmptyRow, normalizeRows } from "@/lib/rota/shifts";
import { pastWeeks, plannableWeeks, rowsForStaff } from "@/lib/rota/weeks";
import type { RotaRow } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useRotaActions } from "@/state/actions/useRotaActions";

const CLIPBOARD_KEY = "recipe-studio-rota-clipboard";
const SAVE_DELAY = 700;

function readClipboard(): RotaRow[] | null {
  try {
    const saved = localStorage.getItem(CLIPBOARD_KEY);
    return saved ? normalizeRows(JSON.parse(saved)) : null;
  } catch { return null; }
}

type SaveState = "idle" | "pending" | "saving" | "saved";

/** Staff rota: this week and the next three can be edited, earlier weeks are kept as read-only history. */
export function RotaView() {
  const { data, f, t, fmt, notify, openDialog } = useApp();
  const guard = useGuard();
  const { saveWeek, deleteWeek } = useRotaActions();
  const pay = payRules(data.settings);
  const staff = data.settings.staff;
  const format = useMemo(() => makeRotaFormat(f.locale), [f.locale]);
  // The week list follows the calendar; it is worked out again whenever the page is shown.
  const [today] = useState(() => new Date());
  const plannable = plannableWeeks(today);
  const history = pastWeeks(data.rotaWeeks, today);

  const [weekId, setWeekId] = useState(plannable[0]);
  const readOnly = !plannable.includes(weekId);
  const stored = data.rotaWeeks.find((week) => week.id === weekId);
  // Editable weeks show one line per active staff member; past weeks show what was saved.
  const linesFor = (id: string, saved: RotaRow[]) => (plannable.includes(id) ? rowsForStaff(saved, staff) : saved);
  const [rows, setRows] = useState<RotaRow[]>(() => linesFor(weekId, normalizeRows(stored?.rows ?? [])));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [clipboard, setClipboard] = useState<RotaRow[] | null>(null);
  const [printing, setPrinting] = useState(false);
  const pending = useRef<{ weekId: string; rows: RotaRow[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { setClipboard(readClipboard()); }, []);

  // People added, renamed or removed in Settings show up straight away.
  const staffKey = staff.map((member) => member.name + ":" + member.active).join("|");
  useEffect(() => {
    if (!readOnly) setRows((old) => rowsForStaff(old, staff));
    // Runs when the staff list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffKey]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveState("saving");
    const old = data.rotaWeeks.find((week) => week.id === next.weekId);
    const now = new Date().toISOString();
    const saved = await saveWeek({ id: next.weekId, rows: next.rows, createdAt: old?.createdAt ?? now, updatedAt: now });
    setSaveState(pending.current ? "pending" : saved ? "saved" : "idle");
  }, [data.rotaWeeks, saveWeek]);

  // Leaving the page saves whatever is still waiting.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => { void flushRef.current(); }, []);

  function edit(next: RotaRow[]) {
    if (readOnly) return;
    setRows(next);
    pending.current = { weekId, rows: next };
    setSaveState("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY);
  }

  async function openWeek(id: string) {
    await flush();
    const week = data.rotaWeeks.find((row) => row.id === id);
    setWeekId(id);
    setRows(linesFor(id, normalizeRows(week?.rows ?? [])));
    setSaveState("idle");
  }

  const index = plannable.indexOf(weekId);
  const texts: ExportTexts = { title: t("Turni del personale"), staff: t("Staff"), total: t("Ore"), dailyTotal: t("Totale giornaliero"), dayOff: t("Riposo"), holiday: t("Ferie") };

  function copyWeek() {
    const copy = normalizeRows(rows);
    setClipboard(copy);
    try { localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(copy)); } catch { /* The copy still works in this tab. */ }
    notify(fmt(t("Settimana copiata: {0}. Scegli un'altra settimana e incollala."), format.weekLabel(weekId)));
  }

  function pasteWeek() {
    if (!clipboard) return;
    if (rows.some((row) => row.shifts.some(Boolean)) && !window.confirm(t("Sostituire i turni di questa settimana con quelli copiati?"))) return;
    edit(rowsForStaff(normalizeRows(clipboard), staff));
    notify(t("Turni incollati in questa settimana."));
  }

  async function clearWeek() {
    if (!window.confirm(t("Cancellare i turni di questa settimana?"))) return;
    clearTimeout(timer.current);
    pending.current = null;
    if (stored) await deleteWeek(weekId);
    setRows(rowsForStaff([], staff));
    setSaveState("idle");
    notify(t("Settimana svuotata."));
  }

  function print() {
    flushSync(() => setPrinting(true));
    window.print();
    setPrinting(false);
  }

  const status = saveState === "pending" || saveState === "saving" ? t("Salvataggio…") : saveState === "saved" ? t("Salvato") : "";

  return (
    <section className="rota-view">
      <div className="rota-nav">
        <button className="rota-nav-button" type="button" aria-label={t("Settimana precedente")} disabled={readOnly || index <= 0} onClick={guard(() => openWeek(plannable[index - 1]))}>←</button>
        <div className="rota-current" aria-live="polite">
          <p>{readOnly ? t("Storico · sola lettura") : fmt(t("Settimana {0} di {1}"), index + 1, plannable.length)}</p>
          <h2>{format.weekLabel(weekId)}</h2>
        </div>
        <button className="rota-nav-button" type="button" aria-label={t("Settimana successiva")} disabled={readOnly || index >= plannable.length - 1} onClick={guard(() => openWeek(plannable[index + 1]))}>→</button>
      </div>

      <div className="rota-bar">
        <label className="rota-history">
          <span>{t("Storico")}</span>
          <select value={readOnly ? weekId : ""} onChange={(event) => { void guard(() => openWeek(event.target.value || plannable[0]))(); }}>
            <option value="">{history.length ? t("Settimane passate…") : t("Nessuna settimana passata")}</option>
            {history.map((id) => <option key={id} value={id}>{format.weekLabel(id)}</option>)}
          </select>
        </label>
        {readOnly ? <button className="button button-secondary button-small" type="button" onClick={guard(() => openWeek(plannable[0]))}>{t("Torna alla settimana corrente")}</button> : null}
        <span className="rota-status" role="status">{status}</span>
      </div>

      <p className="field-hint rota-hint">{t("Scrivi i turni come 09:00-17:00; per un turno spezzato separa le fasce con una virgola (10:00-14:00, 18:00-22:00). Con ▾ segni riposo o ferie. Le modifiche si salvano da sole.")}</p>

      {!readOnly && !staff.some((member) => member.active) ? (
        <div className="safety-pending"><strong>{t("Nessuna persona in organico.")}</strong><span>{t("Aggiungi il personale e la paga oraria nelle impostazioni.")}</span></div>
      ) : null}
      <RotaTable weekId={weekId} rows={rows} readOnly={readOnly} format={format} onChange={edit} pay={pay} />

      <div className="rota-actions">
        <button className="button button-secondary button-small" type="button" onClick={() => openDialog({ kind: "settings", tab: "staff" })}>{t("Gestisci personale e paghe")}</button>
        <span className="rota-actions-spacer" />
        {readOnly ? null : (
          <>
            <button className="button button-quiet button-small" type="button" onClick={copyWeek}>{t("Copia settimana")}</button>
            <button className="button button-quiet button-small" type="button" disabled={!clipboard} onClick={pasteWeek}>{t("Incolla settimana")}</button>
          </>
        )}
        <button className="button button-quiet button-small" type="button" onClick={() => { downloadRotaPdf(weekId, rows, format, texts); notify(t("PDF scaricato.")); }}>{t("Scarica PDF")}</button>
        <button className="button button-quiet button-small" type="button" onClick={guard(async () => { await downloadRotaExcel(weekId, rows, format, texts); notify(t("File Excel scaricato.")); })}>{t("Scarica Excel")}</button>
        <button className="button button-quiet button-small" type="button" onClick={print}>{t("Stampa")}</button>
        {readOnly ? null : <button className="button button-quiet button-small rota-danger" type="button" onClick={guard(clearWeek)}>{t("Svuota settimana")}</button>}
      </div>

      {printing ? <RotaPrintSheet weekId={weekId} rows={rows.filter((row) => !isEmptyRow(row))} format={format} texts={texts} /> : null}
    </section>
  );
}
