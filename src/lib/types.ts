// Shared data shapes. They match the JSON stored on disk and in Neon, so old archives load unchanged.

export type IngredientType = "Prodotto" | "Base / preparazione" | "Esterno";

export interface Ingredient {
  type: IngredientType | string;
  name: string;
  supplier: string;
  quantity: number;
  unit: string;
  unitCost: number;
  allergens: string[];
  kcal: number;
  stockItemId?: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  description?: string;
  portions: number;
  /** Old single-menu flag. Menus now live in `Menu.recipeIds`; this is only read once to build the first menu. */
  currentMenu?: boolean;
  archivedBatch: boolean;
  createdAt?: string;
  updatedAt?: string;
  creator?: string;
  image?: string;
  cookingMethod?: string;
  ingredients: Ingredient[];
  sellingPrice: number;
  marginTarget?: number;
  vat?: number;
  allergenGuidance?: string;
  mep?: string;
  method?: string;
  plating?: string;
  nutritionInfo?: string;
  ccpChecks?: string[];
  prepChecks?: string[];
  notes?: string;
  /** Days a batch keeps once made; used for the use-by date on prep labels. */
  shelfLifeDays?: number;
  [extra: string]: unknown;
}

export interface GpRules {
  target: number;
  includeTransfers: boolean;
  salesIncludeVat: boolean;
  salesVatRate: number;
  recipeMarginOnNet: boolean;
  defaultVat: number;
  defaultMarginTarget: number;
}

export type Language = "it" | "en";

/** A fridge, freezer or hot cabinet whose temperature is checked every day. */
export interface Equipment {
  id: string;
  name: string;
  kind: "fridge" | "freezer" | "hot";
  /** Allowed range in °C; null means no limit on that side. */
  min: number | null;
  max: number | null;
}

/** A member of the kitchen team. The rota has one line for each active person. */
export interface StaffMember {
  id: string;
  name: string;
  role?: string;
  hourlyRate: number;
  /** People who left stay in the list, so old rotas and records still show their name. */
  active: boolean;
}

/** Extras used for the labour cost of the rota. */
export interface LabourSettings {
  /** Old per-name rates, read once to fill the staff list. Rates now live on each staff member. */
  rates?: Record<string, number>;
  /** Employer extras on top of pay (national insurance, pension, holiday accrual), in %. */
  onCostPercent: number;
}

export type ChecklistKind = "opening" | "closing" | "cleaning";

/** Limits and lists of the food safety records. */
export interface FoodSafetySettings {
  equipment: Equipment[];
  /** Core temperature a cooked dish must reach. */
  cookMin: number;
  reheatMin: number;
  hotHoldMin: number;
  /** Cooling: below this temperature within this many minutes. */
  coolTarget: number;
  coolMinutes: number;
  chilledDeliveryMax: number;
  frozenDeliveryMax: number;
  /** Shelf life used on a label when the base recipe has none. */
  defaultShelfLifeDays: number;
  checklists: Record<ChecklistKind, string[]>;
}

export interface Settings {
  categories: string[];
  cookingMethods: string[];
  allergens: string[];
  ccpChecks: string[];
  prepChecks: string[];
  currency: string;
  language?: Language;
  gp: GpRules;
  foodSafety: FoodSafetySettings;
  labour: LabourSettings;
  staff: StaffMember[];
  /** Units offered in ingredient and product fields, chosen in Settings → General. */
  units: string[];
}

export type SettingsListKey = "categories" | "cookingMethods" | "allergens" | "ccpChecks" | "prepChecks";

export type Measurement = "Pack" | "Each" | "Kilo" | "Litre" | "Portion";

export interface StockCount {
  quantity: number;
  date: string;
  at: string;
}

export interface StockItem {
  id: string;
  code?: string;
  name: string;
  supplier: string;
  group: string;
  measurement: Measurement | string;
  unitOfSale: string;
  unitsPerPack: number;
  price: number;
  initialStock: number;
  recipeContent: number;
  recipeUnit: string;
  allergens: string[];
  kcal: number;
  parLevel?: number;
  note?: string;
  stockCount?: StockCount;
  [extra: string]: unknown;
}

/** A product or an internal batch preparation, as it appears in a report or the recipe picker. */
export interface StockSource extends StockItem {
  batch: boolean;
}

export interface ReportLine {
  itemId: string;
  name: string;
  supplier: string;
  group: string;
  measurement: string;
  unitOfSale: string;
  unitsPerPack: number;
  price: number;
  batch: boolean;
  opening: number;
  invoiceQty: number;
  delivered: number;
  closing: number;
  receivedQty?: number;
  receivedValue?: number;
}

export interface StockReport {
  id: string;
  number: number;
  status: "draft" | "submitted";
  dateFrom: string;
  dateTo: string;
  createdAt: string;
  submittedAt?: string;
  lines: ReportLine[];
  transfer: number;
  netSales: number;
  invoicesTotal: number | null;
  openingTotal: number | null;
  deliveryAdjustment?: number;
  gpRules?: Partial<GpRules>;
}

