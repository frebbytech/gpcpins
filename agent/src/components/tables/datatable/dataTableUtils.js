import _ from "lodash";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Reads a cell's raw value for a column, preferring an explicit
 * `valueGetter`, falling back to a dot-path lookup on `field`
 * (e.g. "user.name"). Used for export, client-side sort, and
 * client-side filter — NOT for on-screen rendering, which always
 * goes through `renderCell` when provided.
 */
export function getColumnValue(column, row) {
  if (typeof column.valueGetter === "function") {
    return column.valueGetter(row);
  }
  return column.field ? _.get(row, column.field) : undefined;
}

/**
 * Stable comparator generator for client-side sorting. Array#sort isn't
 * guaranteed stable pre-ES2019 engines; we tie-break on original index
 * to avoid rows jittering around when values are equal.
 */
export function getComparator(column, direction) {
  const dir = direction === "desc" ? -1 : 1;
  return (a, b) => {
    const va = getColumnValue(column, a.row);
    const vb = getColumnValue(column, b.row);

    if (va == null && vb == null) return a.index - b.index;
    if (va == null) return 1;
    if (vb == null) return -1;

    if (typeof va === "number" && typeof vb === "number") {
      return va === vb ? a.index - b.index : (va - vb) * dir;
    }

    const cmp = String(va).localeCompare(String(vb), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return cmp === 0 ? a.index - b.index : cmp * dir;
  };
}

function toPlainRows(columns, rows) {
  return rows.map((row) => {
    const out = {};
    columns.forEach((col) => {
      out[col.headerName || col.field] = getColumnValue(col, row);
    });
    return out;
  });
}

export function exportRowsToCsv(columns, rows, fileName = "table-export") {
  const plain = toPlainRows(columns, rows);
  if (plain.length === 0) return;

  const headers = Object.keys(plain[0]);
  const escape = (value) => {
    const str = value == null ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.map(escape).join(","),
    ...plain.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportRowsToExcel(columns, rows, fileName = "table-export") {
  const plain = toPlainRows(columns, rows);
  const worksheet = XLSX.utils.json_to_sheet(plain);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * @param {DataTableColumn[]} columns
 * @param {any[]} rows
 * @param {string} fileName
 * @param {{ title?: string, subtitle?: string, orientation?: 'portrait'|'landscape' }} [options]
 */
export function exportRowsToPdf(
  columns,
  rows,
  fileName = "table-export",
  { title, subtitle, orientation = "landscape" } = {},
) {
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const marginX = 40;

  let cursorY = 40;
  if (title) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, marginX, cursorY);
    cursorY += 16;
  }
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text(subtitle, marginX, cursorY);
    cursorY += 14;
  }

  const head = [columns.map((c) => c.headerName || c.field)];
  const body = rows.map((row) =>
    columns.map((c) => {
      const value = getColumnValue(c, row);
      return value == null ? "" : String(value);
    }),
  );

  autoTable(doc, {
    head,
    body,
    startY: cursorY + 6,
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [33, 33, 33],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    didDrawPage: (data) => {
      // Footer: page number + generated timestamp on every page.
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        marginX,
        pageHeight - 20,
      );
      doc.text(
        `Generated ${new Date().toLocaleString()}`,
        pageSize.width - marginX,
        pageHeight - 20,
        { align: "right" },
      );
    },
  });

  doc.save(`${fileName}.pdf`);
}