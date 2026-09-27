import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import type { ImportCounts, ImportPlan, Workbook } from './importPlan'

/** Every sheet of an Excel file, as rows keyed by column header. */
export function readWorkbook(file: File): Promise<Workbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array', cellDates: true })
        const sheets: Workbook = {}
        for (const name of workbook.SheetNames) {
          sheets[name] = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name])
        }
        resolve(sheets)
      } catch {
        reject(new Error("Couldn't read this file. Choose the .xlsx file from Settings → Export."))
      }
    }
    reader.onerror = () => reject(new Error("Couldn't read this file."))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Save a plan from planImport() with the import_data database function
 * (migration 016), which saves all of it or nothing.
 */
export async function runImport(plan: ImportPlan): Promise<{ counts?: ImportCounts; error?: string }> {
  const { data, error } = await supabase.rpc('import_data', {
    p_data: { parties: plan.parties, cheques: plan.cheques, deposits: plan.deposits },
  })
  if (error) return { error: error.message }
  return { counts: data as unknown as ImportCounts }
}
