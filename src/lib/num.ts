/** Any value as a finite number, so empty fields and bad input count as zero. */
export function num(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum<T>(rows: T[], read: (row: T) => number): number {
  return round2(rows.reduce((total, row) => total + read(row), 0));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Local calendar day as YYYY-MM-DD, the format used by report and delivery dates. */
export function dateKey(date: Date): string {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function upsert<T extends { id: string }>(list: T[], saved: T): T[] {
  const index = list.findIndex((item) => item.id === saved.id);
  if (index < 0) return [saved, ...list];
  const next = [...list];
  next[index] = saved;
  return next;
}
