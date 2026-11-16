import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import { createLocalStore } from "@/lib/server/store/local-store";
import { parsePhoto, parseSafetyLog } from "@/lib/server/validation";

let dir = "";
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); dir = ""; });

describe("temperature photos on the server", () => {
  it("accepts small images and refuses anything else", () => {
    expect(parsePhoto({ id: "p1", mimeType: "image/jpeg", data: "AAAA" })).toEqual({ id: "p1", mimeType: "image/jpeg", data: "AAAA" });
    expect(() => parsePhoto({ id: "p1", mimeType: "image/svg+xml", data: "AAAA" })).toThrow();
    expect(() => parsePhoto({ id: "a/b", mimeType: "image/jpeg", data: "AAAA" })).toThrow();
    expect(() => parsePhoto({ id: "p1", mimeType: "image/jpeg", data: "<script>" })).toThrow();
  });

  it("keeps photo ids on the records and drops bad ones", () => {
    const log = parseSafetyLog({
      id: "t1", kind: "temperature", date: "2026-11-16", time: "09:00", by: "Ana", slot: "am",
      readings: [{ equipmentId: "fridge-1", name: "Frigo 1", value: 3, photoId: "p1" }, { equipmentId: "fridge-2", name: "Frigo 2", value: 4, photoId: "../x" }]
    }, DEFAULT_SETTINGS);
    expect(log.kind === "temperature" && log.readings.map((reading) => reading.photoId)).toEqual(["p1", undefined]);
    const cool = parseSafetyLog({ id: "c1", kind: "cooking", process: "cool", item: "Ragù", date: "2026-11-16", by: "Ana", temperature: 5, startTemperature: 70, photoId: "a", startPhotoId: "b" }, DEFAULT_SETTINGS);
    expect(cool.kind === "cooking" && [cool.photoId, cool.startPhotoId]).toEqual(["a", "b"]);
  });

  it("stores photos apart from the archive in the local store", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "recipe-photos-"));
    const store = createLocalStore(path.join(dir, "recipes.json"));
    await store.savePhoto("p1", { mimeType: "image/jpeg", data: "AAAA" });
    expect(await store.getPhoto("p1")).toEqual({ mimeType: "image/jpeg", data: "AAAA" });
    expect("safetyLogs" in (await store.getState()) && JSON.stringify(await store.getState())).not.toContain("AAAA");
    await store.deletePhoto("p1");
    expect(await store.getPhoto("p1")).toBeNull();
  });
});
