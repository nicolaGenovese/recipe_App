import { sessionUser } from "@/lib/server/auth/context";
import { database } from "@/lib/server/db";
import { acceptInvite, inviteInfo } from "@/lib/server/directory";
import { getStore } from "@/lib/server/store";
import { handle, json } from "@/lib/server/http";
import { HttpError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const validToken = (value: string) => /^inv_[a-z0-9]{20,64}$/.test(value);

/** GET /api/invites/:token tells who invites to what, before signing in. */
export const GET = handle(async (_request: Request, { params }: Params) => {
  const db = database();
  const { token } = await params;
  if (!db || !validToken(token)) throw new HttpError(404, "Invito non trovato.");
  await getStore().ready();
  const info = await inviteInfo(db.sql, token);
  if (!info) throw new HttpError(404, "Invito non trovato.");
  return json(info);
});

/** POST /api/invites/:token accepts the invite for the signed-in account. */
export const POST = handle(async (request: Request, { params }: Params) => {
  const db = database();
  const { token } = await params;
  if (!db || !validToken(token)) throw new HttpError(404, "Invito non trovato.");
  const user = await sessionUser(request.headers);
  if (!user) throw new HttpError(401, "Accesso richiesto.");
  return json({ companyId: await acceptInvite(db.sql, token, user) });
});
