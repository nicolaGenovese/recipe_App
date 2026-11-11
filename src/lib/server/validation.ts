import { normalizeSettings } from "@/lib/settings";
import type { ChecklistKind, CookingProcess, Menu, PrepList, PrepTask, RotaWeek, SafetyLog, SalesWeek, WasteLog, WasteReason, Recipe, Settings, StockDelivery, StockItem, StockReport } from "@/lib/types";
import { num } from "@/lib/num";
import { isMondayKey } from "@/lib/rota/weeks";
import { normalizeRows } from "@/lib/rota/shifts";
import { evaluate } from "@/lib/safety/rules";
import type { StockKind } from "@/lib/server/store/types";

/** An error the API returns as-is, with its HTTP status. Messages are Italian keys the browser translates. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Ids end up in URLs, so they must be plain non-empty strings without slashes. */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && Boolean(value) && !value.includes("/");
}

export function assertId(id: string): string {
  if (!isValidId(id)) throw new HttpError(400, "Identificativo non valido.");
  return id;
}

export function parseRecipe(value: unknown): Recipe {
  if (!isObject(value) || !isValidId(value.id) || typeof value.name !== "string" || !value.name.trim()) {
    throw new HttpError(400, "La ricetta deve avere un nome.");
  }
  const now = new Date().toISOString();
  return { ...(value as unknown as Recipe), name: value.name.trim(), updatedAt: now, createdAt: (value.createdAt as string) || now };
}

export function parseSettings(value: unknown): Settings {
  if (!isObject(value)) throw new HttpError(400, "Il contenuto inviato non è JSON valido.");
  return normalizeSettings(value as Partial<Settings>);
}

const STOCK_PARSERS: { [K in StockKind]: (value: Json) => boolean } = {
  items: (value) => typeof value.name === "string" && Boolean(value.name.trim()),
  reports: (value) => Array.isArray(value.lines) && ["draft", "submitted"].includes(value.status as string) && Boolean(value.dateFrom) && Boolean(value.dateTo),
  deliveries: (value) => Array.isArray(value.lines) && value.lines.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(value.date ?? ""))
};
const STOCK_ERRORS: Record<StockKind, string> = {
  items: "Il prodotto deve avere un nome.",
  reports: "Report stock non valido.",
  deliveries: "Consegna non valida."
};

export function isStockKind(value: string): value is StockKind {
  return value === "items" || value === "reports" || value === "deliveries";
}

export function parseStock(kind: StockKind, value: unknown): StockItem | StockReport | StockDelivery {
  if (!isObject(value) || !isValidId(value.id) || !STOCK_PARSERS[kind](value)) throw new HttpError(400, STOCK_ERRORS[kind]);
  if (kind === "items") return { ...(value as unknown as StockItem), name: String(value.name).trim() };
  return value as unknown as StockReport | StockDelivery;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isValidId) : []);

export function parseMenu(value: unknown): Menu {
  if (!isObject(value) || !isValidId(value.id) || typeof value.name !== "string" || !value.name.trim()) throw new HttpError(400, "Il menu deve avere un nome.");
  const now = new Date().toISOString();
  return {
    id: value.id, name: value.name.trim(), description: typeof value.description === "string" ? value.description : "",
    active: value.active !== false, recipeIds: Array.from(new Set(strings(value.recipeIds))),
    createdAt: typeof value.createdAt === "string" && value.createdAt ? value.createdAt : now, updatedAt: now
  };
}

function parseTask(value: unknown): PrepTask | null {
  if (!isObject(value) || !isValidId(value.id) || typeof value.name !== "string" || !value.name.trim()) return null;
  return {
    id: value.id, name: value.name.trim(), quantity: Math.max(0, num(value.quantity)), onHand: Math.max(0, num(value.onHand)),
    unit: typeof value.unit === "string" ? value.unit.trim() : "", recipeIds: Array.from(new Set(strings(value.recipeIds))),
    ...(isValidId(value.baseRecipeId) ? { baseRecipeId: value.baseRecipeId } : {}),
    notes: typeof value.notes === "string" ? value.notes : "", done: value.done === true,
    ...(typeof value.auto === "string" && value.auto ? { auto: value.auto } : {})
  };
}

/** Jobs without a name are blank rows left in the form, so they are dropped rather than refused. */
export function parsePrepList(value: unknown): PrepList {
  if (!isObject(value) || !isValidId(value.id) || typeof value.name !== "string" || !value.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(value.date ?? ""))) {
    throw new HttpError(400, "La prep list deve avere un nome e una data.");
  }
  const portions: Record<string, number> = {};
  if (isObject(value.portions)) for (const [id, amount] of Object.entries(value.portions)) if (isValidId(id)) portions[id] = Math.max(0, num(amount));
  const now = new Date().toISOString();
  return {
    id: value.id, name: value.name.trim(), date: String(value.date), menuIds: strings(value.menuIds), portions,
    tasks: (Array.isArray(value.tasks) ? value.tasks : []).map(parseTask).filter((task): task is PrepTask => Boolean(task)),
    createdAt: typeof value.createdAt === "string" && value.createdAt ? value.createdAt : now, updatedAt: now
  };
}

const MAX_ROTA_ROWS = 60;
const MAX_CELL = 60;

/** A rota week: the id must be a Monday; names and shifts are trimmed and kept short. */
export function parseRotaWeek(value: unknown): RotaWeek {
  if (!isObject(value) || !isMondayKey(value.id) || !Array.isArray(value.rows) || value.rows.length > MAX_ROTA_ROWS) {
    throw new HttpError(400, "Settimana dei turni non valida.");
  }
  const now = new Date().toISOString();
  return {
    id: value.id,
    rows: normalizeRows(value.rows).map((row) => ({ name: row.name.trim().slice(0, MAX_CELL), shifts: row.shifts.map((shift) => shift.trim().slice(0, MAX_CELL)) })),
    createdAt: typeof value.createdAt === "string" && value.createdAt ? value.createdAt : now, updatedAt: now
  };
}

