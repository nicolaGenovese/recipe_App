import { ALL_PERMISSIONS, DEFAULT_ROLES, normalizePermissions, type AccessInfo, type Permission, type ScopeType } from "@/lib/access/permissions";
import { randomId, type Sql } from "@/lib/server/db";
import { FIRST_COMPANY_ID } from "@/lib/server/schema";
import { HttpError } from "@/lib/server/validation";

// Companies, areas, sites, roles, assignments and invites. These queries run as the database owner
// (no row-level security), so every function takes the company it works on and checks it itself.

export interface SiteRow { id: string; company_id: string; area_id: string | null; name: string; kind: string }
export interface RoleRow { id: string; company_id: string; name: string; level: number; scope: ScopeType; permissions: Permission[]; template: string | null }
export interface MembershipRow { id: string; user_id: string; company_id: string; role_id: string; scope_type: ScopeType; scope_id: string; staff_id: string | null }

export interface SessionUser { id: string; name: string; email: string }

/** Does an assignment reach this site? Company scope reaches every site, area scope the sites of the area. */
export function covers(membership: Pick<MembershipRow, "company_id" | "scope_type" | "scope_id">, site: Pick<SiteRow, "id" | "company_id" | "area_id">): boolean {
  if (membership.company_id !== site.company_id) return false;
  if (membership.scope_type === "company") return true;
  if (membership.scope_type === "area") return site.area_id === membership.scope_id;
  return site.id === membership.scope_id;
}

type AccessRow = MembershipRow & { role_name: string; level: number; permissions: Permission[]; company_name: string };

/**
 * Works out what a user can open and do: their sites across every company, and at the chosen site
 * (or the first one) the union of the permissions of every assignment that reaches it.
 */
export function buildAccess(user: SessionUser, rows: AccessRow[], sites: SiteRow[], preferredSiteId?: string | null): AccessInfo | null {
  const reachable = sites.filter((site) => rows.some((row) => covers(row, site)));
  if (!reachable.length) return null;
  const site = reachable.find((row) => row.id === preferredSiteId) ?? reachable[0];
  const here = rows.filter((row) => covers(row, site));
  const companyName = rows.find((row) => row.company_id === site.company_id)?.company_name ?? "";
  return {
    user,
    company: { id: site.company_id, name: companyName },
    site: { id: site.id, name: site.name },
    sites: reachable.map((row) => ({ id: row.id, name: row.name, areaId: row.area_id, companyId: row.company_id, companyName: rows.find((m) => m.company_id === row.company_id)?.company_name ?? "" })),
    permissions: normalizePermissions(here.flatMap((row) => row.level === 1 ? ALL_PERMISSIONS : row.permissions)),
    level: Math.min(...here.map((row) => row.level)),
    roles: Array.from(new Set(here.map((row) => row.role_name))),
    staffId: rows.find((row) => row.company_id === site.company_id && row.staff_id)?.staff_id ?? null
  };
}

export async function loadAccess(sql: Sql, user: SessionUser, preferredSiteId?: string | null): Promise<AccessInfo | null> {
  const rows = (await sql`SELECT m.id, m.user_id, m.company_id, m.role_id, m.scope_type, m.scope_id, m.staff_id, r.name AS role_name, r.level, r.permissions, c.name AS company_name
    FROM rs_memberships m JOIN rs_roles r ON r.id = m.role_id JOIN rs_companies c ON c.id = m.company_id WHERE m.user_id = ${user.id}`) as AccessRow[];
  if (!rows.length) return null;
  const companies = Array.from(new Set(rows.map((row) => row.company_id)));
  const sites = (await sql`SELECT id, company_id, area_id, name, kind FROM rs_sites WHERE company_id = ANY(${companies}) ORDER BY created_at, name`) as SiteRow[];
  return buildAccess(user, rows, sites, preferredSiteId);
}

