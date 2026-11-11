import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { HttpError, isStockKind, parseStock } from "@/lib/server/validation";

/** POST /api/stock/items | reports | deliveries creates or updates one record. */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ kind: string }> }) => {
  const { kind } = await params;
  if (!isStockKind(kind)) throw new HttpError(404, "Risorsa non trovata.");
  return json(await getStore().saveRecord(kind, parseStock(kind, await readJson(request)) as never));
});
