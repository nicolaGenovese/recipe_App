import type { ChecklistKind, Recipe } from "@/lib/types";

/** Every dialog the app can open, with the data it needs. One dialog is open at a time. */
export type DialogState =
  | { kind: "recipeEditor"; recipe?: Partial<Recipe> }
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
  | { kind: "settings"; tab?: "general" | "gp" | "staff" }
  | { kind: "stockReport"; id: string }
  | { kind: "stockItem"; id?: string }
  | { kind: "stockDelivery"; id?: string }
  | { kind: "stockPicker" };

export type PrintMode = "recipes" | "allergens" | "matrix" | "folder" | "till";
