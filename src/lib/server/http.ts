import { NextResponse } from "next/server";
import { ACCESS_COOKIE, hasAccess } from "@/lib/server/access";
import { HttpError } from "@/lib/server/validation";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export function json(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, { status, headers: HEADERS });
}

/** Reads a JSON body with a size limit; recipe photos make bodies large, but never this large. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new HttpError(413, "Richiesta troppo grande.");
  try { return JSON.parse(text); }
  catch { throw new HttpError(400, "Il contenuto inviato non è JSON valido."); }
}

/** Wraps a route handler: known errors keep their status, anything else means storage is unreachable. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    // The proxy already checks access; checking again here keeps the API closed even if the proxy is bypassed.
    const request = (args as unknown[])[0];
    if (request instanceof Request) {
      const cookie = request.headers.get("cookie")?.split(/;\s*/).find((part) => part.startsWith(ACCESS_COOKIE + "="))?.slice(ACCESS_COOKIE.length + 1);
      if (!hasAccess(cookie)) return json({ error: "Accesso richiesto." }, 401);
    }
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("Richiesta non completata:", error instanceof Error ? error.message : error);
      return json({ error: "Archivio non raggiungibile. Controlla DATABASE_URL e la connessione." }, 503);
    }
  };
}
