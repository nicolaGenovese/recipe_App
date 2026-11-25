import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, DEFAULT_ROLES, canAssignLevel, normalizePermissions, type AccessInfo } from "@/lib/access/permissions";
import { keepHiddenPay, redactState } from "@/lib/access/redact";
import { buildAccess, covers } from "@/lib/server/directory";
import { onlyStockCountChanged, onlyTicksChanged, recipePermission, safetyEditPermission } from "@/lib/server/guards";
import { joinStockItem, splitStockItem, staffAtSite } from "@/lib/server/store/neon-store";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import type { AppState, PrepList, StockItem } from "@/lib/types";

const user = { id: "u1", name: "Ana", email: "ana@example.test" };
const sites = [
  { id: "s1", company_id: "c1", area_id: "a1", name: "Tavern", kind: "" },
  { id: "s2", company_id: "c1", area_id: null, name: "Kitchen", kind: "" },
  { id: "s3", company_id: "c2", area_id: null, name: "Other", kind: "" }
];
const row = (scope_type: "company" | "area" | "site", scope_id: string, level: number, permissions: string[], company_id = "c1") =>
  ({ id: "m" + level, user_id: "u1", company_id, role_id: "r" + level, scope_type, scope_id, staff_id: null, role_name: "R" + level, level, permissions: permissions as never, company_name: "Co " + company_id });

describe("permissions", () => {
  it("adds implied permissions and drops unknown ones", () => {
    expect(normalizePermissions(["recipes.library", "nonsense"])).toEqual(["recipes.library", "recipes.site", "costs.view"]);
    expect(normalizePermissions(["rota.edit"])).toEqual(["rota.view", "rota.edit"]);
  });

  it("follows the role table of the docs", () => {
    const role = (key: string) => DEFAULT_ROLES.find((row) => row.key === key)!;
    expect(role("owner").permissions).toEqual(ALL_PERMISSIONS);
    expect(role("kp").permissions).toEqual(["prep.tick", "waste.record", "safety.record"]);
    expect(role("headchef").permissions).toContain("recipes.site");
    expect(role("headchef").permissions).not.toContain("recipes.library");
    expect(role("sous").permissions).not.toContain("pay.view");
    expect(role("gm").permissions).not.toContain("company.manage");
  });

  it("hands out only roles below one's own", () => {
    expect(canAssignLevel(5, 7)).toBe(true);
    expect(canAssignLevel(5, 5)).toBe(false);
    expect(canAssignLevel(5, 4)).toBe(false);
    expect(canAssignLevel(1, 1)).toBe(true);
  });
});

describe("scopes", () => {
  it("reaches the right sites", () => {
    expect(covers(row("company", "c1", 1, []), sites[0])).toBe(true);
    expect(covers(row("company", "c1", 1, []), sites[2])).toBe(false);
    expect(covers(row("area", "a1", 3, []), sites[0])).toBe(true);
    expect(covers(row("area", "a1", 3, []), sites[1])).toBe(false);
    expect(covers(row("site", "s2", 5, []), sites[1])).toBe(true);
  });

  it("joins the permissions of every assignment at the chosen site", () => {
    const rows = [row("site", "s1", 5, ["menus.edit"]), row("site", "s2", 7, ["prep.tick"]), row("company", "c2", 8, ["waste.record"], "c2")];
    const atTavern = buildAccess(user, rows, sites, "s1")!;
    expect(atTavern.site.id).toBe("s1");
    expect(atTavern.permissions).toContain("menus.edit");
    expect(atTavern.permissions).not.toContain("prep.tick");
    expect(atTavern.sites.map((site) => site.id)).toEqual(["s1", "s2", "s3"]);
    const atKitchen = buildAccess(user, rows, sites, "s2")!;
    expect(atKitchen.level).toBe(7);
    expect(buildAccess(user, rows, sites, "nowhere")!.site.id).toBe("s1");
    expect(buildAccess(user, [], sites)).toBeNull();
  });
});

