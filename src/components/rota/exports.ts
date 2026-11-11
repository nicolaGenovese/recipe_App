"use client";

import { cellLabel, type RotaFormat } from "@/lib/rota/format";
import { buildRotaPdf } from "@/lib/rota/pdf";
import { isEmptyRow, weekTotals } from "@/lib/rota/shifts";
import type { RotaRow } from "@/lib/types";

export interface ExportTexts {
  title: string;
  staff: string;
  total: string;
  dailyTotal: string;
  dayOff: string;
  holiday: string;
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const printable = (rows: RotaRow[]) => rows.filter((row) => !isEmptyRow(row));

export function downloadRotaPdf(weekId: string, rows: RotaRow[], format: RotaFormat, texts: ExportTexts) {
  const list = printable(rows);
  const totals = weekTotals(list);
  const pdf = buildRotaPdf({
    title: texts.title, subtitle: format.weekLabel(weekId),
    headers: [texts.staff, ...format.dayHeads(weekId).map((head) => head.name + " " + head.day), texts.total],
    rows: list, cellText: (value) => cellLabel(value, texts), rowTotals: totals.rows.map(format.hours),
    dayTotals: totals.days.map(format.hours), grandTotal: format.hours(totals.total), totalLabel: texts.dailyTotal
  });
  // The PDF is WinAnsi text: each character code is one byte.
  download("Rota_" + weekId + ".pdf", new Blob([Uint8Array.from(pdf, (character) => character.charCodeAt(0) & 0xff)], { type: "application/pdf" }));
}

interface SheetJs {
  utils: { aoa_to_sheet: (rows: unknown[][]) => Record<string, unknown>; book_new: () => unknown; book_append_sheet: (book: unknown, sheet: unknown, name: string) => void };
  writeFile: (book: unknown, filename: string) => void;
}

/** SheetJS is large and only needed here, so it is loaded the first time someone exports. */
function loadSheetJs(): Promise<SheetJs> {
  const existing = (window as unknown as { XLSX?: SheetJs }).XLSX;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/xlsx.full.min.js";
    script.onload = () => {
      const loaded = (window as unknown as { XLSX?: SheetJs }).XLSX;
      if (loaded) resolve(loaded); else reject(new Error("Esportazione Excel non disponibile."));
    };
    script.onerror = () => reject(new Error("Esportazione Excel non disponibile."));
    document.head.append(script);
  });
}

export async function downloadRotaExcel(weekId: string, rows: RotaRow[], format: RotaFormat, texts: ExportTexts) {
  const XLSX = await loadSheetJs();
  const list = printable(rows);
  const totals = weekTotals(list);
  const round = (value: number) => Math.round(value * 100) / 100;
  const data: unknown[][] = [[texts.staff, ...format.dayHeads(weekId).map((head) => head.name + " " + head.day), texts.total]];
  list.forEach((row, index) => data.push([row.name, ...row.shifts.map((value) => cellLabel(value, texts)), round(totals.rows[index])]));
  data.push([texts.dailyTotal, ...totals.days.map(round), round(totals.total)]);
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [{ wch: 24 }, ...Array.from({ length: 7 }, () => ({ wch: 18 })), { wch: 12 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Rota");
  XLSX.writeFile(book, "Rota_" + weekId + ".xlsx");
}

