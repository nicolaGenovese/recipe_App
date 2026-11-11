// A one-page landscape A4 PDF of a rota week, written by hand so no PDF library is needed.
// Ported from the original Rota app; texts arrive already translated.
import { DAY_OFF, HOLIDAY } from "@/lib/rota/shifts";
import type { RotaRow } from "@/lib/types";

export interface RotaPdfInput {
  title: string;
  subtitle: string;
  /** "Staff", then the seven day headings, then "Total". */
  headers: string[];
  rows: RotaRow[];
  /** What each cell shows: the shift text, or the translated day-off / holiday label. */
  cellText: (value: string) => string;
  rowTotals: string[];
  dayTotals: string[];
  grandTotal: string;
  totalLabel: string;
}

const CP1252 = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

/** PDF string literal in WinAnsi encoding; characters it cannot hold become "?". */
function pdfText(value: string): string {
  const encoded = Array.from(value.normalize("NFC"), (character) => {
    const code = character.codePointAt(0) as number;
    const byte = (code >= 32 && code <= 126) || (code >= 160 && code <= 255) ? code : CP1252.get(code) ?? 63;
    if (byte === 40 || byte === 41 || byte === 92) return "\\" + String.fromCharCode(byte);
    if (byte < 32 || byte > 126) return "\\" + byte.toString(8).padStart(3, "0");
    return String.fromCharCode(byte);
  }).join("");
  return "(" + encoded + ")";
}

const textWidth = (value: string, size: number) => Array.from(value).reduce((width, character) => {
  if (" ilI.,:".includes(character)) return width + size * 0.28;
  if ("MW@".includes(character)) return width + size * 0.78;
  return width + size * 0.52;
}, 0);

const rgb = (hex: string) => [0, 2, 4].map((offset) => (parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255).toFixed(3)).join(" ");
const n = (value: number) => Number(value.toFixed(2)).toString();

export function buildRotaPdf(input: RotaPdfInput): string {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 24;
  const tableWidth = pageWidth - margin * 2;
  const nameWidth = 130;
  const totalWidth = 56;
  const dayWidth = (tableWidth - nameWidth - totalWidth) / 7;
  const widths = [nameWidth, ...Array<number>(7).fill(dayWidth), totalWidth];
  const headerHeight = 28;
  const rowCount = input.rows.length + 1;
  const rowHeight = Math.min(30, (pageHeight - 105 - headerHeight - margin) / Math.max(rowCount, 1));
  const top = pageHeight - 105;
  const commands: string[] = [];

  const rect = (x: number, y: number, w: number, h: number, color: string) => commands.push(`${rgb(color)} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`);
  const line = (x1: number, y1: number, x2: number, y2: number) => commands.push(`0.769 0.800 0.745 RG 0.6 w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`);
  const text = (value: string, x: number, y: number, size: number, options: { bold?: boolean; color?: string; center?: boolean } = {}) => {
    const left = options.center ? x - textWidth(value, size) / 2 : x;
    commands.push(`${rgb(options.color ?? "#252b24")} rg BT /${options.bold ? "F2" : "F1"} ${n(size)} Tf 1 0 0 1 ${n(left)} ${n(y)} Tm ${pdfText(value)} Tj ET`);
  };
  const fitted = (value: string, width: number, size: number) => Math.max(6, Math.min(size, (width - 10) / Math.max(1, value.length * 0.52)));

  text(input.title, margin, pageHeight - 45, 22, { bold: true, color: "#354632" });
  text(input.subtitle, margin, pageHeight - 68, 10, { color: "#858b80" });

  let x = margin;
  input.headers.forEach((header, index) => {
    rect(x, top - headerHeight, widths[index], headerHeight, "#354632");
    text(header, x + widths[index] / 2, top - headerHeight / 2 - 3, fitted(header, widths[index], 8), { bold: true, color: "#ffffff", center: true });
    x += widths[index];
  });

  const body = input.rows.map((row, index) => ({ cells: [row.name, ...row.shifts.map(input.cellText), input.rowTotals[index]], shifts: row.shifts, total: false }));
  body.push({ cells: [input.totalLabel, ...input.dayTotals, input.grandTotal], shifts: Array<string>(7).fill(""), total: true });

  body.forEach((row, rowIndex) => {
    const bottom = top - headerHeight - (rowIndex + 1) * rowHeight;
    x = margin;
    row.cells.forEach((value, column) => {
      const shift = column > 0 && column < 8 ? row.shifts[column - 1] : "";
      const fill = row.total ? "#e8ecdf" : shift === DAY_OFF ? "#e6f1fb" : shift === HOLIDAY ? "#faeeda" : rowIndex % 2 ? "#f7f7f3" : "#ffffff";
      rect(x, bottom, widths[column], rowHeight, fill);
      const size = fitted(String(value ?? ""), widths[column], 9);
      text(String(value ?? ""), column === 0 ? x + 6 : x + widths[column] / 2, bottom + rowHeight / 2 - size / 3, size, { bold: row.total || column === 8, center: column > 0 });
      x += widths[column];
    });
  });

  const bottom = top - headerHeight - body.length * rowHeight;
  line(margin, top, margin + tableWidth, top);
  let vertical = margin;
  line(vertical, bottom, vertical, top);
  widths.forEach((width) => { vertical += width; line(vertical, bottom, vertical, top); });
  for (let row = 0; row <= body.length; row += 1) line(margin, top - headerHeight - row * rowHeight, margin + tableWidth, top - headerHeight - row * rowHeight);

  const content = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