const text = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const temperature = (value: unknown): number | null => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 10) / 10);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{1,2}:\d{2}$/;

/**
 * A food safety record. Fields are cleaned per kind and "ok" is worked out again here from the
 * kitchen's limits, so a record can never claim to pass when its numbers do not.
 */
export function parseSafetyLog(value: unknown, settings: Settings): SafetyLog {
  if (!isObject(value) || !isValidId(value.id) || !DAY.test(String(value.date ?? "")) || !["temperature", "cooking", "delivery", "checklist"].includes(String(value.kind))) {
    throw new HttpError(400, "Registrazione non valida.");
  }
  const now = new Date().toISOString();
  const base = {
    id: value.id, date: String(value.date), time: TIME.test(String(value.time ?? "")) ? String(value.time) : "00:00", by: text(value.by, 80),
    ok: true, action: text(value.action, 500), notes: text(value.notes, 500),
    createdAt: typeof value.createdAt === "string" && value.createdAt ? value.createdAt : now, updatedAt: now
  };
  let log: SafetyLog;
  if (value.kind === "temperature") {
    const readings = Array.isArray(value.readings) ? value.readings.filter(isObject).slice(0, 50) : [];
    log = { ...base, kind: "temperature", slot: value.slot === "pm" ? "pm" : "am",
      readings: readings.map((row) => ({ equipmentId: text(row.equipmentId, 80), name: text(row.name, 80), value: temperature(row.value), ok: true })) };
  } else if (value.kind === "cooking") {
    const process = (["cook", "cool", "reheat", "hotHold"].includes(String(value.process)) ? value.process : "cook") as CookingProcess;
    log = { ...base, kind: "cooking", process, item: text(value.item, 120), temperature: temperature(value.temperature),
      ...(isValidId(value.recipeId) ? { recipeId: value.recipeId } : {}),
      ...(process === "cool" ? { startTime: text(value.startTime, 5), endTime: text(value.endTime, 5), startTemperature: temperature(value.startTemperature) } : {}) };
    if (!log.item) throw new HttpError(400, "Indica cosa è stato controllato.");
  } else if (value.kind === "delivery") {
    log = { ...base, kind: "delivery", supplier: text(value.supplier, 120), invoiceNumber: text(value.invoiceNumber, 60),
      ...(isValidId(value.deliveryId) ? { deliveryId: value.deliveryId } : {}),
      chilledTemperature: temperature(value.chilledTemperature), frozenTemperature: temperature(value.frozenTemperature),
      packagingOk: value.packagingOk !== false, datesOk: value.datesOk !== false, rejected: text(value.rejected, 500) };
  } else {
    const list = (["opening", "closing", "cleaning"].includes(String(value.list)) ? value.list : "opening") as ChecklistKind;
    const items = Array.isArray(value.items) ? value.items.filter(isObject).slice(0, 80) : [];
    log = { ...base, kind: "checklist", list, items: items.map((row) => ({ label: text(row.label), done: row.done === true, by: text(row.by, 80), at: text(row.at, 5) })).filter((row) => row.label) };
  }
  if (!log.by) throw new HttpError(400, "Indica chi ha fatto il controllo.");
  return evaluate(log, settings.foodSafety);
}

const REASONS: WasteReason[] = ["expired", "error", "leftover", "damaged", "other"];
const money = (value: unknown) => Math.max(0, Math.round(num(value) * 10000) / 10000);

export function parseWasteLog(value: unknown): WasteLog {
  if (!isObject(value) || !isValidId(value.id) || !DAY.test(String(value.date ?? "")) || !text(value.name, 120) || !(num(value.quantity) > 0)) {
    throw new HttpError(400, "Spreco non valido: servono data, cosa e quantità.");
  }
  const now = new Date().toISOString();
  const source = value.source === "product" || value.source === "recipe" ? value.source : "other";
  return {
    id: value.id, date: String(value.date), source, ...(source !== "other" && isValidId(value.itemId) ? { itemId: value.itemId } : {}),
    name: text(value.name, 120), quantity: money(value.quantity), unit: text(value.unit, 20), unitCost: money(value.unitCost),
    reason: REASONS.includes(value.reason as WasteReason) ? (value.reason as WasteReason) : "other", by: text(value.by, 80), notes: text(value.notes, 500),
    createdAt: typeof value.createdAt === "string" && value.createdAt ? value.createdAt : now, updatedAt: now
  };
}

export function parseSalesWeek(value: unknown): SalesWeek {
  if (!isObject(value) || !isMondayKey(value.id) || !Array.isArray(value.lines) || value.lines.length > 500) throw new HttpError(400, "Vendite della settimana non valide.");
  const now = new Date().toISOString();
  const lines = value.lines.filter(isObject).map((line) => ({
    ...(isValidId(line.recipeId) ? { recipeId: line.recipeId } : {}), name: text(line.name, 120), quantity: money(line.quantity),
    revenue: line.revenue === null || line.revenue === undefined || line.revenue === "" ? null : money(line.revenue)
  })).filter((line) => line.name && line.quantity > 0);
  return {
    id: value.id, lines, netSales: value.netSales === null || value.netSales === undefined || value.netSales === "" ? null : money(value.netSales),
    createdAt: typeof value.createdAt === "string" && value.createdAt ? value.createdAt : now, updatedAt: now
  };
}
