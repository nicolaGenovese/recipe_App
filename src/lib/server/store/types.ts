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
}