export interface DeliveryLine {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface StockDelivery {
  id: string;
  invoiceNumber: string;
  date: string;
  supplier: string;
  invoiceAmount: number | null;
  createdAt: string;
  lines: DeliveryLine[];
}

/** One menu served by the kitchen (main menu, pizza menu, Sunday roast…). Dishes are kept in menu order. */
export interface Menu {
  id: string;
  name: string;
  description?: string;
  /** Inactive menus stay in the archive but their dishes no longer count as "on the menu". */
  active: boolean;
  recipeIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** One job on a prep list, linked to the dishes it serves. */
export interface PrepTask {
  id: string;
  name: string;
  /** Amount needed for the service. */
  quantity: number;
  /** Amount already prepared; what is left to do is quantity − onHand. */
  onHand: number;
  unit: string;
  recipeIds: string[];
  /** Base recipe to follow, when the job is one of the kitchen's bases. */
  baseRecipeId?: string;
  notes?: string;
  done: boolean;
  /** Set on jobs built from the dishes, so rebuilding the list updates them instead of adding copies. */
  auto?: string;
}

export interface PrepList {
  id: string;
  name: string;
  date: string;
  menuIds: string[];
  /** Planned portions per dish id; they scale the amounts of the jobs built from the dishes. */
  portions: Record<string, number>;
  tasks: PrepTask[];
  createdAt: string;
  updatedAt: string;
}

/** One line of the staff rota: who, and the shift of each day from Monday to Sunday. */
export interface RotaRow {
  name: string;
  /** Seven values: "09:00-17:00", several ranges separated by commas, a day-off or holiday marker, or "". */
  shifts: string[];
}

/** The rota of one week. The id is the Monday of the week (YYYY-MM-DD). */
export interface RotaWeek {
  id: string;
  rows: RotaRow[];
  createdAt: string;
  updatedAt: string;
}

interface SafetyLogBase {
  id: string;
  /** Day of the check (YYYY-MM-DD) and time (HH:MM). */
  date: string;
  time: string;
  /** Who did the check, picked from the staff on the rota. */
  by: string;
  /** Worked out from the limits when the record is saved. */
  ok: boolean;
  /** What was done when a check failed. */
  action?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureLog extends SafetyLogBase {
  kind: "temperature";
  slot: "am" | "pm";
  readings: { equipmentId: string; name: string; value: number | null; ok: boolean }[];
}

export type CookingProcess = "cook" | "cool" | "reheat" | "hotHold";

export interface CookingLog extends SafetyLogBase {
  kind: "cooking";
  process: CookingProcess;
  item: string;
  recipeId?: string;
  /** Core temperature; for cooling, the temperature at the end. */
  temperature: number | null;
  /** Cooling only: when it started and finished, and the starting temperature. */
  startTime?: string;
  endTime?: string;
  startTemperature?: number | null;
}

export interface DeliveryCheckLog extends SafetyLogBase {
  kind: "delivery";
  deliveryId?: string;
  supplier: string;
  invoiceNumber?: string;
  chilledTemperature: number | null;
  frozenTemperature: number | null;
  packagingOk: boolean;
  datesOk: boolean;
  /** Goods sent back, if any. */
  rejected: string;
}

export interface ChecklistLog extends SafetyLogBase {
  kind: "checklist";
  list: ChecklistKind;
  items: { label: string; done: boolean; by: string; at: string }[];
}

export type SafetyLog = TemperatureLog | CookingLog | DeliveryCheckLog | ChecklistLog;

export type WasteReason = "expired" | "error" | "leftover" | "damaged" | "other";

/** Food thrown away: what, how much, why and what it cost. */
export interface WasteLog {
  id: string;
  date: string;
  /** Where the cost comes from: a stock product, a recipe (dish or base) or a free entry. */
  source: "product" | "recipe" | "other";
  itemId?: string;
  name: string;
  quantity: number;
  /** Product: its recipe unit (kg, l, pz…). Recipe: portions. */
  unit: string;
  unitCost: number;
  reason: WasteReason;
  by: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesLine {
  recipeId?: string;
  name: string;
  quantity: number;
  /** Takings for the line including VAT, when the till gives them; otherwise the menu price is used. */
  revenue?: number | null;
}

/** Dishes sold in one week. The id is the Monday of the week. */
export interface SalesWeek {
  id: string;
  lines: SalesLine[];
  /** Food sales without VAT from the till, when known; otherwise the lines are added up. */
  netSales?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type StorageMode = "local" | "neon";

export interface AppData {
  recipes: Recipe[];
  settings: Settings;
  stockItems: StockItem[];
  stockReports: StockReport[];
  stockDeliveries: StockDelivery[];
  menus: Menu[];
  prepLists: PrepList[];
  rotaWeeks: RotaWeek[];
  safetyLogs: SafetyLog[];
  wasteLogs: WasteLog[];
  salesWeeks: SalesWeek[];
}

export interface AppState extends AppData {
  storage: StorageMode;
}

export interface Health {
  storage: StorageMode;
  connected: boolean;
  error: string | null;
}