describe("hidden data", () => {
  const state = {
    recipes: [{ id: "r", name: "Pie", category: "", portions: 1, archivedBatch: false, sellingPrice: 12, ingredients: [{ type: "Prodotto", name: "Flour", supplier: "", quantity: 1, unit: "kg", unitCost: 2, allergens: [], kcal: 0 }] }],
    settings: { ...DEFAULT_SETTINGS, staff: [{ id: "st1", name: "Kai", hourlyRate: 12, active: true }, { id: "st2", name: "Bo", hourlyRate: 14, active: true }] },
    stockItems: [{ id: "i", name: "Flour", price: 9 } as StockItem], stockReports: [], stockDeliveries: [], menus: [], prepLists: [],
    rotaWeeks: [{ id: "2026-11-16", rows: [{ name: "Kai", shifts: ["9-5", "", "", "", "", "", ""] }, { name: "Bo", shifts: ["", "9-5", "", "", "", "", ""] }], createdAt: "", updatedAt: "" }],
    safetyLogs: [], wasteLogs: [], salesWeeks: [{ id: "w", lines: [], createdAt: "", updatedAt: "" }], storage: "neon"
  } as unknown as AppState;
  const access = (permissions: string[], staffId: string | null = null): AccessInfo => ({
    user, company: { id: "c1", name: "Co" }, site: { id: "s1", name: "Tavern" }, sites: [], permissions: permissions as never, level: 8, roles: [], staffId
  });

  it("hides prices, pay, takings and other people's shifts", () => {
    const seen = redactState(state, access(["prep.tick"], "st1"));
    expect(seen.recipes[0].sellingPrice).toBe(0);
    expect(seen.recipes[0].ingredients[0].unitCost).toBe(0);
    expect(seen.stockItems[0].price).toBe(0);
    expect(seen.settings.staff.map((member) => member.hourlyRate)).toEqual([0, 0]);
    expect(seen.salesWeeks).toEqual([]);
    expect(seen.rotaWeeks[0].rows.map((line) => line.name)).toEqual(["Kai"]);
  });

  it("leaves everything to whoever may see it", () => {
    expect(redactState(state, access(normalizePermissions(["costs.view", "pay.view", "rota.view", "sales.view"])))).toEqual(state);
    expect(redactState(state, null)).toBe(state);
  });

  it("keeps the stored pay when someone who cannot see it saves the settings", () => {
    const sent = redactState(state, access([])).settings;
    expect(keepHiddenPay(sent, state.settings).staff.map((member) => member.hourlyRate)).toEqual([12, 14]);
  });
});

describe("write guards", () => {
  it("tells library recipes from site recipes", () => {
    expect(recipePermission(undefined, false, "s1")).toBe("recipes.library");
    expect(recipePermission(undefined, true, "s1")).toBe("recipes.site");
    expect(recipePermission("s1", true, "s1")).toBe("recipes.site");
    expect(recipePermission(null, true, "s1")).toBe("recipes.library");
    expect(() => recipePermission("s2", true, "s1")).toThrow();
  });

  it("lets counting change only the stock on hand", () => {
    const item = { id: "i", name: "Flour", price: 9, initialStock: 2 } as StockItem;
    expect(onlyStockCountChanged(item, { ...item, initialStock: 5, stockCount: { quantity: 5, date: "", at: "" } })).toBe(true);
    expect(onlyStockCountChanged(item, { ...item, price: 1 })).toBe(false);
    expect(onlyStockCountChanged(null, item)).toBe(false);
  });

  it("lets ticking change only done and amounts prepared", () => {
    const list = { id: "p", name: "Mon", date: "", menuIds: [], portions: {}, tasks: [{ id: "t", name: "Peel", quantity: 2, onHand: 0, unit: "kg", recipeIds: [], done: false }], createdAt: "", updatedAt: "a" } as PrepList;
    expect(onlyTicksChanged(list, { ...list, updatedAt: "b", tasks: [{ ...list.tasks[0], done: true, onHand: 2 }] })).toBe(true);
    expect(onlyTicksChanged(list, { ...list, tasks: [{ ...list.tasks[0], quantity: 9 }] })).toBe(false);
  });

  it("asks for safety.correct only for records of past days", () => {
    expect(safetyEditPermission(null, "2026-11-18")).toBe("safety.record");
    expect(safetyEditPermission("2026-11-18", "2026-11-18")).toBe("safety.record");
    expect(safetyEditPermission("2026-11-10", "2026-11-18")).toBe("safety.correct");
  });
});

describe("company and site data", () => {
  it("keeps the stock on hand per site", () => {
    const { company, site } = splitStockItem({ id: "i", name: "Flour", price: 9, initialStock: 3, parLevel: 2 } as StockItem);
    expect(company).toEqual({ id: "i", name: "Flour", price: 9 });
    expect(site).toEqual({ initialStock: 3, parLevel: 2 });
    expect(joinStockItem({ ...company, initialStock: 99 }, undefined).initialStock).toBe(0);
    expect(joinStockItem(company, { initialStock: 4 }).initialStock).toBe(4);
  });

  it("puts staff without sites at every site", () => {
    const staff = [{ id: "a", name: "A", hourlyRate: 0, active: true }, { id: "b", name: "B", hourlyRate: 0, active: true, siteIds: ["s2"] }];
    expect(staffAtSite(staff, "s1").map((member) => member.id)).toEqual(["a"]);
    expect(staffAtSite(staff, "s2").map((member) => member.id)).toEqual(["a", "b"]);
  });
});

describe("kitchen order permissions", () => {
  const role = (key: string) => DEFAULT_ROLES.find((row) => row.key === key)?.permissions ?? [];
  it("every kitchen role sees the orders, the head chef and above connect the till", () => {
    for (const key of ["owner", "headoffice", "area", "gm", "headchef", "sous", "cdp"]) expect(role(key)).toContain("orders.view");
    expect(role("kp")).not.toContain("orders.view");
    for (const key of ["gm", "headchef"]) expect(role(key)).toContain("orders.setup");
    expect(role("sous")).not.toContain("orders.setup");
    expect(normalizePermissions(["orders.setup"])).toEqual(["orders.view", "orders.setup"]);
  });
});
