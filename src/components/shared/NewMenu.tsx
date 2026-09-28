import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, FileSpreadsheet, ListPlus, Plus, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAppActions } from '@/hooks/useAppActions'

interface NewItem {
  label: string
  hint: string
  icon: LucideIcon
  run: () => void
  /** Starts a new group in the menu. */
  separated?: boolean
}

/** What the New menu adds. Received cheques and series join with plan item 14, step 4. */
function useNewItems(): NewItem[] {
  const actions = useAppActions()
  const navigate = useNavigate()
  return [
    { label: 'Given cheque', hint: 'A cheque you wrote to someone', icon: ArrowUpRight, run: () => actions.newGivenCheque() },
    {
      label: 'Several given cheques',
      hint: 'Many at once, with numbers counting up',
      icon: ListPlus,
      run: () => navigate('/bulk-add'),
    },
    { label: 'Add funds', hint: 'Money you put in the bank for them', icon: Wallet, run: () => actions.addFunds() },
    {
      label: 'Import from Excel',
      hint: 'Given cheques from the Excel template',
      icon: FileSpreadsheet,
      run: () => actions.importCheques(),
      separated: true,
    },
  ]
}

function ItemText({ item }: { item: NewItem }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{item.label}</span>
      <span className="text-[13px] text-ink-quiet">{item.hint}</span>
    </span>
  )
}

/** The New button in the desktop top bar. */
export function NewMenuButton() {
  const items = useNewItems()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2 pl-4 pr-3.5">
          <Plus strokeWidth={2.2} />
          New
          <ChevronDown className="!size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80">
        {items.map((item) => (
          <div key={item.label}>
            {item.separated && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={item.run} className="items-start py-2.5">
              <item.icon className="mt-0.5 !size-[18px] text-ink-quiet" />
              <ItemText item={item} />
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The same choices as a sheet, from the + in the phone's bottom tabs. */
export function NewSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const items = useNewItems()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-4 pt-5">
        <SheetHeader className="text-left">
          <SheetTitle className="font-title text-2xl">New</SheetTitle>
          <SheetDescription className="sr-only">Add a cheque, add funds or import.</SheetDescription>
        </SheetHeader>
        <div className="mt-2 flex flex-col">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                onOpenChange(false)
                item.run()
              }}
              className="flex min-h-14 items-center gap-3.5 rounded-xl px-2 py-2.5 text-left text-base transition-colors hover:bg-hover"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-money-out-soft text-ink">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <ItemText item={item} />
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
