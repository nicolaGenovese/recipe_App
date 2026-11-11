"use client";

import { Pager } from "@/components/ui/bits";
import { deliveryTotal, isDeliveryClosed } from "@/lib/stock/deliveries";
import { useApp } from "@/state/AppProvider";

const PAGE_SIZE = 10;

export function DeliveriesTab() {
  const { data, stockView, setStockView, openDialog, f, t } = useApp();
  const query = stockView.deliveryQuery.trim().toLocaleLowerCase();
  const rows = [...data.stockDeliveries]
    .filter((delivery) => !query || [delivery.invoiceNumber, delivery.supplier, ...delivery.lines.map((line) => line.name)].join(" ").toLocaleLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(stockView.page, pages);

  return (
    <>
      <div className="stock-toolbar">
        <input type="search" value={stockView.deliveryQuery} placeholder={t("Cerca fattura, fornitore, prodotto…")} aria-label={t("Cerca fattura, fornitore, prodotto…")}
          onChange={(event) => setStockView({ deliveryQuery: event.target.value, page: 1 })} />
        <button className="button button-primary" type="button" onClick={() => openDialog({ kind: "stockDelivery" })}>{t("Nuova consegna")}</button>
      </div>
      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead><tr><th>{t("Data")}</th><th>{t("N° fattura")}</th><th>{t("Fornitore")}</th><th>{t("Righe")}</th><th>{t("Totale")}</th><th>{t("Stato")}</th></tr></thead>
          <tbody>
            {rows.length ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((delivery) => {
              const closed = isDeliveryClosed(delivery, data.stockReports);
              return (
                <tr key={delivery.id}>
                  <td>{f.stockDate(delivery.date)}</td>
                  <td><button className="stock-link" type="button" onClick={() => openDialog({ kind: "stockDelivery", id: delivery.id })}>{delivery.invoiceNumber}</button></td>
                  <td>{delivery.supplier || "—"}</td><td>{delivery.lines.length}</td><td>{f.money(deliveryTotal(delivery))}</td>
                  <td><span className={"category-tag" + (closed ? "" : " batch")}>{t(closed ? "In report inviato" : "In corso")}</span></td>
                </tr>
              );
            }) : <tr><td colSpan={6} className="stock-empty">{t(query ? "Nessuna consegna trovata." : "Nessuna consegna registrata: premi Nuova consegna quando arriva una fattura.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager pages={pages} page={page} onPage={(next) => setStockView({ page: next })} />
    </>
  );
}
