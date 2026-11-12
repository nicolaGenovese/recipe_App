import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import { LEGACY_MENU_ID, legacyMenus } from "@/lib/menus/menus";
import { normalizeSettings } from "@/lib/settings";
import type { Menu, PrepList, RotaWeek, SafetyLog, SalesWeek, WasteLog, Recipe, Settings, StockDelivery, StockItem, StockReport } from "@/lib/types";
import type { RecordKind, Store } from "@/lib/server/store/types";

type Sql = NeonQueryFunction<false, false>;
type PayloadRow = { payload: unknown };

/** Creates the tables on first use. A new database starts with no data, only the default settings. */
async function ensureSchema(sql: Sql): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_recipes (
    id text PRIMARY KEY, title text NOT NULL, category text NOT NULL DEFAULT '',
    current_menu boolean NOT NULL DEFAULT false, archived_batch boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS recipe_studio_recipes_title_idx ON recipe_studio_recipes (lower(title))`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_settings (id integer PRIMARY KEY CHECK (id = 1), payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_stock_items (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_stock_reports (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_stock_deliveries (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  const [menusTable] = (await sql`SELECT to_regclass('recipe_studio_menus') IS NOT NULL AS present`) as { present: boolean }[];
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_menus (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_prep_lists (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_waste_logs (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_sales_weeks (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_safety_logs (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipe_studio_rota_weeks (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  // A new database starts empty: only the default settings are written.
  const [settingsRows] = (await sql.transaction([sql`SELECT count(*)::int AS total FROM recipe_studio_settings WHERE id = 1`])) as { total: number }[][];
  if (Number(settingsRows[0]?.total ?? 0) === 0) {
    await sql`INSERT INTO recipe_studio_settings (id, payload) VALUES (1, ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  }
  // The menus table is new: the dishes marked "current menu" become the first menu, once.
  if (!menusTable?.present) {
    const [recipes, settings] = (await sql.transaction([
      sql`SELECT payload FROM recipe_studio_recipes`,
      sql`SELECT payload FROM recipe_studio_settings WHERE id = 1`
    ])) as PayloadRow[][];
    const language = (settings[0]?.payload as Partial<Settings> | undefined)?.language;
    const menus = legacyMenus(recipes.map((row) => row.payload as Recipe), language === "en" ? "Main menu" : "Menu principale", LEGACY_MENU_ID);
    for (const menu of menus) await sql`INSERT INTO recipe_studio_menus (id, payload) VALUES (${menu.id}, ${JSON.stringify(menu)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  }
}

// Table names cannot be query parameters, so each kind gets its own fixed statements.
function upsertRecord(sql: Sql, kind: RecordKind, id: string, payload: string) {
  if (kind === "menus") return sql`INSERT INTO recipe_studio_menus (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  if (kind === "wasteLogs") return sql`INSERT INTO recipe_studio_waste_logs (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  if (kind === "salesWeeks") return sql`INSERT INTO recipe_studio_sales_weeks (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  if (kind === "safetyLogs") return sql`INSERT INTO recipe_studio_safety_logs (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  if (kind === "rotaWeeks") return sql`INSERT INTO recipe_studio_rota_weeks (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  if (kind === "prepLists") return sql`INSERT INTO recipe_studio_prep_lists (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  if (kind === "items") return sql`INSERT INTO recipe_studio_stock_items (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  if (kind === "reports") return sql`INSERT INTO recipe_studio_stock_reports (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
  return sql`INSERT INTO recipe_studio_stock_deliveries (id, payload, updated_at) VALUES (${id}, ${payload}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
}
function deleteRow(sql: Sql, kind: RecordKind, id: string) {
  if (kind === "menus") return sql`DELETE FROM recipe_studio_menus WHERE id = ${id}`;
  if (kind === "prepLists") return sql`DELETE FROM recipe_studio_prep_lists WHERE id = ${id}`;
  if (kind === "wasteLogs") return sql`DELETE FROM recipe_studio_waste_logs WHERE id = ${id}`;
  if (kind === "salesWeeks") return sql`DELETE FROM recipe_studio_sales_weeks WHERE id = ${id}`;
  if (kind === "safetyLogs") return sql`DELETE FROM recipe_studio_safety_logs WHERE id = ${id}`;
  if (kind === "rotaWeeks") return sql`DELETE FROM recipe_studio_rota_weeks WHERE id = ${id}`;
  if (kind === "items") return sql`DELETE FROM recipe_studio_stock_items WHERE id = ${id}`;
  if (kind === "reports") return sql`DELETE FROM recipe_studio_stock_reports WHERE id = ${id}`;
  return sql`DELETE FROM recipe_studio_stock_deliveries WHERE id = ${id}`;
}

export function createNeonStore(connectionString: string): Store {
  const sql = neon(connectionString);
  let schema: Promise<void> | null = null;
  let connected = false;
  const ready = () => {
    schema ??= ensureSchema(sql).then(() => { connected = true; }).catch((error) => { schema = null; connected = false; throw error; });
    return schema;
  };

  return {
    mode: "neon",
    async health() {
      try { await ready(); return { connected, error: null }; }
      catch (error) { return { connected: false, error: error instanceof Error ? error.message : "Connessione non riuscita" }; }
    },
    async getState() {
      await ready();
      const [recipes, settings, items, reports, deliveries, menus, prepLists, rotaWeeks, safetyLogs, wasteLogs, salesWeeks] = (await sql.transaction([
        sql`SELECT payload FROM recipe_studio_recipes ORDER BY updated_at DESC`,
        sql`SELECT payload FROM recipe_studio_settings WHERE id = 1`,
        sql`SELECT payload FROM recipe_studio_stock_items`,
        sql`SELECT payload FROM recipe_studio_stock_reports`,
        sql`SELECT payload FROM recipe_studio_stock_deliveries`,
        sql`SELECT payload FROM recipe_studio_menus`,
        sql`SELECT payload FROM recipe_studio_prep_lists`,
        sql`SELECT payload FROM recipe_studio_rota_weeks`,
        sql`SELECT payload FROM recipe_studio_safety_logs`,
        sql`SELECT payload FROM recipe_studio_waste_logs`,
        sql`SELECT payload FROM recipe_studio_sales_weeks`
      ])) as PayloadRow[][];
      return {
        recipes: recipes.map((row) => row.payload as Recipe),
        settings: normalizeSettings(settings[0]?.payload as Partial<Settings> | undefined, rotaWeeks.map((row) => row.payload as RotaWeek)),
        stockItems: items.map((row) => row.payload as StockItem),
        stockReports: reports.map((row) => row.payload as StockReport),
        stockDeliveries: deliveries.map((row) => row.payload as StockDelivery),
        menus: menus.map((row) => row.payload as Menu),
        prepLists: prepLists.map((row) => row.payload as PrepList),
        rotaWeeks: rotaWeeks.map((row) => row.payload as RotaWeek),
        safetyLogs: safetyLogs.map((row) => row.payload as SafetyLog),
        wasteLogs: wasteLogs.map((row) => row.payload as WasteLog),
        salesWeeks: salesWeeks.map((row) => row.payload as SalesWeek),
        storage: "neon"
      };
    },
    async saveRecipe(recipe) {
      await ready();
      await sql`INSERT INTO recipe_studio_recipes (id, title, category, current_menu, archived_batch, created_at, updated_at, payload)
        VALUES (${recipe.id}, ${recipe.name}, ${recipe.category ?? ""}, ${Boolean(recipe.currentMenu)}, ${Boolean(recipe.archivedBatch)}, ${recipe.createdAt}, ${recipe.updatedAt}, ${JSON.stringify(recipe)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, current_menu = EXCLUDED.current_menu,
          archived_batch = EXCLUDED.archived_batch, updated_at = EXCLUDED.updated_at, payload = EXCLUDED.payload`;
      return recipe;
    },
    async deleteRecipe(id) {
      await ready();
      await sql`DELETE FROM recipe_studio_recipes WHERE id = ${id}`;
    },
    async saveSettings(settings) {
      await ready();
      await sql`INSERT INTO recipe_studio_settings (id, payload, updated_at) VALUES (1, ${JSON.stringify(settings)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`;
      return settings;
    },
    async saveRecord(kind, record) {
      await ready();
      await upsertRecord(sql, kind, record.id, JSON.stringify(record));
      return record;
    },
    async deleteRecord(kind, id) {
      await ready();
      await deleteRow(sql, kind, id);
    }
  };
}
