import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiReader, getInvoiceReader } from "@/lib/server/invoices/readers";

afterEach(() => { vi.unstubAllGlobals(); });

describe("invoice readers", () => {
  it("picks the reader from the environment", () => {
    expect(getInvoiceReader({})).toBeNull();
    expect(getInvoiceReader({ GEMINI_API_KEY: "k" })?.name).toBe("gemini");
    expect(getInvoiceReader({ INVOICE_READER: "demo" })?.name).toBe("demo");
    expect(getInvoiceReader({ INVOICE_READER: "unknown", GEMINI_API_KEY: "k" })).toBeNull();
  });

  it("sends the photos to Gemini and cleans the answer", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ supplier: "Heanens", invoiceNumber: "77", date: "2026-11-02", netTotal: 24, lines: [{ description: "Chicken Thigh", code: "", quantity: 2, unitPrice: 12, lineTotal: 24 }] }) }] } }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await geminiReader("key", "gemini-test").read([{ mimeType: "image/jpeg", data: "AAAA" }], { suppliers: ["Heanens"] });
    expect(result.lines).toEqual([{ description: "Chicken Thigh", code: "", quantity: 2, unitPrice: 12, lineTotal: 24 }]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/gemini-test:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key");
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[1]).toEqual({ inline_data: { mime_type: "image/jpeg", data: "AAAA" } });
    expect(body.contents[0].parts[0].text).toContain("Heanens");
  });

  it("explains a used-up free quota", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(geminiReader("key", "m").read([{ mimeType: "image/png", data: "AA" }], { suppliers: [] })).rejects.toMatchObject({ status: 429 });
  });
});
