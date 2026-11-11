// Browser-side calls to the API routes. Errors carry the server message, translated by the caller.
import type { AppState, Health, Menu, PrepList, RotaWeek, SafetyLog, SalesWeek, WasteLog, Recipe, Settings, StockDelivery, StockItem, StockReport } from "@/lib/types";

export class ApiError extends Error {}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  let payload: unknown = {};
  try { payload = await response.json(); } catch { /* Empty or non-JSON body. */ }
  if (!response.ok) throw new ApiError((payload as { error?: string }).error || "Operazione non riuscita.");
  return payload as T;
}

const post = <T>(url: string, body: unknown) => request<T>(url, { method: "POST", body: JSON.stringify(body) });
const remove = (url: string) => request<{ ok: true }>(url, { method: "DELETE" });

export const api = {
  state: () => request<AppState>("/api/state"),
  health: () => request<Health>("/api/health"),
  saveRecipe: (recipe: Recipe) => post<Recipe>("/api/recipes", recipe),
  deleteRecipe: (id: string) => remove("/api/recipes/" + encodeURIComponent(id)),
  saveSettings: (settings: Settings) => request<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) }),
  saveStockItem: (item: StockItem) => post<StockItem>("/api/stock/items", item),
  deleteStockItem: (id: string) => remove("/api/stock/items/" + encodeURIComponent(id)),
  saveReport: (report: StockReport) => post<StockReport>("/api/stock/reports", report),
  deleteReport: (id: string) => remove("/api/stock/reports/" + encodeURIComponent(id)),
  saveDelivery: (delivery: StockDelivery) => post<StockDelivery>("/api/stock/deliveries", delivery),
  deleteDelivery: (id: string) => remove("/api/stock/deliveries/" + encodeURIComponent(id)),
  saveMenu: (menu: Menu) => post<Menu>("/api/menus", menu),
  deleteMenu: (id: string) => remove("/api/menus/" + encodeURIComponent(id)),
  savePrepList: (list: PrepList) => post<PrepList>("/api/prep-lists", list),
  deletePrepList: (id: string) => remove("/api/prep-lists/" + encodeURIComponent(id)),
  saveRotaWeek: (week: RotaWeek) => post<RotaWeek>("/api/rota", week),
  deleteRotaWeek: (id: string) => remove("/api/rota/" + encodeURIComponent(id)),
  saveSafetyLog: (log: SafetyLog) => post<SafetyLog>("/api/safety", log),
  deleteSafetyLog: (id: string) => remove("/api/safety/" + encodeURIComponent(id)),
  saveWasteLog: (log: WasteLog) => post<WasteLog>("/api/waste", log),
  deleteWasteLog: (id: string) => remove("/api/waste/" + encodeURIComponent(id)),
  saveSalesWeek: (week: SalesWeek) => post<SalesWeek>("/api/sales", week),
  deleteSalesWeek: (id: string) => remove("/api/sales/" + encodeURIComponent(id))
};
