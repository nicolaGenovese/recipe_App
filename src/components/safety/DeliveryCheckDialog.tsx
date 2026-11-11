"use client";

import { useState } from "react";
import { ActionField, StaffField, TempInput, nowTime, tempText, tempValue } from "@/components/safety/fields";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { CheckPill, FieldShell, TextAreaField, TextField } from "@/components/ui/Field";
import { dateKey } from "@/lib/num";
import { deliveryOk } from "@/lib/safety/rules";
import type { DeliveryCheckLog } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

/** Checks on goods arriving: temperatures, packaging, dates and anything sent back. Linked to the delivery when there is one. */
export function DeliveryCheckDialog({ id, deliveryId }: { id?: string; deliveryId?: string }) {
  const { data, closeDialog, t, fmt } = useApp();
  const guard = useGuard();
  const { saveLog, deleteLog } = useSafetyActions();
  const rules = data.settings.foodSafety;
  const base = data.safetyLogs.find((log): log is DeliveryCheckLog => log.id === id && log.kind === "delivery");
  const delivery = data.stockDeliveries.find((row) => row.id === (base?.deliveryId ?? deliveryId));

  const [date, setDate] = useState(base?.date ?? delivery?.date ?? dateKey(new Date()));
  const [time, setTime] = useState(base?.time ?? nowTime());
  const [supplier, setSupplier] = useState(base?.supplier ?? delivery?.supplier ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(base?.invoiceNumber ?? delivery?.invoiceNumber ?? "");
  const [chilled, setChilled] = useState(tempText(base?.chilledTemperature));
  const [frozen, setFrozen] = useState(tempText(base?.frozenTemperature));
  const [packagingOk, setPackagingOk] = useState(base?.packagingOk ?? true);
  const [datesOk, setDatesOk] = useState(base?.datesOk ?? true);
  const [rejected, setRejected] = useState(base?.rejected ?? "");
  const [by, setBy] = useState(base?.by ?? "");
  const [action, setAction] = useState(base?.action ?? "");
  const [notes, setNotes] = useState(base?.notes ?? "");

  const draft = { chilledTemperature: tempValue(chilled), frozenTemperature: tempValue(frozen), packagingOk, datesOk };
  const failing = !deliveryOk(draft, rules);

  const submit = guard(() => saveLog({
    id: base?.id, createdAt: base?.createdAt, kind: "delivery", date, time, deliveryId: delivery?.id, supplier: supplier.trim(), invoiceNumber: invoiceNumber.trim(),
    ...draft, rejected, by, action: failing ? action : "", notes
  }));

  return (
    <Dialog size="narrow">
      <DialogHeader kicker={t("SICUREZZA ALIMENTARE")} title={t("Controllo merce in arrivo")}
        subtitle={fmt(t("Refrigerati fino a {0} °C, surgelati fino a {1} °C."), rules.chilledDeliveryMax, rules.frozenDeliveryMax)} />
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="dialog-body">
          <div className="form-grid">
            <TextField label={t("Fornitore")} name="safetySupplier" value={supplier} onChange={setSupplier} />
            <TextField label={t("N° fattura")} name="safetyInvoice" value={invoiceNumber} onChange={setInvoiceNumber} />
            <TextField label={t("Data")} name="safetyDate" type="date" value={date} onChange={setDate} />
            <TextField label={t("Ora")} name="safetyTime" value={time} onChange={setTime} placeholder="08:30" />
            <FieldShell label={t("Refrigerati °C")} htmlFor="safetyChilled" hint={t("Lascia vuoto se non ce ne sono.")}>
              <TempInput value={chilled} onChange={setChilled} invalid={draft.chilledTemperature !== null && draft.chilledTemperature > rules.chilledDeliveryMax} label={t("Refrigerati °C")} />
            </FieldShell>
            <FieldShell label={t("Surgelati °C")} htmlFor="safetyFrozen" hint={t("Lascia vuoto se non ce ne sono.")}>
              <TempInput value={frozen} onChange={setFrozen} invalid={draft.frozenTemperature !== null && draft.frozenTemperature > rules.frozenDeliveryMax} label={t("Surgelati °C")} />
            </FieldShell>
          </div>
          <div className="form-checks safety-checks">
            <CheckPill checked={packagingOk} onChange={setPackagingOk}>{t("Confezioni integre e pulite")}</CheckPill>
            <CheckPill checked={datesOk} onChange={setDatesOk}>{t("Date di scadenza accettabili")}</CheckPill>
          </div>
          <TextAreaField label={t("Merce rifiutata o resa")} name="safetyRejected" value={rejected} onChange={setRejected} placeholder={t("Es. 2 kg pollo a 11 °C, reso al fornitore")} />
          {failing ? <ActionField value={action} onChange={setAction} /> : null}
          <div className="form-grid">
            <StaffField value={by} date={date} onChange={setBy} label={t("Ricevuto da *")} />
            <TextField label={t("Note")} name="safetyNotes" value={notes} onChange={setNotes} />
          </div>
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
