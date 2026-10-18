export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

export async function exportExcel(filename: string, rows: Record<string, unknown>[]) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "LNPATS Report");
  XLSX.writeFile(book, `${filename}.xlsx`);
}

export async function exportPdf(title: string, rows: Record<string, unknown>[]) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(`LNPATS — ${title}`, 14, 18);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), 14, 25);
  const keys = Object.keys(rows[0] ?? {});
  autoTable(doc, { startY: 30, head: [keys], body: rows.map(r => keys.map(k => String(r[k] ?? ""))), styles: { fontSize: 8 } });
  doc.save(`${title}.pdf`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formValues(form: HTMLFormElement): any {
  return Object.fromEntries(new FormData(form));
}
