import { normalizeOrdersConfig } from "@/lib/orders/orders";
import type { OrderStatus, PosItem, PosOrder, PosSale, PosSalesRow, StoredOrder } from "@/lib/orders/types";
import type { Sql } from "@/lib/server/db";
import type { OrderStore, Scope } from "@/lib/server/store/types";

type Query = ReturnType<Sql>;
type Run = <T>(queries: Query[]) => Promise<T[][]>;

interface OrderRow { id: string; status: string; pos: PosOrder; kitchen: StoredOrder["kitchen"]; version: number; updated_at: string | Date }

const iso = (value: string | Date) => new Date(value).toISOString();
const toOrder = (row: OrderRow): StoredOrder => ({ id: row.id, status: row.status as OrderStatus, pos: row.pos, kitchen: row.kitchen ?? {}, version: Number(row.version), updatedAt: iso(row.updated_at) });

/** How many till notices each site keeps in the log (enough to spot copies sent again). */
const KEEP_EVENTS = 500;

/** Queries for the till sales, added up by week (last 400 days) and by day (last 9 weeks). */
export function posSalesQueries(sql: Sql, siteId: string): Query[] {
  return [
    sql`SELECT to_char(date_trunc('week', s.day::timestamp), 'YYYY-MM-DD') AS period, l->>'name' AS name, coalesce(l->>'plu', '') AS plu, coalesce(l->>'category', '') AS category,
        coalesce(sum((l->>'quantity')::numeric), 0)::float8 AS quantity,
        coalesce(sum(CASE WHEN jsonb_typeof(l->'total') = 'number' THEN (l->>'total')::numeric END), 0)::float8 AS revenue,
        (count(*) FILTER (WHERE jsonb_typeof(l->'total') IS DISTINCT FROM 'number'))::int AS unpriced
      FROM rs_pos_sales s CROSS JOIN LATERAL jsonb_array_elements(s.lines) AS l
      WHERE s.site_id = ${siteId} AND s.day >= current_date - 400 GROUP BY 1, 2, 3, 4`,
    sql`SELECT s.day::text AS period, l->>'name' AS name, coalesce(l->>'plu', '') AS plu, coalesce(l->>'category', '') AS category,
        coalesce(sum((l->>'quantity')::numeric), 0)::float8 AS quantity,
        coalesce(sum(CASE WHEN jsonb_typeof(l->'total') = 'number' THEN (l->>'total')::numeric END), 0)::float8 AS revenue,
        (count(*) FILTER (WHERE jsonb_typeof(l->'total') IS DISTINCT FROM 'number'))::int AS unpriced
      FROM rs_pos_sales s CROSS JOIN LATERAL jsonb_array_elements(s.lines) AS l
      WHERE s.site_id = ${siteId} AND s.day >= current_date - 63 GROUP BY 1, 2, 3, 4`,
    sql`SELECT payload FROM rs_pos_config WHERE site_id = ${siteId}`
  ];
}

export const toSalesRows = (rows: unknown[]): PosSalesRow[] => (rows as PosSalesRow[]).map((row) => ({
  period: String(row.period), name: String(row.name ?? ""), plu: String(row.plu ?? ""), category: String(row.category ?? ""),
  quantity: Number(row.quantity) || 0, revenue: Number(row.revenue) || 0, unpriced: Number(row.unpriced) || 0
}));

