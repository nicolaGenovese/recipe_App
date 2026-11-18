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

function createAuth(url: string) {
  return betterAuth({
    appName: "Recipe Studio",
    database: new Pool({ connectionString: url }),
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

let instance: { url: string; auth: Auth; ready: Promise<void> | null } | null = null;

/** Better Auth for this database, or null in local mode (no DATABASE_URL: one kitchen, no accounts). */
export function getAuth(): Auth | null {
  const db = database();
  if (!db) return null;
  if (!instance || instance.url !== db.url) instance = { url: db.url, auth: createAuth(db.url), ready: null };
  return instance.auth;
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
