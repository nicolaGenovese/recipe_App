import { afterEach, describe, expect, it, vi } from "vitest";
import { byRest, geminiReader, getInvoiceReader, pickModels, thinkingFor } from "@/lib/server/invoices/readers";

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
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await geminiReader("key", "gemini-test").read([{ mimeType: "image/jpeg", data: "AAAA" }], { suppliers: ["Heanens"] });
    expect(result.lines).toEqual([{ description: "Chicken Thigh", code: "", quantity: 2, unitPrice: 12, lineTotal: 24, kind: "food" }]);
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

  it("turns thinking down so the reading ends in time", async () => {
    expect(thinkingFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingFor("gemini-3-flash-preview")).toEqual({ thinkingLevel: "low" });
    expect(thinkingFor("gemini-flash-latest")).toBeUndefined();
  });

  it("tries the next model when the first one is not available", async () => {
    const answer = { candidates: [{ content: { parts: [{ text: JSON.stringify({ supplier: "Browns", invoiceNumber: "1", date: "", lines: [] }) }] } }] };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(answer), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await geminiReader("key", ["first", "second"]).read([{ mimeType: "image/jpeg", data: "AA" }], { suppliers: [] });
    expect(result.supplier).toBe("Browns");
    expect(String(fetch.mock.calls[1][0])).toContain("/models/second:");
  });

  it("does not retry with a wrong key", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(geminiReader("key", ["a", "b"]).read([{ mimeType: "image/png", data: "AA" }], { suppliers: [] })).rejects.toMatchObject({ status: 502 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("picks the newest Flash models the key can use", () => {
    const gen = ["generateContent"];
    expect(pickModels([
      { name: "models/gemini-2.5-flash", supportedGenerationMethods: gen },
      { name: "models/gemini-3.8-flash", supportedGenerationMethods: gen },
      { name: "models/gemini-3.5-flash", supportedGenerationMethods: gen },
      { name: "models/gemini-3.8-flash-lite", supportedGenerationMethods: gen },
      { name: "models/gemini-3.9-flash-preview", supportedGenerationMethods: gen },
      { name: "models/gemini-3.8-pro", supportedGenerationMethods: gen },
      { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] }
    ])).toEqual(["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.8-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"]);
    expect(pickModels([])).toEqual(["gemini-flash-latest", "gemini-flash-lite-latest"]);
  });

  it("asks Google for the models when none is set", async () => {
    const answer = { candidates: [{ content: { parts: [{ text: JSON.stringify({ supplier: "Browns", invoiceNumber: "1", date: "", lines: [] }) }] } }] };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: "models/gemini-9-flash", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(answer), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "info").mockImplementation(() => {});
    await geminiReader("other-key").read([{ mimeType: "image/jpeg", data: "AA" }], { suppliers: [] });
    expect(String(fetch.mock.calls[1][0])).toContain("/models/gemini-9-flash:");
    expect(JSON.parse(String((fetch.mock.calls[1][1] as RequestInit).body)).generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  it("moves to another model when the free quota of one runs out, and tries it last afterwards", async () => {
    const answer = { candidates: [{ content: { parts: [{ text: JSON.stringify({ supplier: "Browns", invoiceNumber: "1", date: "", lines: [] }) }] } }] };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(answer), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    await geminiReader("key", ["busy-flash", "lite"]).read([{ mimeType: "image/jpeg", data: "AA" }], { suppliers: [] });
    expect(String(fetch.mock.calls[1][0])).toContain("/models/lite:");
    expect(byRest(["busy-flash", "lite"])).toEqual(["lite", "busy-flash"]);
  });
});
