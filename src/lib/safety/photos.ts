import type { SafetyLog } from "@/lib/types";

/** Every photo a record points to, so they can be removed with it. */
export function photoIdsOf(log: SafetyLog): string[] {
  const ids = log.kind === "temperature" ? log.readings.map((reading) => reading.photoId)
    : log.kind === "cooking" ? [log.photoId, log.startPhotoId]
      : log.kind === "delivery" ? [log.chilledPhotoId, log.frozenPhotoId]
        : [];
  return ids.filter((id): id is string => Boolean(id));
}

/** Photos the earlier version had and the new one no longer uses: replaced or removed. */
export function droppedPhotos(before: SafetyLog | undefined, after: SafetyLog): string[] {
  if (!before) return [];
  const kept = new Set(photoIdsOf(after));
  return photoIdsOf(before).filter((id) => !kept.has(id));
}

/**
 * Temperatures written without a photo, as labels for the message (equipment names, or Italian keys
 * the caller translates). Empty temperatures need no photo.
 */
export function missingPhotos(log: SafetyLog): string[] {
  if (log.kind === "temperature") return log.readings.filter((reading) => reading.value !== null && !reading.photoId).map((reading) => reading.name);
  if (log.kind === "cooking") {
    const missing: string[] = [];
    if (log.process === "cool" && log.startTemperature !== null && log.startTemperature !== undefined && !log.startPhotoId) missing.push("Temperatura iniziale");
    if (log.temperature !== null && !log.photoId) missing.push(log.process === "cool" ? "Temperatura finale" : "Temperatura al cuore");
    return missing;
  }
  if (log.kind === "delivery") {
    const missing: string[] = [];
    if (log.chilledTemperature !== null && !log.chilledPhotoId) missing.push("Refrigerati");
    if (log.frozenTemperature !== null && !log.frozenPhotoId) missing.push("Surgelati");
    return missing;
  }
  return [];
}
