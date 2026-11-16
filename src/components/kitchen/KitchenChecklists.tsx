"use client";

import { useState } from "react";
import { KitchenAction, KitchenSave } from "@/components/kitchen/parts";
import { CHECKLIST_LABELS } from "@/components/safety/ChecklistDialog";
import { nowTime } from "@/components/safety/fields";
import { checklistItems, todaysChecklist } from "@/lib/kitchen/today";
import { newId } from "@/lib/num";
import type { ChecklistKind } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

const LISTS: ChecklistKind[] = ["opening", "closing", "cleaning"];

/** Opening, closing and cleaning checklists; today's record is picked up again, not started over. */
export function KitchenChecklists({ today, by }: { today: string; by: string }) {
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
  const signer = by || record?.by || "";

  const save = guard(() => saveLog({
    id: record?.id ?? draftId, createdAt: record?.createdAt, kind: "checklist", list, date: today, time: nowTime(),
    by: signer, items, action: failing ? action : "", notes: record?.notes ?? ""
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
      {items.length && failing ? <KitchenAction title={t("Voci non fatte")} hint={t("Se salvi così, scrivi perché (azione correttiva) *")} value={action} onChange={setAction} /> : null}
      {items.length ? <KitchenSave by={signer} label={t("Firma e salva")} onSave={save} /> : null}
    </div>
  );
}
