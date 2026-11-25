import { NextResponse } from "next/server";
import { handleOpen, json } from "@/lib/server/http";
import { receivePos } from "@/lib/server/pos/receive";
import { verifySignature } from "@/lib/server/pos/signature";
import { getStore } from "@/lib/server/store";
import { HttpError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024 * 1024;
type Params = { params: Promise<{ token: string }> };

/** The site of a webhook address. The token is long and random: it is what makes the address private. */
async function siteOf(params: Params["params"]) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{24,100}$/.test(token)) throw new HttpError(404, "Indirizzo non valido.");
  const store = getStore();
  await store.ready();
  const site = await store.findPosSite(token);
  if (!site) throw new HttpError(404, "Indirizzo non valido.");
  return { store, site };
}

/** JSON, or a form post with the JSON in a field (some tills send "payload=…"), or plain form fields. */
function parseBody(raw: string, type: string): unknown {
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { /* Not JSON: try a form below. */ }
  if (type.includes("form") || raw.includes("=")) {
    const form = new URLSearchParams(raw);
    for (const field of ["payload", "data", "json", "body", "order"]) {
      const value = form.get(field);
      if (value) try { return JSON.parse(value); } catch { /* Not JSON either. */ }
    }
    return Object.fromEntries(form);
  }
  throw new HttpError(400, "Il contenuto inviato non è JSON valido.");
}

/**
 * POST /api/pos/{token}: notices from the till (order sent, changed, course away, paid, void, refund).
 * No account: the token in the address says which site it is, and tills that sign their notices are
 * checked with the shared secret. Answers 200 once handled (also for a copy sent again) and 500 when
 * it could not be stored, so the till tries again.
 */
export const POST = handleOpen(async (request: Request, { params }: Params) => {
  const { store, site } = await siteOf(params);
  if (!site.enabled) return json({ error: "Collegamento della cassa sospeso." }, 403);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return json({ error: "Richiesta troppo grande." }, 413);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => { headers[name.toLowerCase()] = value; });
  const scoped = store.scoped(site);
  const { connection } = await scoped.orders.config();
  if (connection.signingSecret && !verifySignature(connection.signingSecret, raw, headers, request.url)) return json({ error: "Firma non valida." }, 401);
  try {
    const result = await receivePos(scoped.orders, raw, parseBody(raw, headers["content-type"] ?? ""), headers);
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Avviso della cassa non salvato:", error instanceof Error ? error.message : error);
    return json({ error: "Avviso non salvato, riprova." }, 500);
  }
});

/**
 * GET /api/pos/{token}: some tills check the address before saving it. Echoes a "challenge" when
 * asked, otherwise says the address works.
 */
export const GET = handleOpen(async (request: Request, { params }: Params) => {
  await siteOf(params);
  const query = new URL(request.url).searchParams;
  const challenge = query.get("challenge") ?? query.get("hub.challenge") ?? query.get("echo");
  if (challenge) return new NextResponse(challenge.slice(0, 200), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  return json({ ok: true, service: "Recipe Studio" });
});
