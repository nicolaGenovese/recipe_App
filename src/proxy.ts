import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, hasAccess } from "@/lib/server/access";
import { SESSION_COOKIES } from "@/lib/server/auth/cookies";

/**
 * Pages and APIs need a signed-in account (with a database) or the shared password (local mode).
 * This only checks that the cookie is there; every API checks the session and the permissions itself.
 */
export function proxy(request: NextRequest) {
  const signedIn = process.env.DATABASE_URL?.trim()
    ? SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value))
    : hasAccess(request.cookies.get(ACCESS_COOKIE)?.value);
  if (signedIn) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accesso richiesto." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const login = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

// Sign in, sign up and invites are open; so are static files and the till webhook, which checks its own token.
export const config = {
  matcher: ["/((?!login|registrati|invito|api/login|api/auth|api/account|api/invites|api/pos/|manifest.webmanifest|_next/static|_next/image|favicon.ico|robots.txt).*)"]
};
