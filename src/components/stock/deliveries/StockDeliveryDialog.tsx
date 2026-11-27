"use client";

import { useEffect, useRef, useState } from "react";
import { MetricTile } from "@/components/ui/bits";
import { Dialog, DialogHeader } from "@/components/ui/Dialog";
import { CheckPill, Datalist, TextField } from "@/components/ui/Field";
import { matchLine, matchSupplier, type MatchStatus } from "@/lib/invoices/match";
import { prepareInvoiceFiles } from "@/lib/invoices/upload";
import { dateKey, newId, num } from "@/lib/num";
import { api } from "@/state/api";
import { isDeliveryClosed } from "@/lib/stock/deliveries";
import { KIND_LABELS, PRODUCT_KINDS, type ProductKind } from "@/lib/stock/kind";
import { findStockItemByName } from "@/lib/stock/sources";
import { useApp } from "@/state/AppProvider";
import { useGuard } from "@/state/actions/useGuard";
import { useStockActions } from "@/state/actions/useStockActions";

/** What the scanner read for a row: the printed text, how sure the match was and the name it suggested. */
interface RowScan { text: string; status: MatchStatus; suggested: string; oldPrice: number | null }

/** `kind` matters only while the name is not a product yet: it is the kind of the product saving creates. */
interface Row { key: string; name: string; quantity: string; price: string; kind: ProductKind; scan?: RowScan }

const blankRow = (): Row => ({ key: newId(), name: "", quantity: "", price: "", kind: "food" });

