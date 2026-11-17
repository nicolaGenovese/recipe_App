import { describe, expect, it } from "vitest";
import { countLabel, makeTranslate } from "@/lib/i18n";

describe("translations", () => {
  it("hides the context part of a key and translates it on its own", () => {
    expect(makeTranslate("it")("Altro|nav")).toBe("Altro");
    expect(makeTranslate("en")("Altro|nav")).toBe("More");
    expect(makeTranslate("en")("Altro")).toBe("Other");
    expect(makeTranslate("en")("Esci|kitchen")).toBe("Exit");
  });
  it("picks singular or plural", () => {
    expect(countLabel(makeTranslate("en"), 1, "porzione", "porzioni")).toBe("1 portion");
    expect(countLabel(makeTranslate("it"), 4, "porzione", "porzioni")).toBe("4 porzioni");
  });
});
