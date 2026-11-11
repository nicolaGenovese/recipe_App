"use client";

import { useState } from "react";
import { MetricTile } from "@/components/ui/bits";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { CheckPill, Datalist, TextField } from "@/components/ui/Field";
import { dateKey, newId, num } from "@/lib/num";
import { isDeliveryClosed } from "@/lib/stock/deliveries";
import { findStockItemByName } from "@/lib/stock/sources";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";

interface Row { key: string; name: string; quantity: string; price: string }

const blankRow = (): Row => ({ key: newId(), name: "", quantity: "", price: "" });

/** Goods received with an invoice. Quantities add to the open report and to stock on hand. */
export function StockDeliveryDialog({ id }: { id?: string }) {
  const { data, closeDialog, openDialog, f, t } = useApp();
  const guard = useGuard();
  const { saveDelivery, deleteDelivery } = useStockActions();
  const base = id ? data.stockDeliveries.find((row) => row.id === id) ?? null : null;
  const closed = Boolean(base) && isDeliveryClosed(base!, data.stockReports);

  const [invoiceNumber, setInvoiceNumber] = useState(base?.invoiceNumber ?? "");
  const [date, setDate] = useState(base?.date ?? dateKey(new Date()));
  const [supplier, setSupplier] = useState(base?.supplier ?? "");
  const [invoiceAmount, setInvoiceAmount] = useState(base?.invoiceAmount === null || base?.invoiceAmount === undefined ? "" : String(base.invoiceAmount));
  const [updatePrices, setUpdatePrices] = useState(true);
  const [rows, setRows] = useState<Row[]>(() => base?.lines.length
    ? base.lines.map((line) => ({ key: newId(), name: line.name, quantity: String(line.quantity), price: String(line.price) }))
    : [blankRow(), blankRow(), blankRow()]);

  const suppliers = Array.from(new Set(data.stockItems.map((row) => row.supplier).filter(Boolean)));
  // Suggest the supplier's products first, or everything when the supplier has none yet.
  const own = data.stockItems.filter((item) => (item.supplier || "").toLocaleLowerCase() === supplier.trim().toLocaleLowerCase());
  const linesTotal = rows.reduce((total, row) => total + num(row.quantity) * num(row.price), 0);

  function changeRow(key: string, change: Partial<Row>) {
    setRows((old) => old.map((row) => {
      if (row.key !== key) return row;
      const next = { ...row, ...change };
      if (change.name === undefined) return next;
      // Picking a known product fills its price, and the supplier if none was typed yet.
      const item = findStockItemByName(data.stockItems, change.name);
      const before = findStockItemByName(data.stockItems, row.name);
      if (item && item.id !== before?.id) {
        next.price = String(num(item.price));
        if (!supplier.trim() && item.supplier) setSupplier(item.supplier);
      }
      return next;
    }));
  }

  const submit = guard(() => saveDelivery({
    base, invoiceNumber: invoiceNumber.trim(), date: date.trim(), supplier: supplier.trim(), invoiceAmount: invoiceAmount.trim(), updatePrices,
    rows: rows.map((row) => ({ name: row.name.trim(), quantity: num(row.quantity), price: num(row.price) }))
  }));

  return (
    <Dialog size="wide">
      <DialogHeader kicker={t("CONSEGNA MERCE")} title={t(base ? "Dettaglio consegna" : "Nuova consegna")}
        subtitle={closed ? t("Questa consegna è inclusa in un report inviato: per modificarla riapri il report.") : t("Registra le quantità ricevute: si sommano al report e alla giacenza.")} />
      <form id="stockDeliveryForm" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <fieldset className="stock-fieldset" disabled={closed}>
          <div className="dialog-body">
            <div className="form-grid cols-3">
              <TextField label={t("N° fattura *")} name="invoiceNumber" value={invoiceNumber} onChange={setInvoiceNumber} />
              <TextField label={t("Data consegna *")} name="date" type="date" value={date} onChange={setDate} />
              <TextField label={t("Fornitore")} name="supplier" value={supplier} onChange={setSupplier} list="stockDeliverySuppliers" />
            </div>
            <div className="stock-table-wrap stock-delivery-wrap">
              <table className="stock-table stock-lines stock-delivery-lines">
                <thead><tr>{["Prodotto", "Quantità ricevuta", "Unità di vendita", "Prezzo", "Totale", ""].map((label) => <th key={label}>{label ? t(label) : ""}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row) => {
                    const item = findStockItemByName(data.stockItems, row.name);
                    return (
                      <tr key={row.key}>
                        <td><input list="stockDeliveryProducts" value={row.name} aria-label={t("Prodotto")} onChange={(event) => changeRow(row.key, { name: event.target.value })} /></td>
                        <td><input type="number" min="0" step="0.01" value={row.quantity} aria-label={t("Quantità ricevuta")} onChange={(event) => changeRow(row.key, { quantity: event.target.value })} /></td>
                        <td>{t(item?.unitOfSale || "")}</td>
                        <td><input type="number" min="0" step="0.01" value={row.price} aria-label={t("Prezzo")} onChange={(event) => changeRow(row.key, { price: event.target.value })} /></td>
                        <td className="stock-value">{f.money(num(row.quantity) * num(row.price))}</td>
                        <td><button className="card-action" type="button" aria-label={t("Rimuovi")} onClick={() => setRows((old) => old.filter((other) => other.key !== row.key))}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="button button-secondary button-small stock-add-line" type="button" onClick={() => setRows((old) => [...old, blankRow()])}>{t("Aggiungi riga")}</button>
            <div className="form-grid cols-3 stock-delivery-totals">
              <TextField label={t("Importo fattura, IVA esclusa")} name="invoiceAmount" type="number" step="0.01" value={invoiceAmount} onChange={setInvoiceAmount}
                hint={t("Facoltativo: se lo inserisci, nel report vale questo importo al posto del totale righe.")} />
              <MetricTile label={t("Totale righe")}>{f.money(linesTotal)}</MetricTile>
              <MetricTile label={t("Differenza")}>{invoiceAmount.trim() === "" ? "—" : f.money(num(invoiceAmount) - linesTotal)}</MetricTile>
            </div>
            <CheckPill checked={updatePrices} onChange={setUpdatePrices}>{t("Aggiorna il prezzo dei prodotti con quello di questa fattura")}</CheckPill>
            <Datalist id="stockDeliverySuppliers" values={suppliers} />
            <Datalist id="stockDeliveryProducts" values={(own.length ? own : data.stockItems).map((item) => item.name)} />
          </div>
        </fieldset>
        <footer className="dialog-footer">
          <div>
            {!base || closed ? null : <button className="button button-quiet" type="button" onClick={guard(() => deleteDelivery(base))}>{t("Elimina consegna")}</button>}
            {base ? (
              <button className="button button-quiet" type="button" onClick={() => {
                const check = data.safetyLogs.find((log) => log.kind === "delivery" && log.deliveryId === base.id);
                openDialog(check ? { kind: "safetyDelivery", id: check.id } : { kind: "safetyDelivery", deliveryId: base.id });
              }}>{t(data.safetyLogs.some((log) => log.kind === "delivery" && log.deliveryId === base.id) ? "Vedi controllo all'arrivo" : "Controllo all'arrivo")}</button>
            ) : null}
          </div>
          <div className="dialog-footer-right">
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t(closed ? "Chiudi" : "Annulla")}</button>
            {closed ? null : <button className="button button-primary" type="submit">{t("Salva consegna")}</button>}
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
