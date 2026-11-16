import { describe, expect, it } from "vitest";
import { droppedPhotos, missingPhotos, photoIdsOf } from "@/lib/safety/photos";
import type { CookingLog, DeliveryCheckLog, TemperatureLog } from "@/lib/types";

const base = { id: "l", date: "2026-11-16", time: "09:00", by: "Ana", ok: true, createdAt: "", updatedAt: "" };
const temps = (readings: TemperatureLog["readings"]): TemperatureLog => ({ ...base, kind: "temperature", slot: "am", readings });
const reading = (name: string, value: number | null, photoId?: string) => ({ equipmentId: name, name, value, ok: true, ...(photoId ? { photoId } : {}) });

describe("temperature photos", () => {
  it("asks for a photo only where a temperature was written", () => {
    expect(missingPhotos(temps([reading("Frigo 1", 3, "p1"), reading("Frigo 2", 4), reading("Congelatore", null)]))).toEqual(["Frigo 2"]);
    const cool: CookingLog = { ...base, kind: "cooking", process: "cool", item: "Ragù", temperature: 6, startTemperature: 70, photoId: "p2" };
    expect(missingPhotos(cool)).toEqual(["Temperatura iniziale"]);
    const cook: CookingLog = { ...base, kind: "cooking", process: "cook", item: "Pollo", temperature: 80 };
    expect(missingPhotos(cook)).toEqual(["Temperatura al cuore"]);
    const delivery: DeliveryCheckLog = { ...base, kind: "delivery", supplier: "Heanens", chilledTemperature: 4, frozenTemperature: null, packagingOk: true, datesOk: true, rejected: "", chilledPhotoId: "p3" };
    expect(missingPhotos(delivery)).toEqual([]);
  });

  it("lists the photos of a record and the ones a new version dropped", () => {
    const before = temps([reading("Frigo 1", 3, "a"), reading("Frigo 2", 4, "b")]);
    const after = temps([reading("Frigo 1", 3, "a"), reading("Frigo 2", 4, "c")]);
    expect(photoIdsOf(before)).toEqual(["a", "b"]);
    expect(droppedPhotos(before, after)).toEqual(["b"]);
    expect(droppedPhotos(undefined, after)).toEqual([]);
  });
});
