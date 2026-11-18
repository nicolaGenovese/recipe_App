"use client";

import { useEffect, useRef, useState } from "react";
import { KitchenAction, KitchenSave, KitchenTemp, KitchenToday, KitchenToggle, type TodayItem } from "@/components/kitchen/parts";
import { ScanInvoiceButton } from "@/components/stock/deliveries/ScanInvoiceButton";
import { nowTime, tempText, tempValue } from "@/components/safety/fields";
import { uncheckedDeliveries } from "@/lib/kitchen/today";
import { newId } from "@/lib/num";
import { photoIdsOf } from "@/lib/safety/photos";
import { deliveryOk } from "@/lib/safety/rules";
import type { DeliveryCheckLog, StockDelivery } from "@/lib/types";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useSafetyActions } from "@/state/actions/useSafetyActions";

const temp = (value: number | null) => (value === null ? "—" : value + " °C");

/** Goods arriving: temperatures with photos, packaging, dates and anything sent back. */
export function KitchenDeliveries({ today, by }: { today: string; by: string }) {
  const { data, health, openDialog, t, fmt, f } = useApp();
  const guard = useGuard();
  const { saveLog } = useSafetyActions();
  const rules = data.settings.foodSafety;
  const requirePhoto = Boolean(rules.requireTemperaturePhotos);

  const [editing, setEditing] = useState<DeliveryCheckLog | null>(null);
  const [draftId, setDraftId] = useState(newId);
  const [deliveryId, setDeliveryId] = useState<string | undefined>();
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [chilled, setChilled] = useState("");
  const [frozen, setFrozen] = useState("");
  const [chilledPhotoId, setChilledPhotoId] = useState<string | undefined>();
  const [frozenPhotoId, setFrozenPhotoId] = useState<string | undefined>();
  const [packagingOk, setPackagingOk] = useState(true);
  const [datesOk, setDatesOk] = useState(true);
  const [rejected, setRejected] = useState("");
  const [action, setAction] = useState("");

  const todays = data.safetyLogs.filter((log): log is DeliveryCheckLog => log.kind === "delivery" && log.date === today).sort((a, b) => b.time.localeCompare(a.time));
  const pending = uncheckedDeliveries(data.stockDeliveries, data.safetyLogs, today);
  const suppliers = Array.from(new Set([...data.stockItems.map((item) => item.supplier), ...data.stockDeliveries.map((delivery) => delivery.supplier)].map((name) => (name || "").trim()).filter(Boolean))).sort();

  // A delivery just registered with the invoice scan is picked for its check straight away.
  const seen = useRef(new Set(pending.map((delivery) => delivery.id)));
  useEffect(() => {
    const fresh = pending.find((delivery) => !seen.current.has(delivery.id));
    pending.forEach((delivery) => seen.current.add(delivery.id));
    if (fresh && !editing) pick(fresh);
    // pick and editing are read at the moment a new delivery shows up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((delivery) => delivery.id).join(",")]);

  const draft = { chilledTemperature: tempValue(chilled), frozenTemperature: tempValue(frozen), packagingOk, datesOk };
  const failing = !deliveryOk(draft, rules);
  const signer = by || editing?.by || "";

  function load(log: DeliveryCheckLog | null) {
    setEditing(log);
    if (!log) setDraftId(newId());
    setDeliveryId(log?.deliveryId);
    setSupplier(log?.supplier ?? "");
    setInvoiceNumber(log?.invoiceNumber ?? "");
    setChilled(tempText(log?.chilledTemperature));
    setFrozen(tempText(log?.frozenTemperature));
    setChilledPhotoId(log?.chilledPhotoId);
    setFrozenPhotoId(log?.frozenPhotoId);
    setPackagingOk(log?.packagingOk ?? true);
    setDatesOk(log?.datesOk ?? true);
    setRejected(log?.rejected ?? "");
    setAction(log?.action ?? "");
  }

  /** Starts the check of a delivery already entered in Food Stock. */
  function pick(delivery: StockDelivery) {
    load(null);
    setDeliveryId(delivery.id);
    setSupplier(delivery.supplier);
    setInvoiceNumber(delivery.invoiceNumber);
  }

  const save = guard(async () => {
    const saved = await saveLog({
      id: editing?.id ?? draftId, createdAt: editing?.createdAt, kind: "delivery", date: editing?.date ?? today, time: editing?.time ?? nowTime(),
      deliveryId, supplier: supplier.trim(), invoiceNumber: invoiceNumber.trim(), ...draft, rejected,
      ...(chilledPhotoId ? { chilledPhotoId } : {}), ...(frozenPhotoId ? { frozenPhotoId } : {}),
      by: signer, action: failing ? action : "", notes: editing?.notes ?? ""
    });
    if (saved) load(null);
  });

  const items: TodayItem[] = todays.map((log) => ({
    id: log.id, time: log.time, title: log.supplier || t("Fornitore"), ok: log.ok, photos: photoIdsOf(log).length,
    detail: [log.invoiceNumber, t("Refrigerati") + " " + temp(log.chilledTemperature), t("Surgelati") + " " + temp(log.frozenTemperature)].filter(Boolean).join(" · ")
  }));

  return (
    <div className="kitchen-deliveries">
      <div className="kitchen-scan">
        {health?.invoiceReader ? <ScanInvoiceButton className="kitchen-button" />
          : <button className="kitchen-button" type="button" onClick={() => openDialog({ kind: "stockDelivery" })}>{t("Registra consegna")}</button>}
        <span>{t(health?.invoiceReader
          ? "Fotografa la fattura: righe e prezzi vanno in Food Stock dopo il tuo controllo, poi qui fai il controllo all'arrivo."
          : "Registra la fattura in Food Stock, poi qui fai il controllo all'arrivo.")}</span>
      </div>
      {pending.length && !editing ? (
        <section className="kitchen-pending">
          <h3>{t("Consegne senza controllo")}</h3>
          <div className="kitchen-chips">
            {pending.map((delivery) => (
              <button key={delivery.id} type="button" className={deliveryId === delivery.id ? "active" : ""} onClick={() => pick(delivery)}>
                {delivery.supplier || t("Fornitore")}{delivery.invoiceNumber ? " · " + delivery.invoiceNumber : ""}{delivery.date !== today ? " · " + f.dateLabel(delivery.date) : ""}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {editing ? (
        <p className="kitchen-hint kitchen-editing">{fmt(t("Stai correggendo il controllo delle {0}."), editing.time)} <button type="button" className="link-button" onClick={() => load(null)}>{t("Nuovo controllo")}</button></p>
      ) : null}
      <div className="kitchen-times">
        <div className="kitchen-field">
          <label htmlFor="kitchenSupplier">{t("Fornitore")}</label>
          <input id="kitchenSupplier" list="kitchenSuppliers" value={supplier} onChange={(event) => setSupplier(event.target.value)} autoComplete="off" />
          <datalist id="kitchenSuppliers">{suppliers.map((name) => <option key={name} value={name} />)}</datalist>
        </div>
        <div className="kitchen-field">
          <label htmlFor="kitchenInvoice">{t("N° fattura")}</label>
          <input id="kitchenInvoice" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} autoComplete="off" />
        </div>
      </div>
      <p className="kitchen-hint">{fmt(t("Refrigerati fino a {0} °C, surgelati fino a {1} °C."), rules.chilledDeliveryMax, rules.frozenDeliveryMax)} {t("Lascia vuoto se non ce ne sono.")}</p>
      <div className="kitchen-readings">
        <KitchenTemp label={t("Refrigerati")} hint={"≤ " + rules.chilledDeliveryMax + " °C"} value={chilled} onChange={setChilled}
          ok={draft.chilledTemperature === null ? null : draft.chilledTemperature <= rules.chilledDeliveryMax} photoId={chilledPhotoId} onPhoto={setChilledPhotoId} requirePhoto={requirePhoto} />
        <KitchenTemp label={t("Surgelati")} hint={"≤ " + rules.frozenDeliveryMax + " °C"} value={frozen} onChange={setFrozen}
          ok={draft.frozenTemperature === null ? null : draft.frozenTemperature <= rules.frozenDeliveryMax} photoId={frozenPhotoId} onPhoto={setFrozenPhotoId} requirePhoto={requirePhoto} />
      </div>
      <div className="kitchen-tasks kitchen-yesno">
        <KitchenToggle checked={packagingOk} onChange={setPackagingOk}>{t("Confezioni integre e pulite")}</KitchenToggle>
        <KitchenToggle checked={datesOk} onChange={setDatesOk}>{t("Date di scadenza accettabili")}</KitchenToggle>
      </div>
      <div className="kitchen-field">
        <label htmlFor="kitchenRejected">{t("Merce rifiutata o resa")}</label>
        <textarea id="kitchenRejected" value={rejected} onChange={(event) => setRejected(event.target.value)} placeholder={t("Es. 2 kg pollo a 11 °C, reso al fornitore")} />
      </div>
      {failing ? <KitchenAction title={t("Fuori limite")} hint={t("Azione correttiva *")} value={action} onChange={setAction} /> : null}
      <KitchenSave by={signer} label={t(editing ? "Salva la correzione" : "Salva controllo")} onSave={save} />
      <KitchenToday title={t("Consegne controllate oggi")} items={items} activeId={editing?.id ?? null} onPick={(id) => load(todays.find((log) => log.id === id) ?? null)} />
    </div>
  );
}
