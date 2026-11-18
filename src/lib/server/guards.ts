import type { Permission } from "@/lib/access/permissions";
import type { RequestContext } from "@/lib/server/auth/context";
import { SITE_STOCK_FIELDS } from "@/lib/server/store/neon-store";
import { HttpError } from "@/lib/server/validation";
import type { PrepList, StockItem } from "@/lib/types";

/**
 * Library recipes belong to the company and need "recipes.library"; a site's own recipes need
 * "recipes.site". Moving a recipe in or out of the library counts as touching the library.
 */
export function recipePermission(existingSite: string | null | undefined, toSite: boolean, siteId: string): Permission {
  if (existingSite && existingSite !== siteId) throw new HttpError(403, "Questa ricetta appartiene a un'altra sede.");
  const library = existingSite === null || !toSite;
  return library ? "recipes.library" : "recipes.site";
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Did only the stock on hand change? That is all "stock.count" allows on a product. */
export function onlyStockCountChanged(before: StockItem | null, after: StockItem): boolean {
  if (!before) return false;
  const strip = (item: StockItem) => {
    const copy: Record<string, unknown> = { ...item };
    for (const field of SITE_STOCK_FIELDS) delete copy[field];
    return copy;
  };
  return same(strip(before), strip(after));
}

/** Did only ticks and amounts already prepared change? That is all "prep.tick" allows on a prep list. */
export function onlyTicksChanged(before: PrepList | null, after: PrepList): boolean {
  if (!before) return false;
  const strip = (list: PrepList) => ({ ...list, updatedAt: "", tasks: list.tasks.map((task) => ({ ...task, done: false, onHand: 0 })) });
  return same(strip(before), strip(after));
}

/** Today's date in the kitchen (UK time), as YYYY-MM-DD. */
export function kitchenToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * A food safety record written today can be fixed by whoever records checks; older records, and any
 * deletion, need "safety.correct". The previous copy is always kept.
 */
export function safetyEditPermission(existingDate: string | null, today = kitchenToday()): Permission {
  return existingDate === null || existingDate === today ? "safety.record" : "safety.correct";
}

/** The name written in the activity log and in kept versions. */
export const actorOf = (context: RequestContext) => ({ id: context.user?.id ?? null, name: context.user?.name ?? "" });

export async function audit(context: RequestContext, action: string, target: string, detail?: unknown, siteWide = false) {
  const actor = actorOf(context);
  await context.store.audit({ userId: actor.id, userName: actor.name, action, target, detail, siteWide });
}
