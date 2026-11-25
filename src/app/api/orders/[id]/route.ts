import { toKitchenOrder } from "@/lib/orders/orders";
import type { ReadyMark } from "@/lib/orders/types";
import { requireContext } from "@/lib/server/auth/context";
import { handle, json, readJson } from "@/lib/server/http";
import type { KitchenChange } from "@/lib/server/store/types";
import { HttpError, assertId } from "@/lib/server/validation";

type Body = { action?: string; by?: unknown; keys?: unknown; ready?: unknown };

/**
 * POST /api/orders/{id} { action, by, keys, ready }: what a kitchen screen does to an order.
 * "claim" / "unclaim" (I'll take it), "lines" (ready or not, by line key), "bump" (ready, off the
 * screen), "recall" (back on the screen), "seen" (a cancelled order was noticed).
 */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { store } = await requireContext(request, "orders.view");
  const id = assertId(decodeURIComponent((await params).id));
  const body = (await readJson(request)) as Body;
  const by = typeof body.by === "string" ? body.by.trim().slice(0, 60) : "";
  const at = new Date().toISOString();
  let change: KitchenChange;
  switch (body.action) {
    case "claim":
      if (!by) throw new HttpError(400, "Scegli chi sta lavorando.");
      change = { claim: { by, at } };
      break;
    case "unclaim":
      change = { claim: null };
      break;
    case "lines": {
      const keys = (Array.isArray(body.keys) ? body.keys : []).filter((key): key is string => typeof key === "string" && Boolean(key)).slice(0, 300).map((key) => key.slice(0, 220));
      if (!keys.length) throw new HttpError(400, "Nessuna riga indicata.");
      const mark: ReadyMark = { at, by };
      change = body.ready === false ? { unready: keys } : { ready: Object.fromEntries(keys.map((key) => [key, mark])) };
      break;
    }
    case "bump":
      change = { status: "done", done: { at, by } };
      break;
    case "recall":
      change = { status: "open", done: null };
      break;
    case "seen":
      change = { seen: true };
      break;
    default:
      throw new HttpError(400, "Operazione non riconosciuta.");
  }
  const order = await store.orders.kitchen(id, change);
  if (!order) throw new HttpError(404, "Comanda non trovata.");
  return json(toKitchenOrder(order));
});
