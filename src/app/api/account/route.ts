import { passwordMatches, accessPassword } from "@/lib/server/access";
import { authReady, getAuth } from "@/lib/server/auth/auth";
import { sessionUser } from "@/lib/server/auth/context";
import { authError } from "@/lib/server/auth/errors";
import { database } from "@/lib/server/db";
import { claimFirstCompany, createCompany, firstCompanyUnclaimed, type SessionUser } from "@/lib/server/directory";
import { getStore } from "@/lib/server/store";
import { handle, json, readJson } from "@/lib/server/http";
import { HttpError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

const text = (value: unknown, max = 80) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function needDatabase() {
  const db = database();
  const auth = getAuth();
  if (!db || !auth) throw new HttpError(404, "Account non disponibili senza database.");
  return { db, auth };
}

/** GET /api/account: what the login page should offer (first access to claim the data, or plain sign in). */
export const GET = handle(async () => {
  const db = database();
  if (!db) return json({ accounts: false, claim: false, appPassword: false });
  await getStore().ready();
  return json({ accounts: true, claim: await firstCompanyUnclaimed(db.sql), appPassword: Boolean(accessPassword()) });
});

/**
 * POST /api/account
 * - register: a new account with a new company and its first site (the person becomes owner);
 * - claim: the first account takes the data that existed before accounts, with the old app password;
 * - company: a signed-in user creates another company.
 */
export const POST = handle(async (request: Request) => {
  const { db, auth } = needDatabase();
  await getStore().ready();
  await authReady();
  const body = (await readJson(request)) as Record<string, unknown>;
  const action = body.action;
  const companyName = text(body.companyName) || "La mia compagnia";
  const siteName = text(body.siteName) || "Sede principale";

  if (action === "company") {
    const user = await sessionUser(request.headers);
    if (!user) throw new HttpError(401, "Accesso richiesto.");
    return json({ siteId: await createCompany(db.sql, user, companyName, siteName) });
  }
  if (action !== "register" && action !== "claim") throw new HttpError(400, "Operazione non valida.");

  if (action === "claim") {
    if (!(await firstCompanyUnclaimed(db.sql))) throw new HttpError(409, "Questi dati hanno già un titolare: accedi con il suo account o fatti invitare.");
    // The old shared password proves the person is the kitchen that owned the data.
    if (accessPassword() && !passwordMatches(text(body.appPassword, 200))) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      throw new HttpError(401, "La password attuale dell'app non è corretta.");
    }
  }

  const name = text(body.name);
  const email = text(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!name) throw new HttpError(400, "Scrivi il tuo nome.");
  let user: SessionUser;
  try {
    const result = await auth.api.signUpEmail({ body: { name, email, password }, headers: request.headers });
    user = { id: result.user.id, name: result.user.name, email: result.user.email };
  } catch (error) {
    throw authError(error);
  }
  if (action === "claim") await claimFirstCompany(db.sql, user, companyName, siteName);
  else await createCompany(db.sql, user, companyName, siteName);
  return json({ ok: true });
});
