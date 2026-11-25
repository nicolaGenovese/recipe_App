import type { OrderStatus, OrdersConfig, PosConnection, PosEventRow, PosItem, PosOrder, PosSale, ReadyMark, StoredOrder } from "@/lib/orders/types";
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

export interface AuditEntry { userId: string | null; userName: string; action: string; target: string; detail?: unknown; siteWide?: boolean }
export interface AuditRow { at: string; userName: string; action: string; target: string; detail: unknown; siteId: string | null }
export interface VersionRow { at: string; userName: string; deleted: boolean; payload: unknown }

/** A photo kept apart from the records: base64 bytes and their type. Records only hold its id. */
export interface StoredPhoto { mimeType: string; data: string }

export interface StoreHealth {
  connected: boolean;
  error: string | null;
}

/** Whose data a request reads and writes: one company and the site chosen in it. */
export interface Scope { companyId: string; siteId: string }

/** Which parts of the settings a save may change: the company's lists and staff, the site's food safety. */
export interface SettingsParts { company: boolean; site: boolean }

/** Storage for every company. Data is only reached through a scope. */
export interface Store {
  mode: StorageMode;
  health(): Promise<StoreHealth>;
  /** Resolves once the schema exists and is migrated. */
  ready(): Promise<void>;
  scoped(scope: Scope): ScopedStore;
  /** The site a till webhook token belongs to; the only lookup made without a signed-in user. */
  findPosSite(token: string): Promise<(Scope & { enabled: boolean }) | null>;
}

/** What a kitchen screen changes on an order. Each part is written on its own, so two screens never undo each other. */
export interface KitchenChange {
  claim?: { by: string; at: string } | null;
  /** Line keys marked ready, and line keys no longer ready. */
  ready?: Record<string, ReadyMark>;
  unready?: string[];
  status?: OrderStatus;
  done?: { by: string; at: string } | null;
  seen?: boolean;
}

/** Till orders, notices and receipts of one site. */
export interface OrderStore {
  config(): Promise<{ config: OrdersConfig; connection: PosConnection }>;
  saveConfig(config: OrdersConfig): Promise<void>;
  saveConnection(connection: PosConnection): Promise<void>;
  /** Open orders of the last 12 hours and orders closed in the last hour; with `since`, only those changed after it. */
  list(since?: string): Promise<{ orders: StoredOrder[]; now: string }>;
  get(id: string): Promise<StoredOrder | null>;
  /** Writes the till part if the order is still at `version` (0: new). False when another notice wrote first. */
  putPos(id: string, pos: PosOrder, status: OrderStatus | undefined, version: number): Promise<boolean>;
  kitchen(id: string, change: KitchenChange): Promise<StoredOrder | null>;
  /** Logs a notice; null when the same notice was already received. */
  logEvent(key: string, body: string): Promise<string | null>;
  finishEvent(rowId: string, kind: string, ok: boolean, summary: string): Promise<void>;
  /** Forgets a notice that could not be handled, so the till's retry is not taken for a copy. */
  dropEvent(rowId: string): Promise<void>;
  events(limit: number): Promise<PosEventRow[]>;
  getSale(receiptId: string): Promise<PosSale | null>;
  saveSale(sale: PosSale): Promise<void>;
  /** Dishes the till sent or sold in the last days, with how often. */
  items(days: number): Promise<PosItem[]>;
}

/**
 * The data of one company and site. In Neon each call runs with row-level security set to the
 * company, so a mistake in the code still cannot reach another company's rows. The local JSON
 * file has a single kitchen and ignores the scope.
 */
export interface ScopedStore {
  getState(): Promise<AppState>;
  /** Site of a recipe: null for the company library, undefined when it does not exist. */
  recipeSite(id: string): Promise<string | null | undefined>;
  saveRecipe(recipe: Recipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  saveSettings(settings: Settings, parts?: SettingsParts): Promise<Settings>;
  saveRecord<K extends RecordKind>(kind: K, record: RecordMap[K]): Promise<RecordMap[K]>;
  deleteRecord(kind: RecordKind, id: string): Promise<void>;
  /** One record of this site (or product of this company), or null. */
  getRecord<K extends RecordKind>(kind: K, id: string): Promise<RecordMap[K] | null>;
  /** Activity log: who changed prices, rotas, pay, roles and permissions, and when. */
  audit(entry: AuditEntry): Promise<void>;
  auditLog(limit: number): Promise<AuditRow[]>;
  /** Keeps the previous copy of a record that is corrected or deleted (food safety records are never really lost). */
  saveVersion(kind: RecordKind, id: string, payload: unknown, deleted: boolean, user: { id: string | null; name: string }): Promise<void>;
  versions(kind: RecordKind, id: string): Promise<VersionRow[]>;
  /** Photos are not part of getState, so the app loads fast however many there are. */
  savePhoto(id: string, photo: StoredPhoto): Promise<void>;
  getPhoto(id: string): Promise<StoredPhoto | null>;
  deletePhoto(id: string): Promise<void>;
  orders: OrderStore;
}