/** Goods received with an invoice. Quantities add to the open report and to stock on hand. */
export function StockDeliveryDialog({ id, files: startFiles }: { id?: string; files?: File[] }) {
  const { data, closeDialog, openDialog, notify, health, f, t, fmt } = useApp();
  const guard = useGuard();
  const { saveDelivery, deleteDelivery } = useStockActions();
  const base = id ? data.stockDeliveries.find((row) => row.id === id) ?? null : null;
  // One id for this dialog: a second press on save (or a retry after a slow answer) updates the same
  // delivery instead of saving the invoice again.
  const [draftId] = useState(() => id ?? newId());
  const [saving, setSaving] = useState(false);
  const closed = Boolean(base) && isDeliveryClosed(base!, data.stockReports);

  const [invoiceNumber, setInvoiceNumber] = useState(base?.invoiceNumber ?? "");
  const [date, setDate] = useState(base?.date ?? dateKey(new Date()));
  const [supplier, setSupplier] = useState(base?.supplier ?? "");
  const [invoiceAmount, setInvoiceAmount] = useState(base?.invoiceAmount === null || base?.invoiceAmount === undefined ? "" : String(base.invoiceAmount));
  const [updatePrices, setUpdatePrices] = useState(true);
  const [rows, setRows] = useState<Row[]>(() => base?.lines.length
    ? base.lines.map((line) => ({ key: newId(), name: line.name, quantity: String(line.quantity), price: String(line.price), kind: "food" as ProductKind }))
    : [blankRow(), blankRow(), blankRow()]);

  const fileInput = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const canScan = Boolean(health?.invoiceReader) && !closed;

  // Opened from "Scan invoice": the files were picked with the tap, reading starts at once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !startFiles?.length) return;
    started.current = true;
    void scan(startFiles);
    // Only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // A row read from the invoice keeps the invoice price.
        if (!row.scan) next.price = String(num(item.price));
        if (!supplier.trim() && item.supplier) setSupplier(item.supplier);
      }
      return next;
    }));
  }

  /** Reads the photos, fills the header and replaces the empty rows with the invoice lines, matched to products. */
  async function scan(files: File[]) {
    if (!files.length) return;
    setScanning(true);
    setScanNote("");
    try {
      const invoice = await api.scanInvoice(await prepareInvoiceFiles(files), suppliers);
      const who = matchSupplier(invoice.supplier, suppliers) || supplier;
      if (invoice.invoiceNumber) setInvoiceNumber(invoice.invoiceNumber);
      if (invoice.date) setDate(invoice.date);
      if (who) setSupplier(who);
      if (invoice.netTotal !== null) setInvoiceAmount(String(invoice.netTotal));
      const read: Row[] = invoice.lines.map((line) => {
        const match = matchLine(line, who, data.stockItems);
        const name = match.item?.name ?? line.description;
        return {
          key: newId(), name, quantity: String(line.quantity), price: String(line.unitPrice), kind: line.kind,
          scan: { text: line.description, status: match.status, suggested: name, oldPrice: match.priceChanged ? num(match.item?.price) : null }
        };
      });
      setRows((old) => [...old.filter((row) => row.name.trim() || row.quantity.trim()), ...read]);
      const toCheck = read.filter((row) => row.scan?.status === "check" || row.scan?.oldPrice !== null).length;
      const created = read.filter((row) => row.scan?.status === "new").length;
      setScanNote(read.length
        ? fmt(t("Lette {0} righe: {1} da verificare, {2} prodotti nuovi. Controlla tutto prima di salvare."), read.length, toCheck, created)
        : t("Nessuna riga letta: prova con una foto più nitida o inserisci le righe a mano."));
    } catch (error) {
      notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true);
    } finally {
      setScanning(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /** Status shown under a scanned row; a name the user changed counts as checked. */
  function scanState(row: Row): { kind: "ok" | "check" | "new"; label: string } | null {
    if (!row.scan) return null;
    const item = findStockItemByName(data.stockItems, row.name);
    const read = fmt(t("letto: “{0}”"), row.scan.text);
    if (!item) return { kind: "new", label: t("Prodotto nuovo, verrà creato") + " · " + read };
    const changedPrice = row.scan.oldPrice !== null && row.name === row.scan.suggested;
    if (row.scan.status === "check" && row.name === row.scan.suggested) return { kind: "check", label: t("Verifica il prodotto") + " · " + read };
    if (changedPrice) return { kind: "check", label: fmt(t("Prezzo diverso dall'ultimo ({0})"), f.money(row.scan.oldPrice!)) + " · " + read };
    return { kind: "ok", label: read };
  }

  const submit = guard(async () => {
    if (saving) return;
    setSaving(true);
    try { await saveDelivery({ id: draftId,
    base, invoiceNumber: invoiceNumber.trim(), date: date.trim(), supplier: supplier.trim(), invoiceAmount: invoiceAmount.trim(), updatePrices,
    rows: rows.map((row) => ({ name: row.name.trim(), quantity: num(row.quantity), price: num(row.price), kind: row.kind })),
    invoiceNames: rows.filter((row) => row.scan && row.name.trim()).map((row) => ({ name: row.name.trim(), text: row.scan!.text }))
    }); } finally { setSaving(false); }
  });

  return (
    <Dialog size="wide">
      <DialogHeader kicker={t("CONSEGNA MERCE")} title={t(base ? "Dettaglio consegna" : "Nuova consegna")}
        subtitle={closed ? t("Questa consegna è inclusa in un report inviato: per modificarla riapri il report.") : t("Registra le quantità ricevute: si sommano al report e alla giacenza.")} />
      <form id="stockDeliveryForm" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <fieldset className="stock-fieldset" disabled={closed}>
          <div className="dialog-body">
            {canScan ? (
              <div className={"invoice-scan" + (dragging ? " dragging" : "")}
                onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); if (!scanning) void scan(Array.from(event.dataTransfer.files)); }}>
                <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(event) => void scan(Array.from(event.target.files || []))} />
                <button className="button button-secondary" type="button" disabled={scanning} onClick={() => fileInput.current?.click()}>
                  {scanning ? t("Lettura della fattura…") : t("📷 Scansiona fattura")}
                </button>
                <span className="field-hint">{scanNote || t("Foto o PDF, fino a 5 pagine (puoi anche trascinarli qui): compilo testata e righe, tu controlli e salvi.")}</span>
              </div>
            ) : null}
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
                    const state = scanState(row);
                    return (
                      <tr key={row.key} className={state ? "scan-" + state.kind : undefined}>
                        <td>
                          <input list="stockDeliveryProducts" value={row.name} aria-label={t("Prodotto")} onChange={(event) => changeRow(row.key, { name: event.target.value })} />
                          {state ? <small className={"scan-note " + state.kind}>{state.kind === "ok" ? "✓ " : state.kind === "check" ? "⚠ " : "＋ "}{state.label}</small> : null}
                          {/* A name that is not a product yet: saving creates it, of the kind chosen here. */}
                          {!item && row.name.trim() ? (
                            <select className="delivery-kind" value={row.kind} aria-label={t("Tipo del prodotto nuovo") + " · " + row.name}
                              onChange={(event) => changeRow(row.key, { kind: event.target.value as ProductKind })}>
                              {PRODUCT_KINDS.map((kind) => <option key={kind} value={kind}>{t(KIND_LABELS[kind])}</option>)}
                            </select>
                          ) : null}
                        </td>
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
            {!base || closed ? null : <button className="button button-quiet danger" type="button" onClick={guard(() => deleteDelivery(base))}>{t("Elimina consegna")}</button>}
            {base ? (
              <button className="button button-quiet" type="button" onClick={() => {
                const check = data.safetyLogs.find((log) => log.kind === "delivery" && log.deliveryId === base.id);
                openDialog(check ? { kind: "safetyDelivery", id: check.id } : { kind: "safetyDelivery", deliveryId: base.id });
              }}>{t(data.safetyLogs.some((log) => log.kind === "delivery" && log.deliveryId === base.id) ? "Vedi controllo all'arrivo" : "Controllo all'arrivo")}</button>
            ) : null}
          </div>
          <div className="dialog-footer-right">
            <button className="button button-quiet" type="button" onClick={closeDialog}>{t(closed ? "Chiudi" : "Annulla")}</button>
            {closed ? null : <button className="button button-primary" type="submit" disabled={saving} aria-busy={saving}>{t(saving ? "Salvataggio…" : "Salva consegna")}</button>}
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
