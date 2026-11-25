import type { Sql } from "@/lib/server/db";

/** Raise when the schema below changes; each start compares it with the database and migrates once. */
export const SCHEMA_VERSION = 2;

/** Data tables with a company column, protected by row-level security. */
export const TENANT_TABLES = [
  "recipe_studio_recipes", "recipe_studio_stock_items", "recipe_studio_photos",
  "recipe_studio_stock_reports", "recipe_studio_stock_deliveries", "recipe_studio_menus", "recipe_studio_prep_lists",
  "recipe_studio_rota_weeks", "recipe_studio_safety_logs", "recipe_studio_waste_logs", "recipe_studio_sales_weeks",
  "rs_company_settings", "rs_site_settings", "rs_site_stock", "rs_audit_log", "rs_record_versions", "rs_sites",
  "rs_pos_config", "rs_orders", "rs_pos_events", "rs_pos_sales"
];

/** Tables owned by the whole company (the recipe library and the products); the others belong to one site. */
const COMPANY_TABLES = ["recipe_studio_recipes", "recipe_studio_stock_items", "recipe_studio_photos"];
const SITE_TABLES = ["recipe_studio_stock_reports", "recipe_studio_stock_deliveries", "recipe_studio_menus", "recipe_studio_prep_lists",
  "recipe_studio_rota_weeks", "recipe_studio_safety_logs", "recipe_studio_waste_logs", "recipe_studio_sales_weeks"];

/** Data of the single kitchen that existed before companies: it becomes this company and site. */
export const FIRST_COMPANY_ID = "company_first";
export const FIRST_SITE_ID = "site_first";

