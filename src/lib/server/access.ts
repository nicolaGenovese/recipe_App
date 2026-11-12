import { createHash, timingSafeEqual } from "node:crypto";

// Until there are real accounts, the whole app sits behind one shared password (APP_PASSWORD).
// Without it the app is open, which is fine on a local computer but never in production.

export const ACCESS_COOKIE = "rs_access";
export const ACCESS_DAYS = 30;

export function accessPassword(): string {
  return process.env.APP_PASSWORD?.trim() ?? "";
}

/** Online (on Vercel) a password is always needed: if it is missing, nothing is served rather than everything. */
export function accessRequired(): boolean {
  return Boolean(accessPassword()) || Boolean(process.env.VERCEL);
}

/** The cookie holds a hash of the password, never the password itself; changing the password logs everyone out. */
export function accessToken(password = accessPassword()): string {
  return createHash("sha256").update("recipe-studio:" + password).digest("hex");
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function passwordMatches(typed: string): boolean {
  const password = accessPassword();
  return Boolean(password) && same(accessToken(typed), accessToken(password));
}

/** True when the request may go through: no password needed, or the cookie matches. */
export function hasAccess(cookieValue: string | undefined): boolean {
  if (!accessRequired()) return true;
  const password = accessPassword();
  return Boolean(password) && Boolean(cookieValue) && same(cookieValue as string, accessToken(password));
}
