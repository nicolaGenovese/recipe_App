import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

let client: { url: string; sql: Sql } | null = null;

/** The Neon connection when DATABASE_URL is set, otherwise null (local JSON file, single kitchen). */
export function database(): { url: string; sql: Sql } | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!client || client.url !== url) client = { url, sql: neon(url) };
  return client;
}

/** Random ids for companies, sites, roles and invites. */
export function randomId(prefix: string, bytes = 12): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return prefix + "_" + Array.from(values, (value) => value.toString(36).padStart(2, "0")).join("").slice(0, bytes * 2);
}
