import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_DAYS, accessPassword, accessToken, passwordMatches } from "@/lib/server/access";

export const dynamic = "force-dynamic";

/** POST /api/login with the shared password sets the access cookie. A short delay slows down guessing. */
export async function POST(request: Request) {
  let password = "";
  try { password = String(((await request.json()) as { password?: unknown }).password ?? ""); } catch { /* Empty body. */ }
  if (!accessPassword()) return NextResponse.json({ error: "Password non configurata: imposta APP_PASSWORD." }, { status: 503 });
  if (!passwordMatches(password)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ error: "Password errata." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, accessToken(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ACCESS_DAYS * 24 * 60 * 60
  });
  return response;
}
