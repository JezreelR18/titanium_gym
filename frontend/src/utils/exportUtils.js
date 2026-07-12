import * as XLSX from "xlsx";

/**
 * Export an array of objects to a CSV file.
 * Uses UTF-8 BOM so Excel on Windows opens it correctly with accents.
 */
export function exportCSV(rows, filename = "exportacion") {
  if (!rows || rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows.map((r) =>
    keys.map((k) => {
      const val = r[k] ?? "";
      const str = String(val).replace(/"/g, '""');
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str}"`
        : str;
    }).join(",")
  );
  const csv = "﻿" + [header, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Export an array of objects to an .xlsx file.
 * @param {object[]} rows - data rows
 * @param {string[]} [headers] - optional human-readable column headers
 * @param {string} filename
 */
export function exportExcel(rows, headers, filename = "exportacion") {
  if (!rows || rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  if (headers) {
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
