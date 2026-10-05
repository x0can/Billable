type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  if (value == null) return '';
  let s = String(value);
  // Prevent CSV formula injection when the file is opened in a spreadsheet.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with CRLF line endings. */
export function toCsv<T extends Record<string, Cell>>(rows: T[], columns: (keyof T & string)[]): string {
  const lines = [columns.join(','), ...rows.map((row) => columns.map((c) => escapeCell(row[c])).join(','))];
  return lines.map((line) => `${line}\r\n`).join('');
}
