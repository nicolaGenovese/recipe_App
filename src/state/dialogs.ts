import type { ChecklistKind, Recipe, StockItem } from "@/lib/types";

/** Every dialog the app can open, with the data it needs. One dialog is open at a time. */
/** Kitchen settings (lists, GP, staff) and company sections (people, sites, roles, activity log). */
export type SettingsTab = "general" | "gp" | "staff" | "categories" | "cookingMethods" | "allergens" | "ccpChecks" | "prepChecks" | "people" | "sites" | "roles" | "audit";

export type DialogState =
  | { kind: "recipeEditor"; recipe?: Partial<Recipe>; tab?: "general" | "ingredients" | "kitchen" | "costs" }
  | { kind: "recipeDetail"; id: string }
  | { kind: "recipeActions"; id: string }
  | { kind: "print"; mode?: PrintMode; recipeId?: string; menuId?: string }
  | { kind: "recipeMenus"; id: string }
  | { kind: "menuEditor"; id?: string }
  | { kind: "prepList"; id?: string; copyOf?: string; menuId?: string }
  | { kind: "prepLabels"; id: string }
  | { kind: "safetyTemperature"; id?: string }
  | { kind: "safetyCooking"; id?: string; recipeId?: string }
  | { kind: "safetyDelivery"; id?: string; deliveryId?: string }
  | { kind: "safetyChecklist"; id?: string; list?: ChecklistKind }
  | { kind: "safetySettings" }
  | { kind: "waste"; id?: string }
  | { kind: "settings"; tab?: SettingsTab }
  | { kind: "stockReport"; id: string }
  | { kind: "stockItem"; id?: string; preset?: Partial<StockItem> }
  | { kind: "stockDelivery"; id?: string; files?: File[] }
  | { kind: "stockPicker" };

export type PrintMode = "recipes" | "allergens" | "matrix" | "folder" | "till";
