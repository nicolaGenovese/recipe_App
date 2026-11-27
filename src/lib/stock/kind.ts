/**
 * What a product is for. Only food goes into dishes: it has allergens, kcal and a cost per recipe
 * unit, and its cost counts in the GP. Cleaning products (detergents, sanitisers, cloths, gloves)
 * and other supplies (packaging, foil, takeaway boxes) are bought, delivered and counted in stock
 * like food, but they stay out of recipes, allergens and the cost of sales.
 */
export type ProductKind = "food" | "cleaning" | "supplies";

export const PRODUCT_KINDS: ProductKind[] = ["food", "cleaning", "supplies"];

/** Italian labels, also the translation keys. */
export const KIND_LABELS: Record<ProductKind, string> = { food: "Alimento", cleaning: "Pulizia e igiene", supplies: "Materiale di consumo" };

/** Short labels for the tag next to a product name. */
export const KIND_TAGS: Record<ProductKind, string> = { food: "Alimento", cleaning: "Pulizia", supplies: "Materiale" };

/** Products saved before kinds existed, and anything unknown, are food. */
export function productKind(item: { kind?: unknown }): ProductKind {
  return item.kind === "cleaning" || item.kind === "supplies" ? item.kind : "food";
}

export const isFood = (item: { kind?: unknown }): boolean => productKind(item) === "food";

/** The kind as stored: nothing for food, so food products keep the shape they always had. */
export function storedKind(kind: ProductKind): { kind?: ProductKind } {
  return kind === "food" ? {} : { kind };
}
