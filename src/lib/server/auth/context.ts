import "server-only";
import { ALL_PERMISSIONS, type AccessInfo, type Permission } from "@/lib/access/permissions";
import { authReady, getAuth, resetAuth } from "@/lib/server/auth/auth";
import { database } from "@/lib/server/db";
import { loadAccess, type SessionUser } from "@/lib/server/directory";
import { getStore, type Scope, type ScopedStore } from "@/lib/server/store";
import { HttpError } from "@/lib/server/validation";

/** Cookie with the site chosen in the sidebar; only a preference, checked against the user's assignments. */
export const SITE_COOKIE = "rs_site";

export interface RequestContext {
  /** Null in local mode: one kitchen on this computer, no accounts, everything allowed. */
  access: AccessInfo | null;
  user: SessionUser | null;
  scope: Scope;
  store: ScopedStore;
  can(permission: Permission): boolean;
  /** Throws 403 unless every permission is granted. */
  require(...permissions: Permission[]): void;
}

const LOCAL_SCOPE: Scope = { companyId: "local", siteId: "local" };

function cookie(headers: Headers, name: string): string | null {
  const part = headers.get("cookie")?.split(/;\s*/).find((value) => value.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

/** The signed-in user, or null. Never throws for a missing session. */
export async function sessionUser(headers: Headers): Promise<SessionUser | null> {
  const auth = getAuth();
  if (!auth) return null;
  await getStore().ready();
  await authReady();
  // One more try with fresh connections: a dropped database connection should not sign anyone out.
  const session = await auth.api.getSession({ headers }).catch(async () => {
    resetAuth();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return (getAuth() ?? auth).api.getSession({ headers });
  });
  return session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null;
}

/**
 * Who is asking, at which company and site, and what they may do. In Neon mode a missing session
 * is 401 and a user without any company is 403 with detail "no-company", so the browser can send
 * them to the welcome page. The store it returns can only reach that company's data.
 */
export async function resolveContext(headers: Headers, ...needed: Permission[]): Promise<RequestContext> {
  const db = database();
  if (!db) {
    const store = getStore().scoped(LOCAL_SCOPE);
    return { access: null, user: null, scope: LOCAL_SCOPE, store, can: () => true, require: () => undefined };
  }
  const user = await sessionUser(headers);
  if (!user) throw new HttpError(401, "Accesso richiesto.");
  const access = await loadAccess(db.sql, user, headers.get("x-rs-site") || cookie(headers, SITE_COOKIE));
  if (!access) throw new HttpError(403, "Il tuo account non fa ancora parte di nessuna compagnia.", "no-company");
  const granted = new Set<Permission>(access.level === 1 ? ALL_PERMISSIONS : access.permissions);
  const scope = { companyId: access.company.id, siteId: access.site.id };
  const context: RequestContext = {
    access, user, scope,
    store: getStore().scoped(scope),
    can: (permission) => granted.has(permission),
    require: (...permissions) => {
      if (permissions.some((permission) => !granted.has(permission))) throw new HttpError(403, "Non hai il permesso per questa operazione.");
    }
  };
  context.require(...needed);
  return context;
}

export const requireContext = (request: Request, ...needed: Permission[]) => resolveContext(request.headers, ...needed);
