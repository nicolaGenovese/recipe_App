import { afterEach, describe, expect, it } from "vitest";
import { accessRequired, accessToken, hasAccess, passwordMatches } from "@/lib/server/access";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("shared password", () => {
  it("is open on a local computer without a password", () => {
    delete process.env.APP_PASSWORD; delete process.env.VERCEL;
    expect(accessRequired()).toBe(false);
    expect(hasAccess(undefined)).toBe(true);
  });

  it("is closed on Vercel even when the password is missing", () => {
    delete process.env.APP_PASSWORD; process.env.VERCEL = "1";
    expect(accessRequired()).toBe(true);
    expect(hasAccess(accessToken(""))).toBe(false);
  });

  it("lets in only the cookie made from the current password", () => {
    process.env.APP_PASSWORD = "kitchen-2026";
    expect(passwordMatches("kitchen-2026")).toBe(true);
    expect(passwordMatches("kitchen")).toBe(false);
    expect(hasAccess(accessToken("kitchen-2026"))).toBe(true);
    expect(hasAccess(accessToken("old-password"))).toBe(false);
    expect(hasAccess(undefined)).toBe(false);
  });
});
