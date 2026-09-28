import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppActions } from '@/hooks/useAppActions'
import { useDeposits } from '@/hooks/useDeposits'
import { formatCurrency } from '@/lib/formatters'

/** Funds added today, with the Add funds button. */
export function DepositWidget() {
  const { todayTotal } = useDeposits()
  const { addFunds } = useAppActions()

  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg border bg-card px-3 py-2 text-sm font-medium tabular-nums">
        <span className="font-normal text-muted-foreground">Funds added today:</span> {formatCurrency(todayTotal)}
      </div>
      <Button onClick={addFunds}>
        <Wallet />
        Add funds
      </Button>
    </div>
  )
}
