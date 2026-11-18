import type { AccessInfo, Permission } from "@/lib/access/permissions";
import type { AppState, Settings } from "@/lib/types";

/**
 * Removes from the archive what the user may not see before it leaves the server: pay without
 * "pay.view", prices and takings without "costs.view", other people's shifts without "rota.view".
 * Hidden numbers become 0 or null, so every screen keeps working.
 */
export function redactState(state: AppState, access: AccessInfo | null | undefined): AppState {
  if (!access) return state;
  const can = (permission: Permission) => access.level === 1 || access.permissions.includes(permission);
  let next: AppState = { ...state };

  if (!can("pay.view")) {
    next.settings = { ...next.settings, staff: next.settings.staff.map((member) => ({ ...member, hourlyRate: 0 })), labour: { ...next.settings.labour, onCostPercent: 0, rates: undefined } };
  }
  if (!can("costs.view")) {
    next = {
      ...next,
      recipes: next.recipes.map((recipe) => ({ ...recipe, sellingPrice: 0, ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient, unitCost: 0 })) })),
      stockItems: next.stockItems.map((item) => ({ ...item, price: 0 })),
      stockDeliveries: next.stockDeliveries.map((delivery) => ({ ...delivery, invoiceAmount: null, lines: delivery.lines.map((line) => ({ ...line, price: 0 })) })),
      stockReports: next.stockReports.map((report) => ({ ...report, transfer: 0, netSales: 0, invoicesTotal: null, openingTotal: null, deliveryAdjustment: 0,
        lines: report.lines.map((line) => ({ ...line, price: 0, receivedValue: 0 })) })),
      wasteLogs: next.wasteLogs.map((log) => ({ ...log, unitCost: 0 }))
    };
  }
  if (!can("sales.view")) next.salesWeeks = [];
  if (!can("stock.manage") && !can("stock.count")) next.stockReports = [];
  if (!can("rota.view")) {
    // Only the person's own line, found through the staff member linked to the account.
    const own = next.settings.staff.find((member) => member.id === access.staffId)?.name.trim().toLocaleLowerCase();
    const mine = (name: string) => Boolean(own) && name.trim().toLocaleLowerCase() === own;
    next.rotaWeeks = next.rotaWeeks.map((week) => ({ ...week, rows: week.rows.filter((row) => mine(row.name)) }));
    next.sharedShifts = (next.sharedShifts ?? []).filter((shift) => mine(shift.name));
  }
  return next;
}

/**
 * Settings saved by someone who cannot see pay keep the stored rates and on-cost: the zeros they
 * were sent must not overwrite the real values.
 */
export function keepHiddenPay(incoming: Settings, stored: Settings): Settings {
  const rates = new Map(stored.staff.map((member) => [member.id, member.hourlyRate]));
  return {
    ...incoming,
    staff: incoming.staff.map((member) => ({ ...member, hourlyRate: rates.get(member.id) ?? 0 })),
    labour: { ...incoming.labour, onCostPercent: stored.labour.onCostPercent }
  };
}
