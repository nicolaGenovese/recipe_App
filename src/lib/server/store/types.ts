import type { AppState, Menu, PrepList, RotaWeek, SafetyLog, SalesWeek, WasteLog, Recipe, Settings, StockDelivery, StockItem, StockReport, StorageMode } from "@/lib/types";

/** The stock lists, menus and prep lists share one storage shape: an id plus a JSON payload. */
export type StockKind = "items" | "reports" | "deliveries";
export type RecordKind = StockKind | "menus" | "prepLists" | "rotaWeeks" | "safetyLogs" | "wasteLogs" | "salesWeeks";

export interface RecordMap {
  items: StockItem;
  reports: StockReport;
  deliveries: StockDelivery;
  menus: Menu;
  prepLists: PrepList;
  rotaWeeks: RotaWeek;
  safetyLogs: SafetyLog;
  wasteLogs: WasteLog;
  salesWeeks: SalesWeek;
}

export interface StoreHealth {
  connected: boolean;
  error: string | null;
}

/** Everything the API needs from storage. The local JSON file and Neon both implement it. */
export interface Store {
  mode: StorageMode;
  health(): Promise<StoreHealth>;
  getState(): Promise<AppState>;
  saveRecipe(recipe: Recipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  saveSettings(settings: Settings): Promise<Settings>;
  saveRecord<K extends RecordKind>(kind: K, record: RecordMap[K]): Promise<RecordMap[K]>;
  deleteRecord(kind: RecordKind, id: string): Promise<void>;
}
