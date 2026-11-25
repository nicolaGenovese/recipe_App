// Permissions and roles shared by server and browser. A permission is one precise action; a role is
// a named set of permissions with a level (1 = highest). Companies start with the default roles and
// can change them or add their own (docs/MULTI-AZIENDA.md, section 3).

export const PERMISSIONS = [
  { key: "recipes.library", group: "Ricette e menu", label: "Modificare la libreria ricette della compagnia" },
  { key: "recipes.site", group: "Ricette e menu", label: "Creare e modificare le ricette proprie della sede" },
  { key: "menus.edit", group: "Ricette e menu", label: "Menu e prezzi della sede" },
  { key: "costs.view", group: "Ricette e menu", label: "Vedere costi e GP" },
  { key: "stock.manage", group: "Magazzino", label: "Prodotti, report stock e inventario" },
  { key: "stock.count", group: "Magazzino", label: "Conteggi di magazzino" },
  { key: "stock.deliveries", group: "Magazzino", label: "Registrare consegne e fatture" },
  { key: "prep.edit", group: "Cucina", label: "Creare e modificare le prep list" },
  { key: "prep.tick", group: "Cucina", label: "Spuntare le prep list" },
  { key: "waste.record", group: "Cucina", label: "Registrare sprechi" },
  { key: "orders.view", group: "Cucina", label: "Vedere e gestire le comande" },
  { key: "safety.record", group: "Sicurezza alimentare", label: "Compilare i registri HACCP" },
  { key: "safety.correct", group: "Sicurezza alimentare", label: "Correggere o eliminare i registri HACCP" },
  { key: "rota.view", group: "Personale", label: "Vedere i turni di tutti" },
  { key: "rota.edit", group: "Personale", label: "Modificare i turni" },
  { key: "pay.view", group: "Personale", label: "Paghe e costo del personale" },
  { key: "sales.view", group: "Andamento", label: "Vendite e andamento" },
  { key: "reports.company", group: "Andamento", label: "Confronto tra sedi (head office)" },
  { key: "settings.site", group: "Gestione", label: "Impostazioni della sede: apparecchi, checklist, limiti" },
  { key: "settings.company", group: "Gestione", label: "Impostazioni della compagnia: liste, valuta, GP, personale" },
  { key: "orders.setup", group: "Gestione", label: "Collegare la cassa e configurare le partite" },
  { key: "users.manage", group: "Gestione", label: "Invitare persone e assegnare incarichi" },
  { key: "company.manage", group: "Gestione", label: "Gestire sedi, aree e ruoli" },
  { key: "audit.view", group: "Gestione", label: "Vedere il registro delle attività" }
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map((row) => row.key);

const KNOWN = new Set<string>(ALL_PERMISSIONS);
export const isPermission = (value: unknown): value is Permission => typeof value === "string" && KNOWN.has(value);

/**
 * Permissions that only make sense together with another one: editing recipes, stock, menus or
 * sales means working with prices, and editing the rota means seeing it. Added automatically, so a
 * custom role never ends up saving prices it cannot see.
 */
const IMPLIES: Partial<Record<Permission, Permission[]>> = {
  "recipes.library": ["costs.view", "recipes.site"],
  "recipes.site": ["costs.view"],
  "menus.edit": ["costs.view"],
  "stock.manage": ["costs.view", "stock.count", "stock.deliveries"],
  "stock.deliveries": ["costs.view"],
  "sales.view": ["costs.view"],
  "reports.company": ["costs.view", "sales.view"],
  "rota.edit": ["rota.view"],
  "prep.edit": ["prep.tick"],
  "safety.correct": ["safety.record"],
  "orders.setup": ["orders.view"],
  "company.manage": ["users.manage"]
};

/** Keeps known permissions only, adds the implied ones and returns them in the fixed order. */
export function normalizePermissions(values: unknown): Permission[] {
  const set = new Set((Array.isArray(values) ? values : []).filter(isPermission));
  let grew = true;
  while (grew) {
    grew = false;
    for (const permission of Array.from(set)) {
      for (const implied of IMPLIES[permission] ?? []) if (!set.has(implied)) { set.add(implied); grew = true; }
    }
  }
  return ALL_PERMISSIONS.filter((permission) => set.has(permission));
}

/** Where an assignment applies: the whole company, one area or one site. */
export type ScopeType = "company" | "area" | "site";

export interface RoleTemplate {
  key: string;
  name: string;
  level: number;
  scope: ScopeType;
  permissions: Permission[];
}

const site: Permission[] = ["menus.edit", "stock.manage", "prep.edit", "waste.record", "safety.correct", "rota.edit", "pay.view", "sales.view", "settings.site", "users.manage", "orders.setup"];

/** The default roles every new company starts with (MULTI-AZIENDA.md, sections 2 and 3). */
export const DEFAULT_ROLES: RoleTemplate[] = [
  { key: "owner", name: "Proprietario", level: 1, scope: "company", permissions: ALL_PERMISSIONS },
  { key: "headoffice", name: "Head office", level: 2, scope: "company", permissions: ALL_PERMISSIONS },
  { key: "area", name: "Area manager", level: 3, scope: "area", permissions: normalizePermissions([...site, "reports.company", "audit.view"]) },
  { key: "gm", name: "General manager", level: 4, scope: "site", permissions: normalizePermissions([...site, "audit.view"]) },
  { key: "headchef", name: "Head chef", level: 5, scope: "site", permissions: normalizePermissions([...site, "recipes.site"]) },
  { key: "sous", name: "Sous chef", level: 6, scope: "site", permissions: normalizePermissions(["costs.view", "stock.manage", "prep.edit", "waste.record", "safety.record", "rota.edit", "orders.view"]) },
  { key: "cdp", name: "Chef de partie / Commis", level: 7, scope: "site", permissions: normalizePermissions(["stock.count", "prep.tick", "waste.record", "safety.record", "orders.view"]) },
  { key: "kp", name: "Kitchen porter", level: 8, scope: "site", permissions: normalizePermissions(["prep.tick", "waste.record", "safety.record"]) }
];

/** The role a user may hand out: only roles strictly below their own best level (owners can create owners). */
export function canAssignLevel(ownLevel: number, roleLevel: number): boolean {
  return ownLevel === 1 || roleLevel > ownLevel;
}

/** What the browser knows about the signed-in user at the chosen site. Null in local mode (everything allowed). */
export interface AccessInfo {
  user: { id: string; name: string; email: string };
  company: { id: string; name: string };
  site: { id: string; name: string };
  /** Sites this user can open, with their area. */
  sites: { id: string; name: string; areaId: string | null; companyId: string; companyName: string }[];
  permissions: Permission[];
  /** Best (lowest) role level at this site; 1 is the owner. */
  level: number;
  roles: string[];
  /** The staff member linked to this account at this company, when there is one. */
  staffId: string | null;
}

export const canDo = (access: AccessInfo | null | undefined, permission: Permission) => !access || access.permissions.includes(permission);
