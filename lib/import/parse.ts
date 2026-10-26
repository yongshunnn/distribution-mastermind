// Browser-side spreadsheet parsing (CSV via Papa Parse, XLSX via read-excel-file).
import Papa from 'papaparse';

export async function parseSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    const data = (await readSheet(file)) as unknown[][];
    const [header, ...body] = data;
    if (!header) return [];
    const keys = header.map((h) => String(h ?? '').trim());
    return body
      .filter((r) => r.some((c) => c !== null && c !== ''))
      .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] instanceof Date ? (r[i] as Date).toISOString().slice(0, 10) : (r[i] ?? '')])));
  }
  const text = await file.text();
  const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  return res.data;
}