/** The statements that give a new company its default roles; returns the owner role id. */
function defaultRoles(sql: Sql, companyId: string) {
  const ids = Object.fromEntries(DEFAULT_ROLES.map((role) => [role.key, randomId("role")]));
  const queries = DEFAULT_ROLES.map((role) => sql`INSERT INTO rs_roles (id, company_id, name, level, scope, permissions, template)
    VALUES (${ids[role.key]}, ${companyId}, ${role.name}, ${role.level}, ${role.scope}, ${JSON.stringify(role.permissions)}::jsonb, ${role.key})`);
  return { ids, queries };
}

/** A new company with its first site, the default roles and the user as owner. */
export async function createCompany(sql: Sql, user: SessionUser, companyName: string, siteName: string): Promise<string> {
  const companyId = randomId("company");
  const siteId = randomId("site");
  const roles = defaultRoles(sql, companyId);
  await sql.transaction([
    sql`INSERT INTO rs_companies (id, name) VALUES (${companyId}, ${companyName})`,
    sql`INSERT INTO rs_sites (id, company_id, name) VALUES (${siteId}, ${companyId}, ${siteName})`,
    ...roles.queries,
    sql`INSERT INTO rs_memberships (id, user_id, company_id, role_id, scope_type, scope_id) VALUES (${randomId("member")}, ${user.id}, ${companyId}, ${roles.ids.owner}, 'company', ${companyId})`
  ]);
  return siteId;
}

/** True while the data of the old single kitchen has no owner yet: the first account claims it. */
export async function firstCompanyUnclaimed(sql: Sql): Promise<boolean> {
  const [row] = (await sql`SELECT EXISTS (SELECT 1 FROM rs_companies WHERE id = ${FIRST_COMPANY_ID}) AS present,
    EXISTS (SELECT 1 FROM rs_memberships WHERE company_id = ${FIRST_COMPANY_ID}) AS claimed`) as { present: boolean; claimed: boolean }[];
  return Boolean(row?.present && !row.claimed);
}

