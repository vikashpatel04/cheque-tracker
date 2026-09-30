import { FileSpreadsheet } from 'lucide-react'

/** A large target for choosing the Excel file to import, in both import dialogs. */
export function ExcelFileChooser({ id, onFile }: { id: string; onFile: (file: File) => void }) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong bg-background px-4 py-7 text-center transition-colors hover:border-brand focus-within:border-brand focus-within:ring-2 focus-within:ring-ring/40"
    >
      <FileSpreadsheet className="h-7 w-7 text-ink-quiet" aria-hidden="true" />
      <span className="font-semibold">Choose the Excel file</span>
      <span className="text-[13px] text-ink-quiet">An .xlsx or .xls file, filled in like the template</span>
      <input
        id={id}
        type="file"
        accept=".xlsx,.xls"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared so the same file can be chosen again after "Choose another file".
          e.target.value = ''
          if (file) onFile(file)
        }}
      />
    </label>
  )
}
