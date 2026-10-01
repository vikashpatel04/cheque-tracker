import { loadPdf, loadXlsx } from './lazyLibs'
import { formatCurrencyCode, formatDate, formatMonthLabel, formatNumber } from './formatters'
import type { ReportCell, ReportColumn, ReportTable } from './reportTables'

/**
 * "Export this tab" on Reports: the tab's tables as a PDF (one section each)
 * or an Excel workbook (one sheet each), with the filters written at the top.
 */

export interface ReportExport {
  title: string
  /** The filters, in one line. */
  subtitle: string
  tables: ReportTable[]
  fileName: string
}

const isMonthKey = (cell: ReportCell) => typeof cell === 'string' && /^\d{4}-\d{2}$/.test(cell)
const isNumeric = (column: ReportColumn) => column.kind !== 'text' && column.kind !== 'date' && column.kind !== 'month'

/** A cell as text for the PDF. Amounts carry the currency code: the built-in PDF fonts can't draw symbols such as ₹. */
export function pdfCell(column: ReportColumn, cell: ReportCell): string {
  if (cell === null || cell === '') return ''
  switch (column.kind) {
    case 'money':
      return formatCurrencyCode(Number(cell))
    case 'count':
      return formatNumber(Number(cell))
    case 'date':
      return formatDate(String(cell))
    case 'month':
      return isMonthKey(cell) ? formatMonthLabel(String(cell)) : String(cell)
    case 'percent':
      return `${formatNumber(Number(cell) * 100, 1)}%`
    case 'net': {
      const value = Number(cell)
      if (!value) return formatCurrencyCode(0)
      const [positive, negative] = column.words ?? ['', '']
      return `${formatCurrencyCode(Math.abs(value))} ${value > 0 ? positive : negative}`.trim()
    }
    default:
      return String(cell)
  }
}

/** A cell for the spreadsheet: amounts and counts stay numbers, so they add up. */
export function sheetCell(column: ReportColumn, cell: ReportCell): string | number {
  if (cell === null) return ''
  switch (column.kind) {
    case 'date':
      return formatDate(String(cell))
    case 'month':
      return isMonthKey(cell) ? formatMonthLabel(String(cell)) : String(cell)
    case 'percent':
      return Math.round(Number(cell) * 1000) / 10
    default:
      return cell
  }
}

export function sheetHeader(column: ReportColumn): string {
  if (column.kind === 'percent') return `${column.label} (%)`
  if (column.kind === 'net' && column.words) return `${column.label} (+ ${column.words[0]}, - ${column.words[1]})`
  return column.label
}

/** Excel allows 31 characters and no []:*?/\ in a sheet name, and each must be unique. */
function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 28).trim() || 'Sheet'
  let name = base
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} ${n}`
  used.add(name.toLowerCase())
  return name
}

export async function exportReportExcel({ title, subtitle, tables, fileName }: ReportExport) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const table of tables) {
    const row = (cells: ReportCell[]) => cells.map((cell, i) => sheetCell(table.columns[i], cell))
    const sheet = XLSX.utils.aoa_to_sheet([
      [`${title}: ${table.title}`],
      [subtitle],
      ...(table.note ? [[table.note]] : []),
      [],
      table.columns.map(sheetHeader),
      ...table.rows.map(row),
      ...(table.total ? [row(table.total)] : []),
    ])
    sheet['!cols'] = table.columns.map((c) => ({ wch: Math.max(sheetHeader(c).length + 2, c.kind === 'text' ? 26 : 14) }))
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName(table.title, used))
  }
  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}

// The brand blue of the Passbook look, for table headings. PDFs can't read the app's colour tokens.
const HEAD_FILL: [number, number, number] = [31, 58, 95]

export async function exportReportPdf({ title, subtitle, tables, fileName }: ReportExport) {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({ orientation: 'landscape' })
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(16)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.text(doc.splitTextToSize(subtitle, 265), 14, 22)
  let y = 32
  for (const table of tables) {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = 16
    }
    doc.setFontSize(12)
    doc.text(table.title, 14, y)
    y += 2
    if (table.note) {
      doc.setFontSize(8)
      const lines = doc.splitTextToSize(table.note, 265)
      doc.text(lines, 14, y + 4)
      y += 4 * lines.length
    }
    const columnStyles = Object.fromEntries(
      table.columns.map((c, i) => [i, { halign: isNumeric(c) ? ('right' as const) : ('left' as const) }])
    )
    const body = table.rows.length
      ? table.rows.map((cells) => cells.map((cell, i) => pdfCell(table.columns[i], cell)))
      : [['Nothing here with these filters', ...table.columns.slice(1).map(() => '')]]
    autoTable(doc, {
      startY: y + 3,
      head: [table.columns.map((c) => c.label)],
      body,
      foot: table.total ? [table.total.map((cell, i) => pdfCell(table.columns[i], cell))] : undefined,
      showFoot: 'lastPage',
      columnStyles,
      // Headings and totals line up with their column, like the numbers under them.
      didParseCell: (cell) => {
        if (cell.section !== 'body' && isNumeric(table.columns[cell.column.index])) cell.cell.styles.halign = 'right'
      },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: HEAD_FILL, textColor: 255 },
      footStyles: { fillColor: [240, 237, 230], textColor: 20, fontStyle: 'bold' },
    })
    y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
  }
  doc.save(`${fileName}.pdf`)
}
