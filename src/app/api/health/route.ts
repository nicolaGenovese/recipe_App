import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";
import { getInvoiceReader } from "@/lib/server/invoices/readers";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const store = getStore();
  const health = await store.health();
  return json({ storage: store.mode, ...health, invoiceReader: getInvoiceReader()?.name ?? null });
});
