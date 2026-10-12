import "server-only";

// CSV for staff exports (admin-ux §6.6 "Download a spreadsheet"; PLAN D102): UTF-8 with a BOM so Excel
// opens it cleanly, CRLF line ends, RFC 4180 quoting, and every cell that starts with = + - @ (or a
// tab or carriage return) prefixed with ' so a spreadsheet never runs it as a formula.

export type Cell = string | number | boolean | null | undefined;

const RISKY = /^[=+\-@\t\r]/;

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "string" ? v : String(v);
  if (typeof v === "string" && RISKY.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
