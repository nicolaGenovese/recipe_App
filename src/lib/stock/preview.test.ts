import { describe, expect, it } from "vitest";
import { productCostPreview } from "@/lib/stock/preview";

describe("product cost preview", () => {
  it("shows a kilo product per gram in recipes", () => {
    const preview = productCostPreview({ measurement: "Kilo", price: 3, recipeContent: 1, recipeUnit: "kg" });
    expect(preview.rowUnit).toBe("g");
    expect(preview.perRowUnit).toBeCloseTo(0.003);
    expect(preview.sampleCost).toBeCloseTo(0.3);
    expect(preview.warnings).toEqual([]);
  });

  it("flags the 1 gram for the whole price mistake", () => {
    const preview = productCostPreview({ measurement: "Kilo", price: 3, recipeContent: 1, recipeUnit: "g" });
    expect(preview.perRowUnit).toBe(3);
    expect(preview.warnings[0]).toMatchObject({ kind: "kiloAsGrams", suggestedContent: 1000 });
    expect(productCostPreview({ measurement: "Kilo", price: 3, recipeContent: 1000, recipeUnit: "g" }).warnings).toEqual([]);
  });

  it("warns about prices far above any normal ingredient and about missing values", () => {
    expect(productCostPreview({ measurement: "Pack", price: 30, recipeContent: 0.1, recipeUnit: "kg" }).warnings[0]).toMatchObject({ kind: "tooExpensive", unit: "kg" });
    expect(productCostPreview({ measurement: "Pack", price: 12, recipeContent: 20, recipeUnit: "pz" })).toMatchObject({ rowUnit: "pz", sampleAmount: 1, warnings: [] });
    expect(productCostPreview({ measurement: "Pack", price: 0, recipeContent: 0, recipeUnit: "kg" }).warnings.map((warning) => warning.kind)).toEqual(["noPrice", "noContent"]);
  });
});
