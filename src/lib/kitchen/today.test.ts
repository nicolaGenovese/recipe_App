import { describe, expect, it } from "vitest";
import { checklistItems, flipSign, kitchenPrepLists, slotOf, todaysChecklist } from "@/lib/kitchen/today";
import type { ChecklistLog, PrepList } from "@/lib/types";

const list = (id: string, date: string): PrepList => ({ id, name: id, date, menuIds: [], portions: {}, tasks: [], createdAt: "", updatedAt: "" });
const check = (id: string, date: string, updatedAt: string): ChecklistLog => ({ id, kind: "checklist", list: "opening", date, time: "", by: "", ok: true, items: [], createdAt: "", updatedAt });

describe("kitchen screen", () => {
  it("opens on today's prep lists, else the next, else the last", () => {
    expect(kitchenPrepLists([list("b", "2026-11-16"), list("a", "2026-11-16"), list("x", "2026-11-17")], "2026-11-16").map((row) => row.id)).toEqual(["a", "b"]);
    expect(kitchenPrepLists([list("old", "2026-11-10"), list("next", "2026-11-20"), list("soon", "2026-11-18")], "2026-11-16").map((row) => row.id)).toEqual(["soon"]);
    expect(kitchenPrepLists([list("old", "2026-11-10"), list("older", "2026-11-01")], "2026-11-16").map((row) => row.id)).toEqual(["old"]);
    expect(kitchenPrepLists([], "2026-11-16")).toEqual([]);
  });

  it("picks the round and today's latest record", () => {
    expect(slotOf(new Date(2026, 10, 16, 13, 59))).toBe("am");
    expect(slotOf(new Date(2026, 10, 16, 14, 0))).toBe("pm");
    expect(todaysChecklist([check("a", "2026-11-16", "1"), check("b", "2026-11-16", "2"), check("c", "2026-11-15", "3")], "2026-11-16", "opening")?.id).toBe("b");
  });

  it("keeps ticked items and adds new ones from the settings", () => {
    const record = { items: [{ label: "Lights", done: true, by: "Ana", at: "08:00" }] };
    expect(checklistItems(["Lights", "Fridges"], record)).toEqual([record.items[0], { label: "Fridges", done: false, by: "", at: "" }]);
    expect(checklistItems(["Lights"])).toEqual([{ label: "Lights", done: false, by: "", at: "" }]);
  });

  it("flips the sign of a temperature", () => {
    expect(flipSign("18")).toBe("-18");
    expect(flipSign("-18")).toBe("18");
    expect(flipSign("")).toBe("-");
  });
});
