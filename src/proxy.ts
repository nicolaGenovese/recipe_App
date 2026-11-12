import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, hasAccess } from "@/lib/server/access";

/** Every page and API needs the shared password, except the login page itself and static files. */
export function proxy(request: NextRequest) {
  if (hasAccess(request.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accesso richiesto." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const login = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|robots.txt).*)"]
};