/** Makes the user owner of the first company, with its default roles. Fails if someone did it first. */
export async function claimFirstCompany(sql: Sql, user: SessionUser, companyName: string, siteName: string): Promise<void> {
  const roles = defaultRoles(sql, FIRST_COMPANY_ID);
  const [, , , ...rest] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(72700102)`,
    sql`UPDATE rs_companies SET name = ${companyName} WHERE id = ${FIRST_COMPANY_ID} AND NOT EXISTS (SELECT 1 FROM rs_memberships WHERE company_id = ${FIRST_COMPANY_ID})`,
    sql`UPDATE rs_sites SET name = ${siteName} WHERE company_id = ${FIRST_COMPANY_ID} AND NOT EXISTS (SELECT 1 FROM rs_memberships WHERE company_id = ${FIRST_COMPANY_ID})`,
    sql`SELECT EXISTS (SELECT 1 FROM rs_memberships WHERE company_id = ${FIRST_COMPANY_ID}) AS claimed`
  ]) as unknown[][];
  if ((rest[0] as { claimed: boolean }[])[0]?.claimed) throw new HttpError(409, "Questi dati hanno già un titolare: accedi con il suo account o fatti invitare.");
  const existing = (await sql`SELECT id, template FROM rs_roles WHERE company_id = ${FIRST_COMPANY_ID}`) as { id: string; template: string | null }[];
  const owner = existing.find((role) => role.template === "owner")?.id ?? roles.ids.owner;
  await sql.transaction([
    ...(existing.length ? [] : roles.queries),
    sql`INSERT INTO rs_memberships (id, user_id, company_id, role_id, scope_type, scope_id)
      SELECT ${randomId("member")}, ${user.id}, ${FIRST_COMPANY_ID}, ${owner}, 'company', ${FIRST_COMPANY_ID}
      WHERE NOT EXISTS (SELECT 1 FROM rs_memberships WHERE company_id = ${FIRST_COMPANY_ID})`
  ]);
}

// ——— Company administration ———

export interface CompanyDirectory {
  company: { id: string; name: string };
  areas: { id: string; name: string }[];
  sites: { id: string; name: string; areaId: string | null; kind: string }[];
  roles: { id: string; name: string; level: number; scope: ScopeType; permissions: Permission[]; template: string | null; members: number }[];
  members: { id: string; userId: string; name: string; email: string; roleId: string; scopeType: ScopeType; scopeId: string; staffId: string | null }[];
  invites: { token: string; roleId: string; scopeType: ScopeType; scopeId: string; staffId: string | null; email: string; expiresAt: string; createdAt: string }[];
}

export async function companyDirectory(sql: Sql, companyId: string): Promise<CompanyDirectory> {
  const [company, areas, sites, roles, members, invites] = await sql.transaction([
    sql`SELECT id, name FROM rs_companies WHERE id = ${companyId}`,
    sql`SELECT id, name FROM rs_areas WHERE company_id = ${companyId} ORDER BY name`,
    sql`SELECT id, name, area_id, kind FROM rs_sites WHERE company_id = ${companyId} ORDER BY created_at, name`,
    sql`SELECT r.id, r.name, r.level, r.scope, r.permissions, r.template, (SELECT count(*)::int FROM rs_memberships m WHERE m.role_id = r.id) AS members
      FROM rs_roles r WHERE r.company_id = ${companyId} ORDER BY r.level, r.name`,
    sql`SELECT m.id, m.user_id, u.name, u.email, m.role_id, m.scope_type, m.scope_id, m.staff_id FROM rs_memberships m JOIN "user" u ON u.id = m.user_id
      WHERE m.company_id = ${companyId} ORDER BY u.name`,
    sql`SELECT token, role_id, scope_type, scope_id, staff_id, email, expires_at, created_at FROM rs_invites
      WHERE company_id = ${companyId} AND accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC`
  ]) as Record<string, unknown>[][];
  if (!company[0]) throw new HttpError(404, "Compagnia non trovata.");
  return {
    company: { id: String(company[0].id), name: String(company[0].name) },
    areas: areas.map((row) => ({ id: String(row.id), name: String(row.name) })),
    sites: sites.map((row) => ({ id: String(row.id), name: String(row.name), areaId: (row.area_id as string | null) ?? null, kind: String(row.kind ?? "") })),
    roles: roles.map((row) => ({ id: String(row.id), name: String(row.name), level: Number(row.level), scope: row.scope as ScopeType,
      permissions: row.template === "owner" ? ALL_PERMISSIONS : normalizePermissions(row.permissions), template: (row.template as string | null) ?? null, members: Number(row.members) })),
    members: members.map((row) => ({ id: String(row.id), userId: String(row.user_id), name: String(row.name), email: String(row.email), roleId: String(row.role_id),
      scopeType: row.scope_type as ScopeType, scopeId: String(row.scope_id), staffId: (row.staff_id as string | null) ?? null })),
    invites: invites.map((row) => ({ token: String(row.token), roleId: String(row.role_id), scopeType: row.scope_type as ScopeType, scopeId: String(row.scope_id),
      staffId: (row.staff_id as string | null) ?? null, email: String(row.email ?? ""), expiresAt: new Date(String(row.expires_at)).toISOString(), createdAt: new Date(String(row.created_at)).toISOString() }))
  };
}

/** Checks that a scope exists in the company and returns the sites it reaches. */
export function scopeSites(directory: CompanyDirectory, scopeType: ScopeType, scopeId: string): string[] {
  if (scopeType === "company") {
    if (scopeId !== directory.company.id) throw new HttpError(400, "Ambito non valido.");
    return directory.sites.map((site) => site.id);
  }
  if (scopeType === "area") {
    if (!directory.areas.some((area) => area.id === scopeId)) throw new HttpError(400, "Area non trovata.");
    return directory.sites.filter((site) => site.areaId === scopeId).map((site) => site.id);
  }
  if (!directory.sites.some((site) => site.id === scopeId)) throw new HttpError(400, "Sede non trovata.");
  return [scopeId];
}

/** What the person acting may hand out: roles below their level, within the places they themselves reach. */
export function assertCanAssign(actor: { level: number; userId: string }, actorMemberships: MembershipRow[], directory: CompanyDirectory, roleId: string, scopeType: ScopeType, scopeId: string) {
  const role = directory.roles.find((row) => row.id === roleId);
  if (!role) throw new HttpError(400, "Ruolo non trovato.");
  if (actor.level !== 1 && role.level <= actor.level) throw new HttpError(403, "Puoi assegnare solo ruoli inferiori al tuo.");
  const target = scopeSites(directory, scopeType, scopeId);
  const reach = new Set(directory.sites.filter((site) => actorMemberships.some((row) => covers(row, { id: site.id, company_id: directory.company.id, area_id: site.areaId }))).map((site) => site.id));
  const wide = actorMemberships.some((row) => row.scope_type === "company");
  if (scopeType === "company" && !wide) throw new HttpError(403, "Solo chi lavora su tutta la compagnia può assegnare incarichi di compagnia.");
  if (scopeType === "area" && !wide && !actorMemberships.some((row) => row.scope_type === "area" && row.scope_id === scopeId)) throw new HttpError(403, "Puoi assegnare incarichi solo dove lavori tu.");
  if (target.some((site) => !reach.has(site))) throw new HttpError(403, "Puoi assegnare incarichi solo dove lavori tu.");
  return role;
}

export async function membershipsOf(sql: Sql, userId: string, companyId: string): Promise<MembershipRow[]> {
  return (await sql`SELECT id, user_id, company_id, role_id, scope_type, scope_id, staff_id FROM rs_memberships WHERE user_id = ${userId} AND company_id = ${companyId}`) as MembershipRow[];
}

export interface InviteInfo { companyName: string; roleName: string; placeName: string; expired: boolean; accepted: boolean; email: string }

export async function inviteInfo(sql: Sql, token: string): Promise<InviteInfo | null> {
  const rows = (await sql`SELECT i.email, i.scope_type, i.scope_id, i.expires_at < now() AS expired, i.accepted_at IS NOT NULL AS accepted, c.name AS company_name, r.name AS role_name,
      (SELECT name FROM rs_sites WHERE id = i.scope_id) AS site_name, (SELECT name FROM rs_areas WHERE id = i.scope_id) AS area_name
    FROM rs_invites i JOIN rs_companies c ON c.id = i.company_id JOIN rs_roles r ON r.id = i.role_id WHERE i.token = ${token}`) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  return {
    companyName: String(row.company_name), roleName: String(row.role_name),
    placeName: String(row.scope_type === "company" ? row.company_name : row.scope_type === "area" ? row.area_name ?? "" : row.site_name ?? ""),
    expired: Boolean(row.expired), accepted: Boolean(row.accepted), email: String(row.email ?? "")
  };
}

/** Turns an invite into an assignment for this user; an invite works once. */
export async function acceptInvite(sql: Sql, token: string, user: SessionUser): Promise<string> {
  const rows = (await sql`UPDATE rs_invites SET accepted_by = ${user.id}, accepted_at = now()
    WHERE token = ${token} AND accepted_at IS NULL AND expires_at > now() AND (email = '' OR lower(email) = lower(${user.email}))
    RETURNING company_id, role_id, scope_type, scope_id, staff_id`) as MembershipRow[];
  const invite = rows[0];
  if (!invite) throw new HttpError(410, "Invito non valido, già usato o scaduto: chiedine uno nuovo.");
  await sql`INSERT INTO rs_memberships (id, user_id, company_id, role_id, scope_type, scope_id, staff_id)
    VALUES (${randomId("member")}, ${user.id}, ${invite.company_id}, ${invite.role_id}, ${invite.scope_type}, ${invite.scope_id}, ${invite.staff_id})`;
  return invite.company_id;
}
