"use client";

import { useState } from "react";
import { ActionField, StaffField, nowTime } from "@/components/safety/fields";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { Datalist, TextField } from "@/components/ui/Field";
import { dateKey } from "@/lib/num";
import { staffNames } from "@/lib/safety/staff";
import type { ChecklistKind, ChecklistLog } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

export const CHECKLIST_LABELS: Record<ChecklistKind, string> = { opening: "Apertura cucina", closing: "Chiusura cucina", cleaning: "Pulizie" };

/** Opening, closing or cleaning checklist. Each item is signed by whoever did it; the record is signed by who checked the list. */
export function ChecklistDialog({ id, list: startList }: { id?: string; list?: ChecklistKind }) {
  const { data, closeDialog, t } = useApp();
  const guard = useGuard();
  const { saveLog, deleteLog } = useSafetyActions();
  const base = data.safetyLogs.find((log): log is ChecklistLog => log.id === id && log.kind === "checklist");
  const list = base?.list ?? startList ?? "opening";

  const [date, setDate] = useState(base?.date ?? dateKey(new Date()));
  const [time, setTime] = useState(base?.time ?? nowTime());
  const [by, setBy] = useState(base?.by ?? "");
  const [action, setAction] = useState(base?.action ?? "");
  const [notes, setNotes] = useState(base?.notes ?? "");
  const [items, setItems] = useState(() => base?.items ?? data.settings.foodSafety.checklists[list].map((label) => ({ label, done: false, by: "", at: "" })));
  const names = staffNames(data.rotaWeeks, date, data.settings.staff);

  const toggle = (index: number, done: boolean) => setItems((old) => old.map((item, at) => (at === index ? { ...item, done, by: done ? item.by || by : item.by, at: done ? item.at || nowTime() : "" } : item)));
  const setItemBy = (index: number, value: string) => setItems((old) => old.map((item, at) => (at === index ? { ...item, by: value } : item)));
  const failing = items.some((item) => !item.done);

  const submit = guard(() => saveLog({ id: base?.id, createdAt: base?.createdAt, kind: "checklist", list, date, time, by, items, action: failing ? action : "", notes }));

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("SICUREZZA ALIMENTARE")} title={t("Checklist") + " · " + t(CHECKLIST_LABELS[list])} subtitle={t("Spunta ogni voce e scegli chi l'ha fatta.")} />
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="dialog-body">
          <div className="form-grid">
            <TextField label={t("Data")} name="safetyDate" type="date" value={date} onChange={setDate} />
            <TextField label={t("Ora")} name="safetyTime" value={time} onChange={setTime} />
          </div>
          <ul className="safety-checklist">
            {items.map((item, index) => (
              <li key={item.label} className={item.done ? "done" : ""}>
                <label><input type="checkbox" checked={item.done} onChange={(event) => toggle(index, event.target.checked)} /><span>{t(item.label)}</span></label>
                <input className="safety-item-by" list="safetyChecklistStaff" value={item.by} placeholder={t("Chi")} aria-label={t("Chi") + " · " + t(item.label)} onChange={(event) => setItemBy(index, event.target.value)} />
                <small>{item.at}</small>
              </li>
            ))}
          </ul>
          {items.length ? null : <p className="field-hint">{t("La lista è vuota: aggiungi le voci dalle impostazioni della sicurezza alimentare.")}</p>}
          {failing ? <ActionField value={action} onChange={setAction} /> : null}
          <div className="form-grid">
            <StaffField value={by} date={date} onChange={setBy} label={t("Controllato da *")} />
            <TextField label={t("Note")} name="safetyNotes" value={notes} onChange={setNotes} />
          </div>
          <Datalist id="safetyChecklistStaff" values={names} />
        </div>
        <footer className="dialog-footer">
          <div>{base ? <button className="button button-quiet" type="button" onClick={guard(() => deleteLog(base.id))}>{t("Elimina")}</button> : <span />}</div>
          <div className="dialog-footer-right">
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t("Annulla")}</button>
            <button className="button button-primary" type="submit">{t("Salva")}</button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
