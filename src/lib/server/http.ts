import { NextResponse } from "next/server";
import { ACCESS_COOKIE, hasAccess } from "@/lib/server/access";
import { database } from "@/lib/server/db";
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

/** Known errors keep their status; anything else means storage is unreachable. */
function failure(error: unknown): NextResponse {
  if (error instanceof HttpError) return json(error.detail ? { error: error.message, detail: error.detail } : { error: error.message }, error.status);
  console.error("Richiesta non completata:", error instanceof Error ? error.message : error);
  // The technical cause stays in the server log (DATABASE_URL, network); the person gets what to do.
  return json({ error: "Archivio non raggiungibile. Controlla la connessione e riprova tra poco; se continua, avvisa chi gestisce l'app." }, 503);
}

/** Wraps a route handler: known errors keep their status, anything else means storage is unreachable. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    // Local mode with APP_PASSWORD: the shared password still guards the API. With a database,
    // every route checks the signed-in account through requireContext.
    const request = (args as unknown[])[0];
    if (!database() && request instanceof Request) {
      const cookie = request.headers.get("cookie")?.split(/;\s*/).find((part) => part.startsWith(ACCESS_COOKIE + "="))?.slice(ACCESS_COOKIE.length + 1);
      if (!hasAccess(cookie)) return json({ error: "Accesso richiesto." }, 401);
    }
    try { return await fn(...args); } catch (error) { return failure(error); }
  };
}

/** For routes called by other services (the till webhook), which prove who they are by other means. */
export function handleOpen<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    try { return await fn(...args); } catch (error) { return failure(error); }
  };
}
