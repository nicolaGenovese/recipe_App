import { toKitchenOrder } from "@/lib/orders/orders";
import type { OrdersFeed } from "@/lib/orders/types";
import { requireContext } from "@/lib/server/auth/context";
import { handle, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders: the kitchen orders of the chosen site and the screen settings. With
 * ?since=<cursor> only what changed after the last call, so screens can ask every few seconds.
 */
export const GET = handle(async (request: Request) => {
  const { store } = await requireContext(request, "orders.view");
  const since = new URL(request.url).searchParams.get("since");
  const valid = since && !Number.isNaN(Date.parse(since)) ? since : undefined;
  const [{ orders, now }, { config, connection }] = await Promise.all([store.orders.list(valid), store.orders.config()]);
  const feed: OrdersFeed = { orders: orders.map(toKitchenOrder), cursor: now, now, config, connected: Boolean(connection.token && connection.enabled) };
  return json(feed);
});
