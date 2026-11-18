import { toNextJsHandler } from "better-auth/next-js";
import { authReady, getAuth } from "@/lib/server/auth/auth";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Better Auth's own endpoints: sign in, sign out, session, password change. */
async function run(request: Request, method: "GET" | "POST") {
  const auth = getAuth();
  if (!auth) return Response.json({ error: "Account non disponibili senza database." }, { status: 404 });
  await getStore().ready();
  await authReady();
  return toNextJsHandler(auth)[method](request);
}

export const GET = (request: Request) => run(request, "GET");
export const POST = (request: Request) => run(request, "POST");
