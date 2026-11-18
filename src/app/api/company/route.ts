import { canAssignLevel, normalizePermissions, type ScopeType } from "@/lib/access/permissions";
import { requireContext, type RequestContext } from "@/lib/server/auth/context";
import { database, randomId } from "@/lib/server/db";
import { assertCanAssign, companyDirectory, membershipsOf, scopeSites } from "@/lib/server/directory";
import { audit } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { HttpError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

const text = (value: unknown, max = 80) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const SCOPES: ScopeType[] = ["company", "area", "site"];
const INVITE_DAYS = 14;

function need() {
  const db = database();
  if (!db) throw new HttpError(404, "La gestione della compagnia richiede il database.");
  return db.sql;
}

/** GET /api/company: sites, areas, roles, people and open invites; ?audit=1 the activity log. */
export const GET = handle(async (request: Request) => {
  const sql = need();
  const context = await requireContext(request);
  if (new URL(request.url).searchParams.get("audit")) {
    context.require("audit.view");
    return json(await context.store.auditLog(300));
  }
  if (!context.can("users.manage") && !context.can("company.manage")) context.require("users.manage");
  return json(await companyDirectory(sql, context.scope.companyId));
});

/** POST /api/company { action, ... } changes the company. Every change is checked here and logged. */
export const POST = handle(async (request: Request) => {
  const sql = need();
  const context = await requireContext(request);
  const companyId = context.scope.companyId;
  const body = (await readJson(request)) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const directory = await companyDirectory(sql, companyId);
  const log = (what: string, target: string, detail?: unknown) => audit(context, what, target, detail, true);

  switch (action) {
    case "renameCompany": {
      context.require("company.manage");
      const name = text(body.name);
      if (!name) throw new HttpError(400, "Scrivi un nome.");
      await sql`UPDATE rs_companies SET name = ${name} WHERE id = ${companyId}`;
      await log("company", name);
      break;
    }
    case "saveArea": {
      context.require("company.manage");
      const name = text(body.name);
      if (!name) throw new HttpError(400, "Scrivi un nome.");
      const id = text(body.id) || randomId("area");
      if (body.id && !directory.areas.some((area) => area.id === id)) throw new HttpError(404, "Area non trovata.");
      await sql`INSERT INTO rs_areas (id, company_id, name) VALUES (${id}, ${companyId}, ${name}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name WHERE rs_areas.company_id = ${companyId}`;
      await log("area", name);
      break;
    }
    case "deleteArea": {
      context.require("company.manage");
      const id = text(body.id);
      if (!directory.areas.some((area) => area.id === id)) throw new HttpError(404, "Area non trovata.");
      if (directory.members.some((row) => row.scopeType === "area" && row.scopeId === id) || directory.invites.some((row) => row.scopeType === "area" && row.scopeId === id)) {
        throw new HttpError(409, "Prima togli gli incarichi e gli inviti su quest'area.");
      }
      await sql`DELETE FROM rs_areas WHERE id = ${id} AND company_id = ${companyId}`;
      await log("area-deleted", directory.areas.find((area) => area.id === id)?.name ?? id);
      break;
    }
    case "saveSite": {
      context.require("company.manage");
      const name = text(body.name);
      if (!name) throw new HttpError(400, "Scrivi un nome.");
      const areaId = text(body.areaId) || null;
      if (areaId && !directory.areas.some((area) => area.id === areaId)) throw new HttpError(404, "Area non trovata.");
      const kind = text(body.kind, 30);
      const id = text(body.id);
      if (id) {
        if (!directory.sites.some((site) => site.id === id)) throw new HttpError(404, "Sede non trovata.");
        await sql`UPDATE rs_sites SET name = ${name}, area_id = ${areaId}, kind = ${kind} WHERE id = ${id} AND company_id = ${companyId}`;
      } else {
        await sql`INSERT INTO rs_sites (id, company_id, area_id, name, kind) VALUES (${randomId("site")}, ${companyId}, ${areaId}, ${name}, ${kind})`;
      }
      await log("site", name);
      break;
    }
    case "deleteSite": {
      context.require("company.manage");
      const id = text(body.id);
      if (!directory.sites.some((site) => site.id === id)) throw new HttpError(404, "Sede non trovata.");
      if (directory.sites.length === 1) throw new HttpError(409, "La compagnia deve avere almeno una sede.");
      if (directory.members.some((row) => row.scopeType === "site" && row.scopeId === id)) throw new HttpError(409, "Prima togli gli incarichi su questa sede.");
      // Food safety records must be kept: a site with any data cannot be deleted.
      const [row] = (await sql`SELECT
        (SELECT count(*) FROM recipe_studio_safety_logs WHERE site_id = ${id}) + (SELECT count(*) FROM recipe_studio_rota_weeks WHERE site_id = ${id}) +
        (SELECT count(*) FROM recipe_studio_menus WHERE site_id = ${id}) + (SELECT count(*) FROM recipe_studio_stock_deliveries WHERE site_id = ${id}) +
        (SELECT count(*) FROM recipe_studio_stock_reports WHERE site_id = ${id}) + (SELECT count(*) FROM recipe_studio_prep_lists WHERE site_id = ${id}) +
        (SELECT count(*) FROM recipe_studio_waste_logs WHERE site_id = ${id}) + (SELECT count(*) FROM recipe_studio_sales_weeks WHERE site_id = ${id}) AS total`) as { total: number }[];
      if (Number(row?.total) > 0) throw new HttpError(409, "Questa sede ha già dei dati (registri, turni, menu…): non si può eliminare.");
      await sql.transaction([
        sql`DELETE FROM rs_invites WHERE company_id = ${companyId} AND scope_type = 'site' AND scope_id = ${id}`,
        sql`DELETE FROM rs_site_stock WHERE site_id = ${id}`,
        sql`DELETE FROM rs_site_settings WHERE site_id = ${id}`,
        sql`DELETE FROM recipe_studio_recipes WHERE company_id = ${companyId} AND site_id = ${id}`,
        sql`DELETE FROM rs_sites WHERE id = ${id} AND company_id = ${companyId}`
      ]);
      await log("site-deleted", directory.sites.find((site) => site.id === id)?.name ?? id);
      break;
    }
    case "saveRole": {
      context.require("company.manage");
      const name = text(body.name, 60);
      if (!name) throw new HttpError(400, "Scrivi un nome.");
      const scope = SCOPES.includes(body.scope as ScopeType) ? (body.scope as ScopeType) : "site";
      const id = text(body.id);
      const existing = id ? directory.roles.find((role) => role.id === id) : undefined;
      if (id && !existing) throw new HttpError(404, "Ruolo non trovato.");
      const own = context.access?.level ?? 1;
      if (existing?.template === "owner") {
        // The owner role always keeps every permission and level 1; only its name can change.
        await sql`UPDATE rs_roles SET name = ${name} WHERE id = ${id} AND company_id = ${companyId}`;
        await log("role", name);
        break;
      }
      const level = Math.min(20, Math.max(2, Math.round(Number(body.level) || 9)));
      if (!canAssignLevel(own, level) || (existing && !canAssignLevel(own, existing.level))) throw new HttpError(403, "Puoi creare o cambiare solo ruoli inferiori al tuo.");
      const permissions = normalizePermissions(body.permissions);
      if (existing) {
        await sql`UPDATE rs_roles SET name = ${name}, level = ${level}, scope = ${scope}, permissions = ${JSON.stringify(permissions)}::jsonb WHERE id = ${id} AND company_id = ${companyId}`;
      } else {
        await sql`INSERT INTO rs_roles (id, company_id, name, level, scope, permissions) VALUES (${randomId("role")}, ${companyId}, ${name}, ${level}, ${scope}, ${JSON.stringify(permissions)}::jsonb)`;
      }
      await log("role", name, { level, permissions, before: existing ? { level: existing.level, permissions: existing.permissions } : null });
      break;
    }
    case "deleteRole": {
      context.require("company.manage");
      const role = directory.roles.find((row) => row.id === text(body.id));
      if (!role) throw new HttpError(404, "Ruolo non trovato.");
      if (role.template === "owner") throw new HttpError(409, "Il ruolo del proprietario non si può eliminare.");
      if (role.members || directory.invites.some((row) => row.roleId === role.id)) throw new HttpError(409, "Il ruolo è assegnato a qualcuno: cambia prima i suoi incarichi.");
      if (!canAssignLevel(context.access?.level ?? 1, role.level)) throw new HttpError(403, "Puoi eliminare solo ruoli inferiori al tuo.");
      await sql`DELETE FROM rs_roles WHERE id = ${role.id} AND company_id = ${companyId}`;
      await log("role-deleted", role.name);
      break;
    }
    case "invite": {
      context.require("users.manage");
      const scopeType = (SCOPES.includes(body.scopeType as ScopeType) ? body.scopeType : "site") as ScopeType;
      const scopeId = text(body.scopeId, 64);
      const role = assertCanAssign(actor(context), await membershipsOf(sql, context.user!.id, companyId), directory, text(body.roleId, 64), scopeType, scopeId);
      const email = text(body.email, 200).toLowerCase();
      const staffId = text(body.staffId, 64) || null;
      const token = randomId("inv", 24);
      await sql`INSERT INTO rs_invites (token, company_id, role_id, scope_type, scope_id, staff_id, email, created_by, expires_at)
        VALUES (${token}, ${companyId}, ${role.id}, ${scopeType}, ${scopeId}, ${staffId}, ${email}, ${context.user!.id}, now() + make_interval(days => ${INVITE_DAYS}))`;
      await log("invite", email || role.name, { role: role.name, scopeType, scopeId });
      return json({ token });
    }
    case "revokeInvite": {
      context.require("users.manage");
      await sql`DELETE FROM rs_invites WHERE token = ${text(body.token, 80)} AND company_id = ${companyId} AND accepted_at IS NULL`;
      break;
    }
    case "updateMember":
    case "removeMember": {
      context.require("users.manage");
      const member = directory.members.find((row) => row.id === text(body.id, 64));
      if (!member) throw new HttpError(404, "Persona non trovata.");
      const current = directory.roles.find((role) => role.id === member.roleId);
      const own = context.access?.level ?? 1;
      const self = member.userId === context.user?.id;
      if (!self && current && !canAssignLevel(own, current.level)) throw new HttpError(403, "Non puoi cambiare l'incarico di chi ha un ruolo pari o superiore al tuo.");
      const owners = directory.members.filter((row) => directory.roles.find((role) => role.id === row.roleId)?.template === "owner");
      const lastOwner = current?.template === "owner" && owners.length === 1;
      if (action === "removeMember") {
        if (lastOwner) throw new HttpError(409, "La compagnia deve avere almeno un proprietario.");
        await sql`DELETE FROM rs_memberships WHERE id = ${member.id} AND company_id = ${companyId}`;
        await log("member-removed", member.name, { role: current?.name });
        break;
      }
      const roleId = text(body.roleId, 64) || member.roleId;
      const scopeType = (SCOPES.includes(body.scopeType as ScopeType) ? body.scopeType : member.scopeType) as ScopeType;
      const scopeId = text(body.scopeId, 64) || member.scopeId;
      const staffId = body.staffId === undefined ? member.staffId : text(body.staffId, 64) || null;
      const changesRole = roleId !== member.roleId || scopeType !== member.scopeType || scopeId !== member.scopeId;
      if (changesRole) {
        if (lastOwner && roleId !== member.roleId) throw new HttpError(409, "La compagnia deve avere almeno un proprietario.");
        assertCanAssign(actor(context), await membershipsOf(sql, context.user!.id, companyId), directory, roleId, scopeType, scopeId);
      } else scopeSites(directory, scopeType, scopeId);
      await sql`UPDATE rs_memberships SET role_id = ${roleId}, scope_type = ${scopeType}, scope_id = ${scopeId}, staff_id = ${staffId} WHERE id = ${member.id} AND company_id = ${companyId}`;
      await log("member", member.name, { role: directory.roles.find((role) => role.id === roleId)?.name, scopeType, scopeId, staffId, before: current?.name });
      break;
    }
    default:
      throw new HttpError(400, "Operazione non valida.");
  }
  return json(await companyDirectory(sql, companyId));
});

const actor = (context: RequestContext) => ({ level: context.access?.level ?? 1, userId: context.user?.id ?? "" });
