"use client";

import { CHECKLIST_LABELS } from "@/components/safety/ChecklistDialog";
import { PROCESS_LABELS } from "@/components/safety/CookingDialog";
import { rangeText } from "@/components/safety/TemperatureDialog";
import { logsBetween } from "@/lib/safety/rules";
import type { DeliveryCheckLog } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

interface TableProps { from: string; to: string; print?: boolean }

const temp = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value + " °C");

function Status({ ok }: { ok: boolean }) {
  const { t } = useApp();
  return <span className={"safety-status" + (ok ? " ok" : " bad")}>{t(ok ? "OK" : "Fuori limite")}</span>;
}

function Empty({ span }: { span: number }) {
  const { t } = useApp();
  return <tr><td colSpan={span} className="safety-empty">{t("Nessuna registrazione in questo periodo.")}</td></tr>;
}

export function TemperatureTable({ from, to, print }: TableProps) {
  const { data, openDialog, f, t } = useApp();
  const logs = logsBetween(data.safetyLogs, "temperature", from, to);
  const equipment = data.settings.foodSafety.equipment;
  return (
    <table className="stock-table safety-table">
      <thead>
        <tr><th>{t("Data")}</th><th>{t("Giro")}</th>{equipment.map((item) => <th key={item.id}>{t(item.name)}<small>{rangeText(item)}</small></th>)}<th>{t("Firmato da")}</th><th>{t("Azione correttiva")}</th></tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} className={log.ok ? "" : "safety-bad"} onClick={print ? undefined : () => openDialog({ kind: "safetyTemperature", id: log.id })}>
            <td>{f.stockDate(log.date)} {log.time}</td>
            <td>{t(log.slot === "am" ? "Mattina" : "Sera")}</td>
            {equipment.map((item) => {
              const reading = log.readings.find((row) => row.equipmentId === item.id);
              return <td key={item.id} className={reading && !reading.ok ? "safety-out" : ""}>{temp(reading?.value)}</td>;
            })}
            <td>{log.by}</td>
            <td>{log.action || "—"}</td>
          </tr>
        ))}
        {logs.length ? null : <Empty span={equipment.length + 4} />}
      </tbody>
    </table>
  );
}

export function CookingTable({ from, to, print }: TableProps) {
  const { data, openDialog, f, t } = useApp();
  const logs = logsBetween(data.safetyLogs, "cooking", from, to);
  return (
    <table className="stock-table safety-table">
      <thead><tr><th>{t("Data")}</th><th>{t("Controllo")}</th><th>{t("Piatto o preparazione")}</th><th>{t("Temperatura")}</th><th>{t("Tempi")}</th><th>{t("Esito")}</th><th>{t("Firmato da")}</th><th>{t("Azione correttiva")}</th></tr></thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} className={log.ok ? "" : "safety-bad"} onClick={print ? undefined : () => openDialog({ kind: "safetyCooking", id: log.id })}>
            <td>{f.stockDate(log.date)} {log.time}</td>
            <td>{t(PROCESS_LABELS[log.process])}</td>
            <td>{log.item}</td>
            <td>{log.process === "cool" && log.startTemperature !== null && log.startTemperature !== undefined ? temp(log.startTemperature) + " → " : ""}{temp(log.temperature)}</td>
            <td>{log.process === "cool" ? (log.startTime || "?") + "–" + (log.endTime || "?") : "—"}</td>
            <td><Status ok={log.ok} /></td>
            <td>{log.by}</td>
            <td>{log.action || "—"}</td>
          </tr>
        ))}
        {logs.length ? null : <Empty span={8} />}
      </tbody>
    </table>
  );
}

export function DeliveryChecksTable({ from, to, print }: TableProps) {
  const { data, openDialog, f, t } = useApp();
  const logs = logsBetween(data.safetyLogs, "delivery", from, to);
  const checked = new Map(data.safetyLogs.filter((log): log is DeliveryCheckLog => log.kind === "delivery" && Boolean(log.deliveryId)).map((log) => [log.deliveryId as string, log]));
  // Deliveries registered in Food Stock that have no check yet.
  const unchecked = data.stockDeliveries.filter((delivery) => delivery.date >= from && delivery.date <= to && !checked.has(delivery.id)).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      {!print && unchecked.length ? (
        <div className="safety-pending">
          <strong>{t("Consegne senza controllo")}</strong>
          {unchecked.map((delivery) => (
            <button key={delivery.id} type="button" className="button button-secondary button-small" onClick={() => openDialog({ kind: "safetyDelivery", deliveryId: delivery.id })}>
              {f.stockDate(delivery.date)} · {delivery.supplier || t("Fornitore")} · {delivery.invoiceNumber}
            </button>
          ))}
        </div>
      ) : null}
      <table className="stock-table safety-table">
        <thead><tr><th>{t("Data")}</th><th>{t("Fornitore")}</th><th>{t("N° fattura")}</th><th>{t("Refrigerati")}</th><th>{t("Surgelati")}</th><th>{t("Confezioni")}</th><th>{t("Date")}</th><th>{t("Merce rifiutata")}</th><th>{t("Esito")}</th><th>{t("Ricevuto da")}</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className={log.ok ? "" : "safety-bad"} onClick={print ? undefined : () => openDialog({ kind: "safetyDelivery", id: log.id })}>
              <td>{f.stockDate(log.date)} {log.time}</td>
              <td>{log.supplier || "—"}</td>
              <td>{log.invoiceNumber || "—"}</td>
              <td>{temp(log.chilledTemperature)}</td>
              <td>{temp(log.frozenTemperature)}</td>
              <td>{t(log.packagingOk ? "OK" : "No")}</td>
              <td>{t(log.datesOk ? "OK" : "No")}</td>
              <td>{log.rejected || "—"}</td>
              <td><Status ok={log.ok} /></td>
              <td>{log.by}</td>
            </tr>
          ))}
          {logs.length ? null : <Empty span={10} />}
        </tbody>
      </table>
    </>
  );
}

export function ChecklistTable({ from, to, print }: TableProps) {
  const { data, openDialog, f, t } = useApp();
  const logs = logsBetween(data.safetyLogs, "checklist", from, to);
  return (
    <table className="stock-table safety-table">
      <thead><tr><th>{t("Data")}</th><th>{t("Checklist")}</th><th>{t("Voci fatte")}</th><th>{t("Da fare")}</th><th>{t("Controllato da")}</th><th>{t("Azione correttiva")}</th></tr></thead>
      <tbody>
        {logs.map((log) => {
          const open = log.items.filter((item) => !item.done);
          return (
            <tr key={log.id} className={log.ok ? "" : "safety-bad"} onClick={print ? undefined : () => openDialog({ kind: "safetyChecklist", id: log.id })}>
              <td>{f.stockDate(log.date)} {log.time}</td>
              <td>{t(CHECKLIST_LABELS[log.list])}</td>
              <td>{log.items.length - open.length} / {log.items.length}</td>
              <td>{open.length ? open.map((item) => t(item.label)).join(", ") : "—"}</td>
              <td>{log.by}</td>
              <td>{log.action || "—"}</td>
            </tr>
          );
        })}
        {logs.length ? null : <Empty span={6} />}
      </tbody>
    </table>
  );
}
