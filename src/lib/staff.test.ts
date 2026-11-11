import { describe, expect, it } from "vitest";
import { normalizeSettings } from "@/lib/settings";
import { cleanStaff, staffFromRota, staffId } from "@/lib/staff";

describe("staff list", () => {
  it("builds the first list from the rota, newest week first, with old rates", () => {
    const weeks = [
      { id: "2026-11-02", rows: [{ name: "Abi", shifts: [] }, { name: "Bruno", shifts: [] }] },
      { id: "2026-11-09", rows: [{ name: "Bruno ", shifts: [] }, { name: "", shifts: [] }] }
    ];
    expect(staffFromRota(weeks, { Bruno: 13.5 })).toEqual([
      { id: "staff-bruno", name: "Bruno", role: "", hourlyRate: 13.5, active: true }, { id: "staff-abi", name: "Abi", role: "", hourlyRate: 0, active: true }
    ]);
    expect(normalizeSettings({ labour: { onCostPercent: 5, rates: { Abi: 11 } } } as never, weeks).staff.map((member) => [member.name, member.hourlyRate])).toEqual([["Bruno", 0], ["Abi", 11]]);
    expect(normalizeSettings({ staff: [] } as never, weeks).staff).toEqual([]);
  });

  it("cleans names, rates and duplicates", () => {
    expect(cleanStaff([{ name: " Zoë ", hourlyRate: -3 }, { name: "zoë" }, { name: "" }])).toEqual([{ id: staffId("Zoë"), name: "Zoë", role: "", hourlyRate: 0, active: true }]);
    expect(staffId("Zoë Ann")).toBe("staff-zoe-ann");
  });
});
