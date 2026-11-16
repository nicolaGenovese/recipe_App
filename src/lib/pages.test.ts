import { describe, expect, it } from "vitest";
import { pageWindow } from "@/lib/pages";

describe("page buttons", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("keeps first, last and neighbours, with gaps", () => {
    expect(pageWindow(1, 11)).toEqual([1, 2, 3, 4, 5, null, 11]);
    expect(pageWindow(5, 11)).toEqual([1, null, 4, 5, 6, null, 11]);
    expect(pageWindow(11, 11)).toEqual([1, null, 7, 8, 9, 10, 11]);
    expect(pageWindow(3, 11)).toEqual([1, 2, 3, 4, 5, null, 11]);
  });
});
