import { num } from "@/lib/num";
import { unitFactor } from "@/lib/stock/units";
import type { Ingredient, StockItem } from "@/lib/types";

/** The product sheet as typed: every field is text until it is saved. */
export type ProductForm = Record<"name" | "code" | "parLevel" | "supplier" | "group" | "measurement" | "unitOfSale" | "price" | "unitsPerPack" | "initialStock" | "recipeContent" | "recipeUnit" | "kcal" | "allergens" | "note", string>;

export function productForm(item: Partial<StockItem>): ProductForm {
  return {
    name: item.name ?? "", code: item.code ?? "", parLevel: String(item.parLevel || 0), supplier: item.supplier ?? "", group: item.group ?? "",
    measurement: item.measurement || "Pack", unitOfSale: item.unitOfSale ?? "", price: String(item.price || 0), unitsPerPack: String(item.unitsPerPack || 1),
    initialStock: String(item.initialStock || 0), recipeContent: String(item.recipeContent || 1), recipeUnit: item.recipeUnit || "kg",
    kcal: String(item.kcal || 0), allergens: (item.allergens || []).join(", "), note: item.note ?? ""
  };
}

/** The product to save. The code stays empty when not typed: the store assigns the next one. */
export function productFromForm(form: ProductForm, id: string): StockItem {
  return {
    id, code: form.code.trim(), parLevel: Math.max(0, num(form.parLevel)), name: form.name.trim(), supplier: form.supplier.trim(), group: form.group.trim(),
    measurement: form.measurement || "Pack", unitOfSale: form.unitOfSale.trim(), price: num(form.price), unitsPerPack: Math.max(1, num(form.unitsPerPack) || 1),
    initialStock: num(form.initialStock), recipeContent: num(form.recipeContent) || 1, recipeUnit: form.recipeUnit.trim() || "kg", kcal: num(form.kcal),
    allergens: form.allergens.split(",").map((value) => value.trim()).filter(Boolean), note: form.note.trim()
  };
}

/** How a product counted in a recipe unit is usually bought. */
const BOUGHT: Record<string, { measurement: string; unit: string }> = {
  g: { measurement: "Kilo", unit: "kg" }, kg: { measurement: "Kilo", unit: "kg" },
  ml: { measurement: "Litre", unit: "l" }, cl: { measurement: "Litre", unit: "l" }, l: { measurement: "Litre", unit: "l" }
};

/**
 * A new product sheet filled from a recipe row that is not in stock yet. A row in grams becomes
 * a product bought by the kilo, with the row's cost and kcal per gram turned into per kilo.
 */
export function productFormFromRow(row: Pick<Ingredient, "name" | "supplier" | "unit" | "unitCost" | "allergens" | "kcal">): ProductForm {
  const bought = BOUGHT[row.unit];
  const unit = bought ? bought.unit : row.unit || "pz";
  // How many row units are in one recipe unit of the product (1000 g in 1 kg).
  const factor = unitFactor(unit, row.unit) ?? 1;
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return productForm({
    name: row.name.trim(), supplier: row.supplier.trim(), measurement: bought ? bought.measurement : "Each", unitOfSale: unit,
    price: round(num(row.unitCost) * factor), recipeContent: 1, recipeUnit: unit, kcal: round(num(row.kcal) * factor), allergens: row.allergens
  });
}
