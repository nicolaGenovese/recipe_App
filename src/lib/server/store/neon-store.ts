import { normalizeSettings } from "@/lib/settings";
import { staffAtSite } from "@/lib/staff";
export { staffAtSite } from "@/lib/staff";
import type { Menu, PrepList, Recipe, RotaWeek, SafetyLog, SalesWeek, Settings, SharedShift, StockDelivery, StockItem, StockReport, WasteLog } from "@/lib/types";
import type { Sql } from "@/lib/server/db";
import { ensureSchema } from "@/lib/server/schema";
import type { RecordKind, Scope, ScopedStore, Store } from "@/lib/server/store/types";

type SiteKind = Exclude<RecordKind, "items">;

// Table names cannot be query parameters: they come from this fixed list only.
const SITE_TABLES: Record<SiteKind, string> = {
  reports: "recipe_studio_stock_reports",
  deliveries: "recipe_studio_stock_deliveries",
  menus: "recipe_studio_menus",
  prepLists: "recipe_studio_prep_lists",
  rotaWeeks: "recipe_studio_rota_weeks",
  safetyLogs: "recipe_studio_safety_logs",
  wasteLogs: "recipe_studio_waste_logs",
  salesWeeks: "recipe_studio_sales_weeks"
};
const SITE_KINDS = Object.keys(SITE_TABLES) as SiteKind[];

/** Product fields that differ by site: the stock on hand and its target. The rest belongs to the company. */
export const SITE_STOCK_FIELDS = ["initialStock", "stockCount", "parLevel"] as const;

/** Splits a product into its company part and its site part. */
export function splitStockItem(item: StockItem): { company: Record<string, unknown>; site: Record<string, unknown> } {
  const company: Record<string, unknown> = { ...item };
  const site: Record<string, unknown> = {};
  for (const field of SITE_STOCK_FIELDS) {
    if (company[field] !== undefined) site[field] = company[field];
    delete company[field];
  }
  return { company, site };
}

/** A product as one site sees it: the company record with that site's stock on hand. */
export function joinStockItem(company: Record<string, unknown>, site: Record<string, unknown> | undefined): StockItem {
  const item: Record<string, unknown> = { ...company };
  for (const field of SITE_STOCK_FIELDS) delete item[field];
  return { ...item, initialStock: 0, ...(site ?? {}) } as StockItem;
}


type Row = { payload: Record<string, unknown> };
type Query = ReturnType<Sql>;

