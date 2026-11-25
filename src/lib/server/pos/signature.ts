import { createHmac, timingSafeEqual } from "node:crypto";

// Signed till notices. The webhook address already holds a long secret token; tills that also sign
// their notices with a shared secret are checked here. The common schemes are tried in turn:
// Standard Webhooks / Svix ("v1,<base64>"), Stripe-style ("t=…,v1=<hex>"), Square (URL + body, base64)
// and a plain HMAC-SHA256 of the body in any "…signature…" or "…hmac…" header, hex or base64.

const hmac = (key: Buffer | string, content: string) => createHmac("sha256", key).update(content, "utf8").digest();

function equal(expected: Buffer, given: string): boolean {
  const value = given.trim().replace(/^sha256=/i, "");
  const candidates = [Buffer.from(value, "hex"), Buffer.from(value, "base64")];
  return candidates.some((candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected));
}

/** Svix secrets start with "whsec_" and are base64; any other secret is used as it is. */
const keyOf = (secret: string) => (secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : secret);

/** True when the notice carries a valid signature made with this secret. Headers are lower-case. */
export function verifySignature(secret: string, raw: string, headers: Record<string, string>, url: string): boolean {
  if (!secret) return true;
  const key = keyOf(secret);
  for (const prefix of ["webhook", "svix"]) {
    const id = headers[prefix + "-id"];
    const timestamp = headers[prefix + "-timestamp"];
    const signature = headers[prefix + "-signature"];
    if (id && timestamp && signature) {
      const expected = hmac(key, `${id}.${timestamp}.${raw}`);
      if (signature.split(/\s+/).some((part) => equal(expected, part.replace(/^v1[,=]/, "")))) return true;
    }
  }
  for (const [name, value] of Object.entries(headers)) {
    if (!/signature|hmac/.test(name) || !value) continue;
    // Stripe-style: "t=1700000000,v1=abcdef…"
    const parts = Object.fromEntries(value.split(",").map((part) => part.split("=", 2).map((piece) => piece.trim())).filter((pair) => pair.length === 2));
    if (parts.t && parts.v1 && equal(hmac(key, `${parts.t}.${raw}`), parts.v1)) return true;
    if (name.includes("square") && equal(hmac(key, url + raw), value)) return true;
    if (equal(hmac(key, raw), value)) return true;
  }
  return false;
}
