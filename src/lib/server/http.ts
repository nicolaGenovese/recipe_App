import { NextResponse } from "next/server";
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
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("Richiesta non completata:", error instanceof Error ? error.message : error);
      return json({ error: "Archivio non raggiungibile. Controlla DATABASE_URL e la connessione." }, 503);
    }
  };
}
