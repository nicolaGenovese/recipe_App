import { describe, expect, it } from "vitest";
import { buildRotaPdf } from "@/lib/rota/pdf";
import { DAY_OFF, HOLIDAY, isInvalidShift, normalizeRows, shiftHours, weekTotals } from "@/lib/rota/shifts";
import { isMondayKey, mondayOf, pastWeeks, plannableWeeks, rowsForStaff } from "@/lib/rota/weeks";

describe("rota shifts", () => {
  it("counts hours, overnight shifts and split shifts", () => {
    expect(shiftHours("09:00-17:00")).toBe(8);
    expect(shiftHours("18:00-02:00")).toBe(8);
    expect(shiftHours("10:00-14:00, 18:00-22:30")).toBe(8.5);
    expect(shiftHours("9.30-13.00")).toBe(3.5);
    expect(shiftHours(DAY_OFF)).toBe(0);
    expect(shiftHours("")).toBe(0);
  });

  it("flags shifts that cannot be read", () => {
    expect(isInvalidShift("9-5")).toBe(true);
    expect(isInvalidShift("25:00-26:00")).toBe(true);
    expect(isInvalidShift("09:00-17:00")).toBe(false);
    expect(isInvalidShift(HOLIDAY)).toBe(false);
  });

  it("adds up rows, days and the week", () => {
    const totals = weekTotals([
      { name: "A", shifts: ["09:00-17:00", DAY_OFF, "", "", "", "", "12:00-20:00"] },
      { name: "B", shifts: ["10:00-14:00", "", "", "", "", "", ""] }
    ]);
    expect(totals).toEqual({ rows: [16, 4], days: [12, 0, 0, 0, 0, 0, 8], total: 20 });
  });

  it("always gives seven shifts per row", () => {
    expect(normalizeRows([{ name: "A", shifts: ["x"] }, null])).toEqual([
      { name: "A", shifts: ["x", "", "", "", "", "", ""] }, { name: "", shifts: ["", "", "", "", "", "", ""] }
    ]);
  });
});

describe("rota weeks", () => {
  const today = new Date(2026, 10, 11);

  it("finds the Monday and the four plannable weeks", () => {
    expect(mondayOf(today)).toBe("2026-11-09");
    expect(plannableWeeks(today)).toEqual(["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(isMondayKey("2026-11-09")).toBe(true);
    expect(isMondayKey("2026-11-10")).toBe(false);
  });

  it("builds the week from the active staff and keeps lines that still have shifts", () => {
    const staff = [
      { id: "a", name: "Bruno", hourlyRate: 12, active: true }, { id: "b", name: "Abi", hourlyRate: 11, active: true }, { id: "c", name: "Koby", hourlyRate: 11, active: false }
    ];
    const stored = [
      { name: "bruno", shifts: ["09:00-17:00", "", "", "", "", "", ""] }, { name: "Koby", shifts: ["10:00-14:00", "", "", "", "", "", ""] },
      { name: "Old", shifts: ["", "", "", "", "", "", ""] }, { name: "", shifts: ["", "12:00-16:00", "", "", "", "", ""] }
    ];
    expect(rowsForStaff(stored, staff).map((row) => [row.name, row.shifts.filter(Boolean).length])).toEqual([["Bruno", 1], ["Abi", 0], ["Koby", 1], ["", 1]]);
  });

  it("lists past weeks newest first", () => {
    const weeks = [
      { id: "2026-10-26", rows: [{ name: "Ann", shifts: [] }], createdAt: "", updatedAt: "" },
      { id: "2026-11-02", rows: [{ name: "Bob", shifts: [] }, { name: "", shifts: [] }], createdAt: "", updatedAt: "" },
      { id: "2026-11-09", rows: [], createdAt: "", updatedAt: "" }
    ];
    expect(pastWeeks(weeks, today)).toEqual(["2026-11-02", "2026-10-26"]);
  });
});

describe("rota pdf", () => {
  it("writes a valid single-page PDF", () => {
    const pdf = buildRotaPdf({
      title: "Turni", subtitle: "9–15 novembre", headers: ["Staff", "L", "M", "M", "G", "V", "S", "D", "Totale"],
      rows: [{ name: "Zoë (chef)", shifts: ["09:00-17:00", DAY_OFF, "", "", "", "", ""] }], cellText: (value) => (value === DAY_OFF ? "Riposo" : value),
      rowTotals: ["8,0"], dayTotals: ["8,0", "0,0", "0,0", "0,0", "0,0", "0,0", "0,0"], grandTotal: "8,0", totalLabel: "Totale"
    });
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("(Riposo)");
    expect(pdf).toContain("\\(chef\\)");
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });
});