export function createNeonStore(sql: Sql): Store {
  let schema: Promise<void> | null = null;
  let connected = false;
  const ready = () => {
    schema ??= ensureSchema(sql).then(() => { connected = true; }).catch((error) => { schema = null; connected = false; throw error; });
    return schema;
  };

  /** A statement whose table name comes from SITE_TABLES, typed like the tagged ones. */
  const query = (text: string, params: unknown[]) => sql.query(text, params) as unknown as Query;

  function scoped({ companyId, siteId }: Scope): ScopedStore {
    /** Runs the queries in one transaction as the restricted role, limited to this company's rows. */
    async function run<T = Row>(queries: Query[]): Promise<T[][]> {
      await ready();
      const results = (await sql.transaction([
        sql`SELECT set_config('app.company_id', ${companyId}, true)`,
        sql`SET LOCAL ROLE rs_tenant`,
        ...queries
      ])) as unknown[][];
      return results.slice(2) as T[][];
    }

    return {
      async getState() {
        const [recipes, companySettings, siteSettings, items, siteStock, ...rest] = await run<Row & { site_id?: string | null; item_id?: string; site_name?: string }>([
          sql`SELECT payload, site_id FROM recipe_studio_recipes WHERE company_id = ${companyId} AND (site_id IS NULL OR site_id = ${siteId}) ORDER BY updated_at DESC`,
          sql`SELECT payload FROM rs_company_settings WHERE company_id = ${companyId}`,
          sql`SELECT payload FROM rs_site_settings WHERE site_id = ${siteId}`,
          sql`SELECT payload FROM recipe_studio_stock_items WHERE company_id = ${companyId}`,
          sql`SELECT item_id, payload FROM rs_site_stock WHERE site_id = ${siteId}`,
          ...SITE_KINDS.map((kind) => query(`SELECT payload FROM ${SITE_TABLES[kind]} WHERE site_id = $1`, [siteId])),
          sql`SELECT w.site_id, s.name AS site_name, w.payload FROM recipe_studio_rota_weeks w JOIN rs_sites s ON s.id = w.site_id
            WHERE w.company_id = ${companyId} AND w.site_id <> ${siteId} AND w.id >= to_char(now() - interval '120 days', 'YYYY-MM-DD')`
        ]);
        const lists = Object.fromEntries(SITE_KINDS.map((kind, index) => [kind, rest[index].map((row) => row.payload)])) as Record<SiteKind, unknown[]>;
        const otherRotas = rest[SITE_KINDS.length];
        const rotaWeeks = lists.rotaWeeks as RotaWeek[];
        const settings = normalizeSettings({ ...(companySettings[0]?.payload ?? {}), ...(siteSettings[0]?.payload ?? {}) } as Partial<Settings>, rotaWeeks);
        const stock = new Map(siteStock.map((row) => [row.item_id as string, row.payload]));
        // The same person on the rota of another site of the company: those shifts are shown alongside.
        const names = new Set(staffAtSite(settings.staff, siteId).map((member) => member.name.trim().toLocaleLowerCase()));
        const sharedShifts: SharedShift[] = otherRotas.flatMap((row) => {
          const week = row.payload as unknown as RotaWeek;
          return (week.rows ?? []).filter((line) => names.has(line.name.trim().toLocaleLowerCase()) && line.shifts.some(Boolean))
            .map((line) => ({ siteId: row.site_id as string, siteName: row.site_name ?? "", weekId: week.id, name: line.name, shifts: line.shifts }));
        });
        return {
          recipes: recipes.map((row) => ({ ...row.payload, siteId: row.site_id ?? undefined }) as Recipe),
          settings,
          stockItems: items.map((row) => joinStockItem(row.payload, stock.get(String(row.payload.id)))),
          stockReports: lists.reports as StockReport[],
          stockDeliveries: lists.deliveries as StockDelivery[],
          menus: lists.menus as Menu[],
          prepLists: lists.prepLists as PrepList[],
          rotaWeeks,
          safetyLogs: lists.safetyLogs as SafetyLog[],
          wasteLogs: lists.wasteLogs as WasteLog[],
          salesWeeks: lists.salesWeeks as SalesWeek[],
          sharedShifts,
          storage: "neon"
        };
      },
      async recipeSite(id) {
        const [rows] = await run<{ site_id: string | null }>([sql`SELECT site_id FROM recipe_studio_recipes WHERE company_id = ${companyId} AND id = ${id}`]);
        return rows[0] ? rows[0].site_id : undefined;
      },
      async saveRecipe(recipe) {
        const { siteId: own, ...payload } = recipe;
        const site = own ? siteId : null;
        await run([sql`INSERT INTO recipe_studio_recipes (company_id, site_id, id, title, category, current_menu, archived_batch, created_at, updated_at, payload)
          VALUES (${companyId}, ${site}, ${recipe.id}, ${recipe.name}, ${recipe.category ?? ""}, ${Boolean(recipe.currentMenu)}, ${Boolean(recipe.archivedBatch)},
            ${recipe.createdAt ?? new Date().toISOString()}, ${recipe.updatedAt ?? new Date().toISOString()}, ${JSON.stringify(payload)}::jsonb)
          ON CONFLICT (company_id, id) DO UPDATE SET site_id = EXCLUDED.site_id, title = EXCLUDED.title, category = EXCLUDED.category, current_menu = EXCLUDED.current_menu,
            archived_batch = EXCLUDED.archived_batch, updated_at = EXCLUDED.updated_at, payload = EXCLUDED.payload`]);
        return { ...recipe, siteId: site ?? undefined };
      },
      async deleteRecipe(id) {
        await run([sql`DELETE FROM recipe_studio_recipes WHERE company_id = ${companyId} AND id = ${id}`]);
      },
      async saveSettings(settings, parts = { company: true, site: true }) {
        const { foodSafety, ...company } = settings;
        const queries: Query[] = [];
        if (parts.company) queries.push(sql`INSERT INTO rs_company_settings (company_id, payload, updated_at) VALUES (${companyId}, ${JSON.stringify(company)}::jsonb, now())
          ON CONFLICT (company_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`);
        if (parts.site) queries.push(sql`INSERT INTO rs_site_settings (site_id, company_id, payload, updated_at) VALUES (${siteId}, ${companyId}, ${JSON.stringify({ foodSafety })}::jsonb, now())
          ON CONFLICT (site_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`);
        if (queries.length) await run(queries);
        return settings;
      },
      async saveRecord(kind, record) {
        if (kind === "items") {
          const { company, site } = splitStockItem(record as StockItem);
          await run([
            sql`INSERT INTO recipe_studio_stock_items (company_id, id, payload, updated_at) VALUES (${companyId}, ${record.id}, ${JSON.stringify(company)}::jsonb, now())
              ON CONFLICT (company_id, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
            sql`INSERT INTO rs_site_stock (site_id, item_id, company_id, payload, updated_at) VALUES (${siteId}, ${record.id}, ${companyId}, ${JSON.stringify(site)}::jsonb, now())
              ON CONFLICT (site_id, item_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`
          ]);
          return record;
        }
        await run([query(`INSERT INTO ${SITE_TABLES[kind as SiteKind]} (company_id, site_id, id, payload, updated_at) VALUES ($1, $2, $3, $4::jsonb, now())
          ON CONFLICT (site_id, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`, [companyId, siteId, record.id, JSON.stringify(record)])]);
        return record;
      },
      async deleteRecord(kind, id) {
        if (kind === "items") {
          // A product belongs to the whole company: deleting it removes it, and its stock, from every site.
          await run([
            sql`DELETE FROM rs_site_stock WHERE company_id = ${companyId} AND item_id = ${id}`,
            sql`DELETE FROM recipe_studio_stock_items WHERE company_id = ${companyId} AND id = ${id}`
          ]);
          return;
        }
        await run([query(`DELETE FROM ${SITE_TABLES[kind]} WHERE site_id = $1 AND id = $2`, [siteId, id])]);
      },
      async getRecord(kind, id) {
        if (kind === "items") {
          const [items, stock] = await run([
            sql`SELECT payload FROM recipe_studio_stock_items WHERE company_id = ${companyId} AND id = ${id}`,
            sql`SELECT payload FROM rs_site_stock WHERE site_id = ${siteId} AND item_id = ${id}`
          ]);
          return (items[0] ? joinStockItem(items[0].payload, stock[0]?.payload) : null) as never;
        }
        const [rows] = await run([query(`SELECT payload FROM ${SITE_TABLES[kind as SiteKind]} WHERE site_id = $1 AND id = $2`, [siteId, id])]);
        return (rows[0]?.payload ?? null) as never;
      },
      async audit(entry) {
        await run([sql`INSERT INTO rs_audit_log (company_id, site_id, user_id, user_name, action, target, detail)
          VALUES (${companyId}, ${entry.siteWide ? null : siteId}, ${entry.userId}, ${entry.userName}, ${entry.action}, ${entry.target}, ${entry.detail === undefined ? null : JSON.stringify(entry.detail)}::jsonb)`]);
      },
      async auditLog(limit) {
        const [rows] = await run<{ at: string; user_name: string; action: string; target: string; detail: unknown; site_id: string | null }>([
          sql`SELECT at, user_name, action, target, detail, site_id FROM rs_audit_log WHERE company_id = ${companyId} ORDER BY at DESC LIMIT ${limit}`
        ]);
        return rows.map((row) => ({ at: new Date(row.at).toISOString(), userName: row.user_name, action: row.action, target: row.target, detail: row.detail, siteId: row.site_id }));
      },
      async saveVersion(kind, id, payload, deleted, user) {
        await run([sql`INSERT INTO rs_record_versions (company_id, site_id, kind, record_id, payload, deleted, user_id, user_name)
          VALUES (${companyId}, ${siteId}, ${kind}, ${id}, ${JSON.stringify(payload)}::jsonb, ${deleted}, ${user.id}, ${user.name})`]);
      },
      async versions(kind, id) {
        const [rows] = await run<{ at: string; user_name: string; deleted: boolean; payload: unknown }>([
          sql`SELECT at, user_name, deleted, payload FROM rs_record_versions WHERE site_id = ${siteId} AND kind = ${kind} AND record_id = ${id} ORDER BY at DESC`
        ]);
        return rows.map((row) => ({ at: new Date(row.at).toISOString(), userName: row.user_name, deleted: row.deleted, payload: row.payload }));
      },
      async savePhoto(id, photo) {
        await run([sql`INSERT INTO recipe_studio_photos (company_id, id, mime_type, data) VALUES (${companyId}, ${id}, ${photo.mimeType}, decode(${photo.data}, 'base64'))
          ON CONFLICT (company_id, id) DO UPDATE SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data`]);
      },
      async getPhoto(id) {
        const [rows] = await run<{ mime_type: string; data: string }>([sql`SELECT mime_type, encode(data, 'base64') AS data FROM recipe_studio_photos WHERE company_id = ${companyId} AND id = ${id}`]);
        return rows[0] ? { mimeType: rows[0].mime_type, data: rows[0].data.replace(/\s/g, "") } : null;
      },
      async deletePhoto(id) {
        await run([sql`DELETE FROM recipe_studio_photos WHERE company_id = ${companyId} AND id = ${id}`]);
      }
    };
  }

  return {
    mode: "neon",
    async health() {
      try { await ready(); return { connected, error: null }; }
      catch (error) { return { connected: false, error: error instanceof Error ? error.message : "Connessione non riuscita" }; }
    },
    ready,
    scoped
  };
}