/** Till orders and receipts of one site, in Neon, always through the company's row-level security. */
export function neonOrders(sql: Sql, run: Run, { companyId, siteId }: Scope): OrderStore {
  const one = async (id: string) => {
    const [rows] = await run<OrderRow>([sql`SELECT id, status, pos, kitchen, version, updated_at FROM rs_orders WHERE site_id = ${siteId} AND id = ${id}`]);
    return rows[0] ? toOrder(rows[0]) : null;
  };

  return {
    async config() {
      const [rows] = await run<{ token: string | null; signing_secret: string; enabled: boolean; payload: unknown }>([
        sql`SELECT token, signing_secret, enabled, payload FROM rs_pos_config WHERE site_id = ${siteId}`
      ]);
      const row = rows[0];
      return {
        config: normalizeOrdersConfig(row?.payload),
        connection: { token: row?.token ?? null, signingSecret: row?.signing_secret ?? "", enabled: row ? row.enabled : true }
      };
    },
    async saveConfig(config) {
      await run([sql`INSERT INTO rs_pos_config (site_id, company_id, payload, updated_at) VALUES (${siteId}, ${companyId}, ${JSON.stringify(config)}::jsonb, now())
        ON CONFLICT (site_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`]);
    },
    async saveConnection(connection) {
      await run([sql`INSERT INTO rs_pos_config (site_id, company_id, token, signing_secret, enabled, updated_at)
        VALUES (${siteId}, ${companyId}, ${connection.token}, ${connection.signingSecret}, ${connection.enabled}, now())
        ON CONFLICT (site_id) DO UPDATE SET token = EXCLUDED.token, signing_secret = EXCLUDED.signing_secret, enabled = EXCLUDED.enabled, updated_at = now()`]);
    },
    async list(since) {
      // A few seconds of overlap: a change written while the last poll ran is never missed.
      const [rows, clock] = await run<OrderRow & { now?: string }>([
        since
          ? sql`SELECT id, status, pos, kitchen, version, updated_at FROM rs_orders WHERE site_id = ${siteId} AND updated_at > ${since}::timestamptz - interval '5 seconds' ORDER BY created_at`
          : sql`SELECT id, status, pos, kitchen, version, updated_at FROM rs_orders WHERE site_id = ${siteId}
              AND ((status = 'open' AND updated_at > now() - interval '12 hours') OR updated_at > now() - interval '1 hour') ORDER BY created_at`,
        sql`SELECT now() AS now`
      ]);
      return { orders: rows.map(toOrder), now: iso((clock[0] as { now: string }).now) };
    },
    get: one,
    async putPos(id, pos, status, version) {
      const [rows] = await run<{ id: string }>([version === 0
        ? sql`INSERT INTO rs_orders (company_id, site_id, id, external_id, status, pos, version, updated_at)
            VALUES (${companyId}, ${siteId}, ${id}, ${pos.externalId}, ${status ?? "open"}, ${JSON.stringify(pos)}::jsonb, 1, clock_timestamp())
            ON CONFLICT (site_id, id) DO NOTHING RETURNING id`
        : sql`UPDATE rs_orders SET pos = ${JSON.stringify(pos)}::jsonb, status = coalesce(${status ?? null}::text, status), version = version + 1, updated_at = clock_timestamp()
            WHERE site_id = ${siteId} AND id = ${id} AND version = ${version} RETURNING id`]);
      return rows.length > 0;
    },
    async kitchen(id, change) {
      const queries: Query[] = [];
      if (change.claim === null) queries.push(sql`UPDATE rs_orders SET kitchen = kitchen - 'claimedBy' - 'claimedAt', updated_at = clock_timestamp() WHERE site_id = ${siteId} AND id = ${id}`);
      else if (change.claim) queries.push(sql`UPDATE rs_orders SET kitchen = kitchen || jsonb_build_object('claimedBy', ${change.claim.by}::text, 'claimedAt', ${change.claim.at}::text), updated_at = clock_timestamp()
        WHERE site_id = ${siteId} AND id = ${id}`);
      if (change.ready || change.unready) {
        queries.push(sql`UPDATE rs_orders SET kitchen = jsonb_set(kitchen, '{lines}',
            (coalesce(kitchen->'lines', '{}'::jsonb) - ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(change.unready ?? [])}::jsonb))) || ${JSON.stringify(change.ready ?? {})}::jsonb),
          updated_at = clock_timestamp() WHERE site_id = ${siteId} AND id = ${id}`);
      }
      if (change.done === null) queries.push(sql`UPDATE rs_orders SET kitchen = kitchen - 'doneAt' - 'doneBy', updated_at = clock_timestamp() WHERE site_id = ${siteId} AND id = ${id}`);
      else if (change.done) queries.push(sql`UPDATE rs_orders SET kitchen = kitchen || jsonb_build_object('doneAt', ${change.done.at}::text, 'doneBy', ${change.done.by}::text), updated_at = clock_timestamp()
        WHERE site_id = ${siteId} AND id = ${id}`);
      if (change.seen) queries.push(sql`UPDATE rs_orders SET kitchen = kitchen || '{"seen": true}'::jsonb, updated_at = clock_timestamp() WHERE site_id = ${siteId} AND id = ${id}`);
      if (change.status) queries.push(sql`UPDATE rs_orders SET status = ${change.status}, updated_at = clock_timestamp() WHERE site_id = ${siteId} AND id = ${id}`);
      const results = await run<OrderRow>([...queries, sql`SELECT id, status, pos, kitchen, version, updated_at FROM rs_orders WHERE site_id = ${siteId} AND id = ${id}`]);
      const row = results[results.length - 1][0];
      return row ? toOrder(row) : null;
    },
    async logEvent(key, body) {
      const [rows] = await run<{ id: string }>([
        sql`INSERT INTO rs_pos_events (company_id, site_id, event_key, body) VALUES (${companyId}, ${siteId}, ${key}, ${body}) ON CONFLICT (site_id, event_key) DO NOTHING RETURNING id::text AS id`,
        sql`DELETE FROM rs_pos_events WHERE site_id = ${siteId} AND id <= (SELECT id FROM rs_pos_events WHERE site_id = ${siteId} ORDER BY id DESC OFFSET ${KEEP_EVENTS} LIMIT 1)`
      ]);
      return rows[0]?.id ?? null;
    },
    async finishEvent(rowId, kind, ok, summary) {
      await run([sql`UPDATE rs_pos_events SET kind = ${kind}, ok = ${ok}, summary = ${summary} WHERE site_id = ${siteId} AND id = ${rowId}::bigint`]);
    },
    async dropEvent(rowId) {
      await run([sql`DELETE FROM rs_pos_events WHERE site_id = ${siteId} AND id = ${rowId}::bigint`]);
    },
    async events(limit) {
      const [rows] = await run<{ at: string; kind: string; ok: boolean | null; summary: string; body: string }>([
        sql`SELECT at, kind, ok, summary, body FROM rs_pos_events WHERE site_id = ${siteId} ORDER BY id DESC LIMIT ${limit}`
      ]);
      return rows.map((row) => ({ at: iso(row.at), kind: row.kind, ok: row.ok, summary: row.summary, body: row.body }));
    },
    async getSale(receiptId) {
      const [rows] = await run<{ receipt_id: string; day: string; lines: PosSale["lines"] }>([
        sql`SELECT receipt_id, day::text AS day, lines FROM rs_pos_sales WHERE site_id = ${siteId} AND receipt_id = ${receiptId}`
      ]);
      return rows[0] ? { receiptId: rows[0].receipt_id, day: rows[0].day, lines: rows[0].lines } : null;
    },
    async saveSale(sale) {
      await run([sql`INSERT INTO rs_pos_sales (company_id, site_id, receipt_id, day, lines, updated_at) VALUES (${companyId}, ${siteId}, ${sale.receiptId}, ${sale.day}::date, ${JSON.stringify(sale.lines)}::jsonb, now())
        ON CONFLICT (site_id, receipt_id) DO UPDATE SET day = EXCLUDED.day, lines = EXCLUDED.lines, updated_at = now()`]);
    },
    async items(days) {
      const [fromOrders, fromSales] = await run<{ name: string; plu: string; category: string; count: number }>([
        sql`SELECT l->>'name' AS name, coalesce(l->>'plu', '') AS plu, coalesce(l->>'category', '') AS category, count(*)::int AS count
          FROM rs_orders o CROSS JOIN LATERAL jsonb_array_elements(o.pos->'lines') AS l
          WHERE o.site_id = ${siteId} AND o.updated_at > now() - make_interval(days => ${days}::int) AND NOT coalesce((o.pos->>'test')::boolean, false) GROUP BY 1, 2, 3`,
        sql`SELECT l->>'name' AS name, coalesce(l->>'plu', '') AS plu, coalesce(l->>'category', '') AS category, count(*)::int AS count
          FROM rs_pos_sales s CROSS JOIN LATERAL jsonb_array_elements(s.lines) AS l
          WHERE s.site_id = ${siteId} AND s.day > current_date - ${days}::int GROUP BY 1, 2, 3`
      ]);
      return mergeItems([...fromOrders, ...fromSales]);
    }
  };
}

/** Same dish from orders and receipts counted once, by name and PLU. */
export function mergeItems(rows: { name: string; plu: string; category: string; count: number }[]): PosItem[] {
  const items = new Map<string, PosItem>();
  for (const row of rows) {
    if (!row.name) continue;
    const key = row.plu + "|" + row.name.trim().toLocaleLowerCase();
    const item = items.get(key) ?? { name: row.name, plu: row.plu, category: row.category, count: 0 };
    item.count += Number(row.count) || 0;
    if (!item.category && row.category) item.category = row.category;
    items.set(key, item);
  }
  return Array.from(items.values()).sort((a, b) => b.count - a.count);
}
