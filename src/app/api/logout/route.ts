import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/server/access";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE);
  return response;
}
