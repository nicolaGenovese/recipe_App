import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { normalizeOrdersConfig } from "@/lib/orders/orders";
import type { OrdersConfig, PosConnection, PosEventRow, PosSale, PosSalesRow, StoredOrder } from "@/lib/orders/types";
import { mergeItems } from "@/lib/server/store/neon-orders";
import type { OrderStore } from "@/lib/server/store/types";

/** Till data of the single local kitchen, in a file next to the archive (recipes.json → recipes.orders.json). */
interface OrdersFile {
  config: OrdersConfig;
  connection: PosConnection;
  orders: StoredOrder[];
  events: (PosEventRow & { id: string; key: string })[];
  sales: PosSale[];
}

const HOUR = 3_600_000;

export const ordersFileOf = (file: string) => file.replace(/\.json$/i, "") + ".orders.json";

async function read(file: string): Promise<OrdersFile> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<OrdersFile>;
    return {
      config: normalizeOrdersConfig(parsed.config),
      connection: { token: parsed.connection?.token ?? null, signingSecret: parsed.connection?.signingSecret ?? "", enabled: parsed.connection?.enabled !== false },
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : []
    };
  } catch {
    return { config: normalizeOrdersConfig(null), connection: { token: null, signingSecret: "", enabled: true }, orders: [], events: [], sales: [] };
  }
}

/** Old orders and notices are dropped on each write, so the file stays small. */
async function write(file: string, data: OrdersFile) {
  const now = Date.now();
  data.orders = data.orders.filter((order) => now - Date.parse(order.updatedAt) < (order.status === "open" ? 48 : 24) * HOUR);
  data.events = data.events.slice(0, 500);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + ".tmp", JSON.stringify(data, null, 2), "utf8");
  await rename(file + ".tmp", file);
}

/** The Monday of a day, as YYYY-MM-DD. */
const mondayOf = (day: string) => {
  const at = new Date(day + "T12:00:00Z");
  at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7));
  return at.toISOString().slice(0, 10);
};

/** Till sales added up like the Neon queries: by week (or day) and dish. */
export function localSalesRows(sales: PosSale[], period: "week" | "day"): PosSalesRow[] {
  const rows = new Map<string, PosSalesRow>();
  for (const sale of sales) for (const line of sale.lines) {
    const key = [period === "week" ? mondayOf(sale.day) : sale.day, line.name, line.plu ?? "", line.category ?? ""].join("|");
    const row = rows.get(key) ?? { period: period === "week" ? mondayOf(sale.day) : sale.day, name: line.name, plu: line.plu ?? "", category: line.category ?? "", quantity: 0, revenue: 0, unpriced: 0 };
    row.quantity += line.quantity;
    if (line.total === null || line.total === undefined) row.unpriced += 1;
    else row.revenue += line.total;
    rows.set(key, row);
  }
  return Array.from(rows.values());
}

export async function readLocalOrders(file: string) {
  return read(ordersFileOf(file));
}

/** The local kitchen's till orders. Changes run one after another, like the archive. */
export function localOrders(archive: string): OrderStore {
  const file = ordersFileOf(archive);
  let queue: Promise<unknown> = Promise.resolve();
  const change = <T>(apply: (data: OrdersFile) => T): Promise<T> => {
    const next = queue.then(async () => {
      const data = await read(file);
      const result = apply(data);
      await write(file, data);
      return result;
    });
    queue = next.catch(() => undefined);
    return next;
  };
  const stamp = () => new Date().toISOString();

  return {
    async config() { const data = await read(file); return { config: data.config, connection: data.connection }; },
    saveConfig: (config) => change((data) => { data.config = config; }),
    saveConnection: (connection) => change((data) => { data.connection = connection; }),
    async list(since) {
      const data = await read(file);
      const now = Date.now();
      const orders = data.orders.filter((order) => since
        ? Date.parse(order.updatedAt) > Date.parse(since) - 5000
        : (order.status === "open" && now - Date.parse(order.updatedAt) < 12 * HOUR) || now - Date.parse(order.updatedAt) < HOUR);
      return { orders, now: new Date(now).toISOString() };
    },
    async get(id) { return (await read(file)).orders.find((order) => order.id === id) ?? null; },
    putPos: (id, pos, status, version) => change((data) => {
      const index = data.orders.findIndex((order) => order.id === id);
      if (version === 0) {
        if (index >= 0) return false;
        data.orders.push({ id, status: status ?? "open", pos, kitchen: {}, version: 1, updatedAt: stamp() });
        return true;
      }
      if (index < 0 || data.orders[index].version !== version) return false;
      const order = data.orders[index];
      data.orders[index] = { ...order, pos, status: status ?? order.status, version: order.version + 1, updatedAt: stamp() };
      return true;
    }),
    kitchen: (id, change_) => change((data) => {
      const order = data.orders.find((row) => row.id === id);
      if (!order) return null;
      const kitchen = { ...order.kitchen, lines: { ...(order.kitchen.lines ?? {}) } };
      if (change_.claim === null) { delete kitchen.claimedBy; delete kitchen.claimedAt; }
      else if (change_.claim) { kitchen.claimedBy = change_.claim.by; kitchen.claimedAt = change_.claim.at; }
      for (const key of change_.unready ?? []) delete kitchen.lines[key];
      Object.assign(kitchen.lines, change_.ready ?? {});
      if (change_.done === null) { delete kitchen.doneAt; delete kitchen.doneBy; }
      else if (change_.done) { kitchen.doneAt = change_.done.at; kitchen.doneBy = change_.done.by; }
      if (change_.seen) kitchen.seen = true;
      order.kitchen = kitchen;
      if (change_.status) order.status = change_.status;
      order.updatedAt = stamp();
      return order;
    }),
    logEvent: (key, body) => change((data) => {
      if (data.events.some((event) => event.key === key)) return null;
      const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
      data.events.unshift({ id, key, at: stamp(), kind: "", ok: null, summary: "", body });
      return id;
    }),
    finishEvent: (rowId, kind, ok, summary) => change((data) => {
      const event = data.events.find((row) => row.id === rowId);
      if (event) Object.assign(event, { kind, ok, summary });
    }),
    dropEvent: (rowId) => change((data) => { data.events = data.events.filter((row) => row.id !== rowId); }),
    async events(limit) { return (await read(file)).events.slice(0, limit).map(({ id: _id, key: _key, ...row }) => row); },
    async getSale(receiptId) { return (await read(file)).sales.find((sale) => sale.receiptId === receiptId) ?? null; },
    saveSale: (sale) => change((data) => { data.sales = [...data.sales.filter((row) => row.receiptId !== sale.receiptId), sale]; }),
    async items(days) {
      const data = await read(file);
      const from = Date.now() - days * 24 * HOUR;
      const rows = [
        ...data.orders.filter((order) => !order.pos.test && Date.parse(order.updatedAt) > from).flatMap((order) => order.pos.lines),
        ...data.sales.filter((sale) => Date.parse(sale.day) > from).flatMap((sale) => sale.lines)
      ].map((line) => ({ name: line.name, plu: line.plu ?? "", category: line.category ?? "", count: 1 }));
      return mergeItems(rows);
    }
  };
}
