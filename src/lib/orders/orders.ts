import type { KitchenOrder, OrderLine, OrderStatus, OrdersConfig, PosEvent, PosLine, PosOrder, PosSale, ReadyMark, Station, StoredOrder } from "@/lib/orders/types";
import { DEFAULT_ORDERS_CONFIG } from "@/lib/orders/types";
import type { Recipe } from "@/lib/types";

// What a till notice does to an order on the kitchen screen, and to the sales. Pure functions, shared
// by the server (webhook) and tested on their own.

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const lower = (value: string | undefined) => (value ?? "").trim().toLocaleLowerCase();

/** Same dish for matching: lower case, no accents, single spaces. */
export function dishKey(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Key of a line for the kitchen ticks: a line changed by the till must be marked ready again. */
export const lineKey = (line: Pick<OrderLine, "id" | "rev">) => (line.rev ? line.id + "~" + line.rev : line.id);

const header = (event: PosEvent) => ({
  ...(event.number ? { number: event.number } : {}),
  ...(event.table ? { table: event.table } : {}),
  ...(event.covers ? { covers: event.covers } : {}),
  ...(event.server ? { server: event.server } : {}),
  ...(event.channel ? { channel: event.channel } : {}),
  ...(event.note ? { note: event.note } : {})
});

/** A till line as it should look now, given how it looked before. */
function changedLine(before: OrderLine, after: PosLine, fired: string[], now: string): OrderLine {
  const content = (line: PosLine) => [line.name, line.quantity, line.modifiers, line.note ?? ""];
  const changed = !same(content(before), content(after));
  const held = after.held && !(after.course && fired.some((course) => lower(course) === lower(after.course))) ? true : undefined;
  return {
    ...after,
    held,
    ...(before.addedAt ? { addedAt: before.addedAt } : {}),
    ...(after.voided ? { voidedAt: before.voidedAt ?? now } : {}),
    ...(changed ? { changedAt: now, rev: (before.rev ?? 0) + 1 } : { ...(before.changedAt ? { changedAt: before.changedAt } : {}), ...(before.rev ? { rev: before.rev } : {}) })
  };
}

const firedCourse = (line: PosLine, fired: string[]) => Boolean(line.course) && fired.some((course) => lower(course) === lower(line.course));

/**
 * New lines from the till over the lines already in the kitchen. Lines that disappeared are kept,
 * struck through, so the kitchen sees what was taken off; lines that appeared are marked as added.
 */
function mergeLines(before: OrderLine[], incoming: PosLine[], fired: string[], now: string): OrderLine[] {
  const byId = new Map(before.map((line) => [line.id, line]));
  const result: OrderLine[] = incoming.map((line) => {
    const old = byId.get(line.id);
    byId.delete(line.id);
    if (old) return changedLine(old, line, fired, now);
    const held = line.held && !firedCourse(line, fired) ? true : undefined;
    return { ...line, held, addedAt: now, ...(line.voided ? { voidedAt: now } : {}) };
  });
  for (const gone of byId.values()) result.push(gone.voided ? gone : { ...gone, voided: true, voidedAt: now });
  return result;
}

export interface Applied {
  /** The till part to store, or null when the notice does not touch the kitchen screen. */
  pos: PosOrder | null;
  status?: OrderStatus;
}

/**
 * What a notice does to the kitchen screen. New orders appear; updates replace the lines (tills send
 * the whole order); "away" releases held courses; a void without lines cancels the whole order.
 * Payments and refunds only touch the sales, except that the order is marked as paid.
 */
export function applyPosEvent(before: PosOrder | null, event: PosEvent, now: string, test = false): Applied {
  const visible = (lines: PosLine[]) => lines.filter((line) => !line.voided);
  switch (event.kind) {
    case "order":
    case "update": {
      if (!before) {
        if (!visible(event.lines).length) return { pos: null };
        return {
          pos: {
            externalId: event.orderId ?? "", ...header(event), allergies: event.allergies, receivedAt: now, fired: [],
            ...(test ? { test: true } : {}),
            lines: event.lines.map((line) => ({ ...line, held: line.held ? true : undefined, ...(line.voided ? { voidedAt: now } : {}) }))
          },
          status: "open"
        };
      }
      const lines = event.lines.length ? mergeLines(before.lines, event.lines, before.fired, now) : before.lines;
      const changed = !same(lines.map((line) => [line.id, line.rev, line.voided, line.held]), before.lines.map((line) => [line.id, line.rev, line.voided, line.held]));
      return {
        pos: {
          ...before, ...header(event), allergies: event.allergies.length ? event.allergies : before.allergies, lines,
          ...(changed ? { changedAt: now } : {})
        }
      };
    }
    case "fire": {
      if (!before) return { pos: null };
      // No course named: everything on hold goes.
      const courses = event.fired.length ? event.fired : Array.from(new Set(before.lines.filter((line) => line.held).map((line) => line.course ?? "")));
      const fired = Array.from(new Set([...before.fired, ...courses.filter(Boolean)]));
      const all = !event.fired.length;
      const lines = before.lines.map((line) => (line.held && (all || firedCourse(line, courses)) ? { ...line, held: undefined, firedAt: now } : line));
      return { pos: { ...before, fired, lines, changedAt: now } };
    }
    case "void": {
      if (!before) return { pos: null };
      const targets = event.lines.filter((line) => line.name);
      if (!targets.length) return { pos: { ...before, changedAt: now }, status: "cancelled" };
      // Voids of single lines: by id, or by name when the till sends other ids in the void notice.
      const ids = new Set(targets.map((line) => line.id));
      const names = targets.map((line) => dishKey(line.name));
      const lines = before.lines.map((line) => {
        if (line.voided) return line;
        const hit = ids.has(line.id) || names.includes(dishKey(line.name));
        if (!hit) return line;
        names.splice(names.indexOf(dishKey(line.name)), 1);
        return { ...line, voided: true, voidedAt: now };
      });
      const allGone = lines.every((line) => line.voided);
      return { pos: { ...before, lines, changedAt: now }, ...(allGone ? { status: "cancelled" as const } : {}) };
    }
    case "paid":
      return { pos: before && !before.paid ? { ...before, paid: true } : null };
    default:
      return { pos: null };
  }
}

/** Does a till line or a recipe fall under one of these words (category, course, dish name, PLU)? */
export function matchesAny(words: string[], line: Pick<PosLine, "name" | "category" | "course" | "plu">, recipe?: Pick<Recipe, "category"> | undefined): boolean {
  if (!words.length) return false;
  const keys = new Set([line.category, line.course, line.name, line.plu, recipe?.category].filter(Boolean).map((value) => dishKey(String(value))));
  return words.some((word) => keys.has(dishKey(word)));
}

/** Recipe of a till dish: matched by hand in the settings (PLU first), or with exactly the same name. */
export function resolveRecipe(line: Pick<PosLine, "name" | "plu">, dishMap: Record<string, string>, recipes: Pick<Recipe, "id" | "name" | "archivedBatch">[]): string | undefined {
  const byHand = (line.plu && dishMap["plu:" + line.plu]) || dishMap["name:" + dishKey(line.name)];
  if (byHand && recipes.some((recipe) => recipe.id === byHand)) return byHand;
  const key = dishKey(line.name);
  const same = recipes.filter((recipe) => dishKey(recipe.name) === key);
  return (same.find((recipe) => !recipe.archivedBatch) ?? same[0])?.id;
}

/** The key saved when someone matches a till dish to a recipe: its PLU when it has one, otherwise its name. */
export const mapKey = (item: { name: string; plu?: string }) => (item.plu ? "plu:" + item.plu : "name:" + dishKey(item.name));

/**
 * Stations a line goes to. A line no station claims goes to the stations marked as fallback; with no
 * fallback it shows only on the pass.
 */
export function stationsOf(line: Pick<PosLine, "name" | "category" | "course" | "plu">, recipe: Pick<Recipe, "category"> | undefined, stations: Station[]): string[] {
  const hits = stations.filter((station) => matchesAny(station.match, line, recipe)).map((station) => station.id);
  return hits.length ? hits : stations.filter((station) => station.fallback).map((station) => station.id);
}

/** Joins the till part and the kitchen part for the screens. */
export function toKitchenOrder(order: StoredOrder): KitchenOrder {
  const { lines: ticks = {}, ...kitchen } = order.kitchen ?? {};
  return {
    ...order.pos, ...kitchen,
    id: order.id, status: order.status, version: order.version, updatedAt: order.updatedAt,
    lines: order.pos.lines.map((line) => {
      const key = lineKey(line);
      const ready: ReadyMark | undefined = ticks[key];
      return { ...line, key, ...(ready ? { ready } : {}) };
    })
  };
}

/** Lines the kitchen still has to make: not voided, not food excluded. Held courses count. */
export const activeLines = (order: KitchenOrder, notFood: string[]) => order.lines.filter((line) => !line.voided && !matchesAny(notFood, line));

/** Every line still to make is ready. */
export function allReady(order: KitchenOrder, notFood: string[]): boolean {
  const lines = activeLines(order, notFood);
  return lines.length > 0 && lines.every((line) => line.ready && !line.held);
}

/** Sales lines of a paid receipt: what was not voided, with the till's takings. Test orders never count. */
export function saleOf(receiptId: string, day: string, lines: PosLine[], centsPrices = false): PosSale {
  return {
    receiptId, day,
    lines: lines.filter((line) => !line.voided && line.quantity > 0).map((line) => ({
      name: line.name, quantity: line.quantity,
      ...(line.plu ? { plu: line.plu } : {}), ...(line.category ? { category: line.category } : {}),
      total: line.total === null || line.total === undefined ? null : centsPrices ? Math.round(line.total) / 100 : line.total
    }))
  };
}

/** A refund: the same lines with negative quantities and takings. */
export function refundOf(receiptId: string, day: string, sale: Pick<PosSale, "lines">): PosSale {
  return { receiptId, day, lines: sale.lines.map((line) => ({ ...line, quantity: -Math.abs(line.quantity), total: line.total === null ? null : -Math.abs(line.total) })) };
}

/** Settings read from storage, with anything missing filled in and odd values dropped. */
export function normalizeOrdersConfig(raw: unknown): OrdersConfig {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<OrdersConfig> & { centsPrices?: unknown };
  const words = (list: unknown) => Array.from(new Set((Array.isArray(list) ? list : []).filter((word): word is string => typeof word === "string").map((word) => word.trim()).filter(Boolean))).slice(0, 200);
  const minutes = (input: unknown, fallback: number) => (Number.isFinite(Number(input)) && Number(input) > 0 ? Math.min(240, Math.round(Number(input))) : fallback);
  const stations = (Array.isArray(value.stations) ? value.stations : [])
    .filter((station): station is Station => Boolean(station) && typeof station.id === "string" && Boolean(station.id) && typeof station.name === "string" && Boolean(station.name.trim()))
    .slice(0, 30)
    .map((station) => ({ id: station.id.slice(0, 60), name: station.name.trim().slice(0, 40), match: words(station.match), ...(station.fallback ? { fallback: true } : {}) }));
  const amberMinutes = minutes(value.amberMinutes, DEFAULT_ORDERS_CONFIG.amberMinutes);
  const dishMap: Record<string, string> = {};
  if (value.dishMap && typeof value.dishMap === "object") {
    for (const [key, id] of Object.entries(value.dishMap)) if (/^(plu|name):./.test(key) && typeof id === "string" && id && !id.includes("/")) dishMap[key.slice(0, 200)] = id;
  }
  return {
    stations, amberMinutes, redMinutes: Math.max(amberMinutes + 1, minutes(value.redMinutes, DEFAULT_ORDERS_CONFIG.redMinutes)),
    notFood: words(value.notFood), dishMap,
    ...(value.centsPrices === true ? { centsPrices: true } : {})
  };
}

/** A sample order for "Send a test order": a few dishes of the active menus, one with a variant and one course on hold. */
export function sampleOrder(recipes: Pick<Recipe, "name" | "category">[], number: number) {
  const names = recipes.slice(0, 4).map((recipe) => recipe.name);
  while (names.length < 3) names.push(["Margherita", "Insalata mista", "Tiramisù"][names.length]);
  return {
    event: "order.created",
    order: {
      id: "test-" + number + "-" + Date.now().toString(36),
      number: String(number), table: "Prova " + number, covers: 2, server: "Recipe Studio", channel: "Test",
      allergies: ["Frutta a guscio"],
      lines: [
        { id: "1", name: names[0], quantity: 2, course: "Principali", modifiers: ["Senza cipolla"] },
        { id: "2", name: names[1], quantity: 1, course: "Principali", note: "Ben cotta" },
        { id: "3", name: names[2], quantity: 2, course: "Dolci", held: true }
      ]
    }
  };
}

