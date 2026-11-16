import { describe, expect, it } from "vitest";
import { availabilityLabel, dayNames, isAvailableAt, normalizeAvailability } from "@/lib/menus/availability";

const names = dayNames("en-GB");
// 15 November 2026 is a Sunday, 16 a Monday.
const at = (day: number, time: string) => new Date(2026, 10, day, Number(time.slice(0, 2)), Number(time.slice(3)));

describe("menu availability", () => {
  it("drops bad slots and treats every day without hours as always available", () => {
    expect(normalizeAvailability({ days: [0, 1, 2, 3, 4, 5, 6], slots: [] })).toBeUndefined();
    expect(normalizeAvailability({ days: [6, 6, 9], slots: [{ from: "12:00", to: "17:00" }, { from: "25:00", to: "1" }, { from: "10:00", to: "10:00" }] }))
      .toEqual({ days: [6], slots: [{ from: "12:00", to: "17:00" }] });
    expect(normalizeAvailability({ days: [], slots: [{ from: "18:00", to: "22:00" }] })).toEqual({ days: [], slots: [{ from: "18:00", to: "22:00" }] });
  });

  it("checks day and hours", () => {
    const roast = { days: [6], slots: [{ from: "12:00", to: "17:00" }] };
    expect(isAvailableAt(roast, at(15, "12:00"))).toBe(true);
    expect(isAvailableAt(roast, at(15, "17:00"))).toBe(false);
    expect(isAvailableAt(roast, at(16, "13:00"))).toBe(false);
    expect(isAvailableAt(undefined, at(16, "03:00"))).toBe(true);
    expect(isAvailableAt({ days: [5, 6], slots: [] }, at(15, "23:59"))).toBe(true);
  });

  it("keeps the hours after midnight on the day the slot started", () => {
    const late = { days: [5], slots: [{ from: "22:00", to: "02:00" }] };
    expect(isAvailableAt(late, at(14, "23:00"))).toBe(true);
    expect(isAvailableAt(late, at(15, "01:30"))).toBe(true);
    expect(isAvailableAt(late, at(16, "01:30"))).toBe(false);
  });

  it("writes days as ranges", () => {
    expect(availabilityLabel({ availability: { days: [0, 1, 2, 3, 4], slots: [{ from: "12:00", to: "15:00" }, { from: "18:00", to: "22:00" }] } }, names, "Every day"))
      .toBe("Mon–Fri · 12:00–15:00, 18:00–22:00");
    expect(availabilityLabel({ availability: { days: [5, 6], slots: [] } }, names, "Every day")).toBe("Sat, Sun");
    expect(availabilityLabel({ availability: { days: [], slots: [{ from: "17:00", to: "21:00" }] } }, names, "Every day")).toBe("Every day · 17:00–21:00");
    expect(availabilityLabel({}, names, "Every day")).toBe("");
  });
});
