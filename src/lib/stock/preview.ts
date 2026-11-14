import { num } from "@/lib/num";
import { recipeUnitFor, unitFactor } from "@/lib/stock/units";

export interface ProductCostInput {
  measurement: string;
  price: unknown;
  recipeContent: unknown;
  recipeUnit: string;
}

export type ProductWarning =
  | { kind: "kiloAsGrams"; suggestedContent: number; bigUnit: string; smallUnit: string }
  | { kind: "tooExpensive"; perKilo: number; unit: string }
  | { kind: "noPrice" }
  | { kind: "noContent" };

export interface ProductCostPreview {
  /** Cost of one "Unit in recipes": price ÷ content. */
  perRecipeUnit: number;
  /** The unit recipes use for this product (g for kg, ml for l) and its cost. */
  rowUnit: string;
  perRowUnit: number;
  /** A sensible amount to show: 100 g or ml, otherwise 1. */
  sampleAmount: number;
  sampleCost: number;
  warnings: ProductWarning[];
}

/** Above this a product is almost always set up wrong (saffron and truffles excepted). */
export const EXPENSIVE_PER_KILO = 200;

/**
 * What a product will cost in recipes, worked out from the product sheet while it is typed,
 * with the mistakes that are easy to make: content 1 with recipe unit g on a product bought by
 * the kilo means "1 gram for the whole price".
 */
export function productCostPreview(input: ProductCostInput): ProductCostPreview {
  const price = num(input.price);
  const content = num(input.recipeContent);
  const perRecipeUnit = content > 0 ? price / content : 0;
  const rowUnit = recipeUnitFor(input.recipeUnit);
  const perRowUnit = perRecipeUnit * (unitFactor(rowUnit, input.recipeUnit) ?? 1);
  const sampleAmount = rowUnit === "g" || rowUnit === "ml" ? 100 : 1;
  const warnings: ProductWarning[] = [];

  if (price <= 0) warnings.push({ kind: "noPrice" });
  if (content <= 0) warnings.push({ kind: "noContent" });

  const small = input.recipeUnit === "g" || input.recipeUnit === "ml";
  const bought = input.measurement === "Kilo" ? "kg" : input.measurement === "Litre" ? "l" : "";
  if (small && bought && content > 0 && content < 100) {
    warnings.push({ kind: "kiloAsGrams", suggestedContent: 1000, bigUnit: bought, smallUnit: input.recipeUnit });
  }

  const perKiloFactor = unitFactor(input.recipeUnit === "ml" || input.recipeUnit === "l" ? "l" : "kg", input.recipeUnit);
  const perKilo = perKiloFactor === null ? null : perRecipeUnit * perKiloFactor;
  if (perKilo !== null && perKilo > EXPENSIVE_PER_KILO && !warnings.some((warning) => warning.kind === "kiloAsGrams")) {
    warnings.push({ kind: "tooExpensive", perKilo, unit: input.recipeUnit === "ml" || input.recipeUnit === "l" ? "l" : "kg" });
  }

  return { perRecipeUnit, rowUnit, perRowUnit, sampleAmount, sampleCost: perRowUnit * sampleAmount, warnings };
}
