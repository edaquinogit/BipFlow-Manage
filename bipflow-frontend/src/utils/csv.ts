/**
 * Minimal CSV export helper for client-side reports.
 *
 * Escapes values per RFC 4180 (wraps in quotes, doubles inner quotes) so
 * commas/quotes/newlines in cell content never corrupt the column layout
 * when opened in Excel/Sheets.
 */
const escapeCsvCell = (value: string | number): string => {
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export const buildCsv = (headers: string[], rows: (string | number)[][]): string => {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','))
  return lines.join('\r\n')
}

// Excel only detects UTF-8 (vs. Latin-1) when the file starts with a BOM;
// without it, accented characters like "regiao" render as mojibake.
const UTF8_BOM = '\uFEFF'

export const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]): void => {
  const csvContent = buildCsv(headers, rows)
  const blob = new Blob([UTF8_BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}
