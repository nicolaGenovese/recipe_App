import { createHash } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { database } from "@/lib/server/db";

/**
 * Accounts with email and password through Better Auth, stored in the same Neon database
 * (tables "user", "session", "account", "verification"). Companies, sites and roles are ours,
 * in the rs_ tables: Better Auth only says who someone is.
 */
function authSecret(url: string): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  // Without a secret set on Vercel, one is derived from the database address, which is already secret.
  return createHash("sha256").update("recipe-studio-auth:" + url).digest("hex");
}

/** Addresses allowed to sign in: production, this deployment and its branch preview, and the local dev server. */
function trustedOrigins(): string[] {
  const hosts = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map((host) => "https://" + host);
  const own = process.env.BETTER_AUTH_URL?.trim();
  return [...hosts, ...(own ? [own] : []), ...(process.env.VERCEL ? [] : ["http://localhost:3000", "http://localhost:3010"])];
}

function createAuth(url: string, pool: Pool) {
  return betterAuth({
    appName: "Recipe Studio",
    database: pool,
    secret: authSecret(url),
    baseURL: process.env.BETTER_AUTH_URL?.trim() || undefined,
    trustedOrigins: trustedOrigins(),
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, window: 60, max: 30 },
    telemetry: { enabled: false },
    plugins: [nextCookies()]
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Change this after upgrading better-auth, so the next start checks its tables again. */
const AUTH_SCHEMA = "better-auth@1.7";

let instance: { url: string; auth: Auth; pool: Pool; ready: Promise<void> | null } | null = null;

/** Connections open only when needed and close after a few idle seconds; a broken one is dropped. */
function openPool(url: string): Pool {
  const pool = new Pool({ connectionString: url, idleTimeoutMillis: 5000 });
  pool.on("error", (error: unknown) => console.error("Connessione degli account interrotta:", error instanceof Error ? error.message : error));
  return pool;
}

/** Better Auth for this database, or null in local mode (no DATABASE_URL: one kitchen, no accounts). */
export function getAuth(): Auth | null {
  const db = database();
  if (!db) return null;
  if (!instance || instance.url !== db.url) {
    const pool = openPool(db.url);
    instance = { url: db.url, auth: createAuth(db.url, pool), pool, ready: null };
  }
  return instance.auth;
}

/**
 * Starts again with fresh connections. A pool can stay broken after the database went to sleep or the
 * network dropped; the next request then opens new connections instead of failing every time.
 */
export function resetAuth(): void {
  if (!instance) return;
  const old = instance;
  void old.pool.end().catch(() => undefined);
  const pool = openPool(old.url);
  instance = { url: old.url, auth: createAuth(old.url, pool), pool, ready: old.ready };
}

/** Creates or updates the Better Auth tables, once per AUTH_SCHEMA. */
export function authReady(): Promise<void> {
  const auth = getAuth();
  const db = database();
  if (!auth || !db || !instance) return Promise.resolve();
  instance.ready ??= (async () => {
    const [row] = (await db.sql`SELECT value FROM rs_meta WHERE key = 'better-auth'`) as { value: string }[];
    const version = AUTH_SCHEMA;
    if (row?.value === version) return;
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    await db.sql`INSERT INTO rs_meta (key, value) VALUES ('better-auth', ${version}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  })().catch((error) => { if (instance) instance.ready = null; throw error; });
  return instance.ready;
}