const CREATE = [
  // Tables of the single-kitchen app, kept with their original shape; the migration adds the owner columns.
  `CREATE TABLE IF NOT EXISTS recipe_studio_recipes (id text NOT NULL, title text NOT NULL, category text NOT NULL DEFAULT '',
    current_menu boolean NOT NULL DEFAULT false, archived_batch boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL, CONSTRAINT recipe_studio_recipes_pkey PRIMARY KEY (id))`,
  `CREATE TABLE IF NOT EXISTS recipe_studio_photos (id text NOT NULL, mime_type text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT recipe_studio_photos_pkey PRIMARY KEY (id))`,
  ...["recipe_studio_stock_items", ...SITE_TABLES].map((table) =>
    `CREATE TABLE IF NOT EXISTS ${table} (id text NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT ${table}_pkey PRIMARY KEY (id))`),
  `CREATE TABLE IF NOT EXISTS recipe_studio_settings (id integer PRIMARY KEY CHECK (id = 1), payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,

  `CREATE TABLE IF NOT EXISTS rs_schema (version integer PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rs_meta (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rs_companies (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rs_areas (id text PRIMARY KEY, company_id text NOT NULL REFERENCES rs_companies(id) ON DELETE CASCADE, name text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rs_sites (id text PRIMARY KEY, company_id text NOT NULL REFERENCES rs_companies(id) ON DELETE CASCADE,
    area_id text REFERENCES rs_areas(id) ON DELETE SET NULL, name text NOT NULL, kind text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rs_roles (id text PRIMARY KEY, company_id text NOT NULL REFERENCES rs_companies(id) ON DELETE CASCADE,
    name text NOT NULL, level integer NOT NULL, scope text NOT NULL, permissions jsonb NOT NULL, template text)`,
  `CREATE TABLE IF NOT EXISTS rs_memberships (id text PRIMARY KEY, user_id text NOT NULL, company_id text NOT NULL REFERENCES rs_companies(id) ON DELETE CASCADE,
    role_id text NOT NULL REFERENCES rs_roles(id), scope_type text NOT NULL, scope_id text NOT NULL, staff_id text, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS rs_memberships_user_idx ON rs_memberships (user_id)`,
  `CREATE TABLE IF NOT EXISTS rs_invites (token text PRIMARY KEY, company_id text NOT NULL REFERENCES rs_companies(id) ON DELETE CASCADE,
    role_id text NOT NULL REFERENCES rs_roles(id) ON DELETE CASCADE, scope_type text NOT NULL, scope_id text NOT NULL, staff_id text, email text NOT NULL DEFAULT '',
    created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, accepted_by text, accepted_at timestamptz)`,
  `CREATE TABLE IF NOT EXISTS rs_company_settings (company_id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rs_site_settings (site_id text PRIMARY KEY, company_id text NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rs_site_stock (site_id text NOT NULL, item_id text NOT NULL, company_id text NOT NULL, payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site_id, item_id))`,
  `CREATE TABLE IF NOT EXISTS rs_audit_log (id bigserial PRIMARY KEY, company_id text NOT NULL, site_id text, user_id text, user_name text NOT NULL DEFAULT '',
    action text NOT NULL, target text NOT NULL DEFAULT '', detail jsonb, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS rs_audit_log_company_idx ON rs_audit_log (company_id, at DESC)`,
  `CREATE TABLE IF NOT EXISTS rs_record_versions (id bigserial PRIMARY KEY, company_id text NOT NULL, site_id text NOT NULL, kind text NOT NULL,
    record_id text NOT NULL, payload jsonb, deleted boolean NOT NULL DEFAULT false, user_id text, user_name text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS rs_record_versions_record_idx ON rs_record_versions (site_id, kind, record_id)`,

  // Version 2: till connection, kitchen orders, till notices and paid receipts (docs/CASSA-E-COMANDE.md).
  `CREATE TABLE IF NOT EXISTS rs_pos_config (site_id text PRIMARY KEY, company_id text NOT NULL, token text UNIQUE, signing_secret text NOT NULL DEFAULT '',
    enabled boolean NOT NULL DEFAULT true, payload jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rs_orders (company_id text NOT NULL, site_id text NOT NULL, id text NOT NULL, external_id text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'open', pos jsonb NOT NULL, kitchen jsonb NOT NULL DEFAULT '{}'::jsonb, version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site_id, id))`,
  `CREATE INDEX IF NOT EXISTS rs_orders_changed_idx ON rs_orders (site_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS rs_pos_events (id bigserial PRIMARY KEY, company_id text NOT NULL, site_id text NOT NULL, event_key text NOT NULL,
    kind text NOT NULL DEFAULT '', ok boolean, summary text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT now(), UNIQUE (site_id, event_key))`,
  `CREATE INDEX IF NOT EXISTS rs_pos_events_site_idx ON rs_pos_events (site_id, id DESC)`,
  `CREATE TABLE IF NOT EXISTS rs_pos_sales (company_id text NOT NULL, site_id text NOT NULL, receipt_id text NOT NULL, day date NOT NULL, lines jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site_id, receipt_id))`,
  `CREATE INDEX IF NOT EXISTS rs_pos_sales_day_idx ON rs_pos_sales (site_id, day)`
];

const quote = (values: string[]) => "ARRAY[" + values.map((value) => `'${value}'`).join(",") + "]";

/**
 * Version 1: every data table gets its owner. The rows of the old single kitchen become the first
 * company and its main site, the old settings are split in company and site settings, and the
 * stock counts move to the site. Runs in the same transaction as the table creation, under a lock.
 */
const MIGRATE_V1 = `DO $migrate$
DECLARE t text; first_data boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM rs_schema WHERE version >= 1) THEN RETURN; END IF;
  first_data := EXISTS (SELECT 1 FROM recipe_studio_settings) OR EXISTS (SELECT 1 FROM recipe_studio_recipes) OR EXISTS (SELECT 1 FROM recipe_studio_stock_items);
  IF first_data THEN
    INSERT INTO rs_companies (id, name) VALUES ('${FIRST_COMPANY_ID}', 'La mia compagnia') ON CONFLICT (id) DO NOTHING;
    INSERT INTO rs_sites (id, company_id, name) VALUES ('${FIRST_SITE_ID}', '${FIRST_COMPANY_ID}', 'Sede principale') ON CONFLICT (id) DO NOTHING;
    INSERT INTO rs_company_settings (company_id, payload) SELECT '${FIRST_COMPANY_ID}', payload - 'foodSafety' FROM recipe_studio_settings WHERE id = 1 ON CONFLICT (company_id) DO NOTHING;
    INSERT INTO rs_site_settings (site_id, company_id, payload) SELECT '${FIRST_SITE_ID}', '${FIRST_COMPANY_ID}', jsonb_build_object('foodSafety', payload -> 'foodSafety')
      FROM recipe_studio_settings WHERE id = 1 AND payload ? 'foodSafety' ON CONFLICT (site_id) DO NOTHING;
    INSERT INTO rs_site_stock (site_id, item_id, company_id, payload)
      SELECT '${FIRST_SITE_ID}', id, '${FIRST_COMPANY_ID}', jsonb_strip_nulls(jsonb_build_object('initialStock', payload -> 'initialStock', 'stockCount', payload -> 'stockCount', 'parLevel', payload -> 'parLevel'))
      FROM recipe_studio_stock_items ON CONFLICT (site_id, item_id) DO NOTHING;
  END IF;
  FOREACH t IN ARRAY ${quote(COMPANY_TABLES)} LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id text', t);
    EXECUTE format('UPDATE %I SET company_id = %L WHERE company_id IS NULL', t, '${FIRST_COMPANY_ID}');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN company_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_pkey');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (company_id, id)', t, t || '_pkey');
  END LOOP;
  ALTER TABLE recipe_studio_recipes ADD COLUMN IF NOT EXISTS site_id text;
  FOREACH t IN ARRAY ${quote(SITE_TABLES)} LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS site_id text', t);
    EXECUTE format('UPDATE %I SET company_id = %L, site_id = %L WHERE company_id IS NULL', t, '${FIRST_COMPANY_ID}', '${FIRST_SITE_ID}');
    EXECUTE format('ALTER TABLE %I ALTER COLUMN company_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN site_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_pkey');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (site_id, id)', t, t || '_pkey');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (company_id)', t || '_company_idx', t);
  END LOOP;
  INSERT INTO rs_schema (version) VALUES (1);
END $migrate$`;

/**
 * Version 2: the kitchen order permissions. Default roles that already exist get them like new
 * companies do: every kitchen role sees the orders, the head chef and above connect the till.
 */
const MIGRATE_V2 = `DO $migrate$
BEGIN
  IF EXISTS (SELECT 1 FROM rs_schema WHERE version >= 2) THEN RETURN; END IF;
  UPDATE rs_roles SET permissions = permissions || '["orders.view"]'::jsonb
    WHERE template IN ('headoffice', 'area', 'gm', 'headchef', 'sous', 'cdp') AND NOT permissions ? 'orders.view';
  UPDATE rs_roles SET permissions = permissions || '["orders.setup"]'::jsonb
    WHERE template IN ('headoffice', 'area', 'gm', 'headchef') AND NOT permissions ? 'orders.setup';
  INSERT INTO rs_schema (version) VALUES (2);
END $migrate$`;

/**
 * Row-level security: the app reads and writes data as the restricted role rs_tenant, which only
 * sees the rows of the company set for the transaction. The database owner bypasses it, so the
 * directory (companies, users, invites) and this migration work across companies.
 */
const SECURE = `DO $secure$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rs_tenant') THEN CREATE ROLE rs_tenant NOLOGIN; END IF;
  EXECUTE format('GRANT rs_tenant TO %I', current_user);
  FOREACH t IN ARRAY ${quote(TENANT_TABLES)} LOOP
    IF t = 'rs_sites' THEN EXECUTE 'GRANT SELECT ON rs_sites TO rs_tenant';
    ELSE EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO rs_tenant', t); END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'rs_company') THEN
      EXECUTE format('CREATE POLICY rs_company ON %I USING (company_id = current_setting(''app.company_id'', true)) WITH CHECK (company_id = current_setting(''app.company_id'', true))', t);
    END IF;
  END LOOP;
  GRANT USAGE ON SEQUENCE rs_audit_log_id_seq, rs_record_versions_id_seq, rs_pos_events_id_seq TO rs_tenant;
END $secure$`;

/** Creates and migrates the schema once per database version. Safe to run from several servers at once. */
export async function ensureSchema(sql: Sql): Promise<void> {
  const [present] = (await sql`SELECT to_regclass('public.rs_schema') IS NOT NULL AS present`) as { present: boolean }[];
  if (present?.present) {
    const [row] = (await sql`SELECT coalesce(max(version), 0)::int AS version FROM rs_schema`) as { version: number }[];
    if ((row?.version ?? 0) >= SCHEMA_VERSION) return;
  }
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(72700101)`,
    ...[...CREATE, MIGRATE_V1, MIGRATE_V2, SECURE].map((statement) => sql.query(statement) as unknown as ReturnType<Sql>)
  ]);
}
