import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { exportAllData } from '@/lib/exportUtils'
import { PlanCard } from '@/components/settings/PlanCard'
import { ImportCard } from '@/components/settings/ImportCard'
import { RegionSettingsCard } from '@/components/settings/RegionSettingsCard'
import { fetchAllRows } from '@/lib/fetchAll'
import type { AllocationSort, Cheque, ChequeHistory, DailyDeposit, Party } from '@/types'
import type { BankAccount, ReceivedCheque, ReceivedChequeHistory } from '@/types/received'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { settings, region, updateSettings } = useSettings()
  const [autoPassEnabled, setAutoPassEnabled] = useState(settings?.auto_pass_enabled ?? false)
  const [autoPassTime, setAutoPassTime] = useState(settings?.auto_pass_time?.slice(0, 5) ?? '23:59')
  const [allocationSort, setAllocationSort] = useState<AllocationSort>(settings?.allocation_sort ?? 'due_date_asc')
  const [banksList, setBanksList] = useState<string[]>(settings?.banks ?? [])
  const [newBank, setNewBank] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  // Settings load asynchronously, so the form's initial state above is only a
  // placeholder. Sync it once the saved values arrive — otherwise saving
  // would overwrite the user's real settings (e.g. an empty bank list).
  useEffect(() => {
    if (!settings) return
    setAutoPassEnabled(settings.auto_pass_enabled ?? false)
    setAutoPassTime(settings.auto_pass_time?.slice(0, 5) ?? '23:59')
    setAllocationSort(settings.allocation_sort ?? 'due_date_asc')
    setBanksList(settings.banks ?? [])
  }, [settings])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    const result = await updateSettings({
      auto_pass_enabled: autoPassEnabled,
      auto_pass_time: `${autoPassTime}:00`,
      allocation_sort: allocationSort,
      banks: banksList,
    })
    setSaving(false)
    if (result.error) toast.error(result.error)
    else toast.success('Settings saved')
  }

  const handleAddBank = () => {
    const trimmed = newBank.trim()
    if (!trimmed) return
    if (!banksList.includes(trimmed)) {
      setBanksList([...banksList, trimmed])
    }
    setNewBank('')
  }

  const handleRemoveBank = (bankToRemove: string) => {
    setBanksList(banksList.filter((b) => b !== bankToRemove))
  }

  const handleExport = async () => {
    const results = await Promise.all([
      fetchAllRows<Party>('parties', '*', { activeOnly: true }),
      fetchAllRows<Cheque>('cheques', '*, party:parties(*)', { activeOnly: true }),
      fetchAllRows<ChequeHistory>('cheque_history'),
      fetchAllRows<DailyDeposit>('daily_deposits'),
      fetchAllRows<ReceivedCheque>('received_cheques', '*, party:parties(*)', { activeOnly: true }),
      fetchAllRows<ReceivedChequeHistory>('received_cheque_history'),
      fetchAllRows<BankAccount>('bank_accounts', '*', { activeOnly: true }),
    ])
    const failed = results.find((r) => r.error)
    if (failed) {
      toast.error(`Export failed, nothing was downloaded: ${failed.error}`)
      return
    }
    const [parties, cheques, history, deposits, received, receivedHistory, accounts] = results
    exportAllData({
      parties: parties.rows as Party[],
      cheques: cheques.rows as Cheque[],
      history: history.rows as ChequeHistory[],
      deposits: deposits.rows as DailyDeposit[],
      received: received.rows as ReceivedCheque[],
      receivedHistory: receivedHistory.rows as ReceivedChequeHistory[],
      accounts: accounts.rows as BankAccount[],
    })
    toast.success('Data exported')
  }

  const handleDeleteAll = async () => {
    if (deleteConfirm !== 'DELETE MY DATA') return
    const now = new Date().toISOString()
    for (const table of ['received_cheques', 'cheques', 'bank_accounts', 'parties'] as const) {
      const { error } = await supabase.from(table).update({ deleted_at: now }).is('deleted_at', null)
      if (error) {
        toast.error(error.message)
        return
      }
    }
    toast.success('All data deleted')
    setDeleteConfirm('')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <PlanCard />

      <RegionSettingsCard />

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor="auto_pass_enabled" className="text-sm font-medium">
                  Auto-pass funded cheques on due date
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {autoPassEnabled
                    ? 'At the scheduled time, funded cheques past their due date are marked Passed automatically.'
                    : 'Funded cheques will stay in their current status until you manually mark them Passed. Pending cheques always require manual action.'}
                </p>
              </div>
              <Switch
                id="auto_pass_enabled"
                checked={autoPassEnabled}
                onCheckedChange={setAutoPassEnabled}
              />
            </div>

            {autoPassEnabled && (
              <div>
                <Label htmlFor="auto_pass">Auto-pass time</Label>
                <Input
                  id="auto_pass"
                  type="time"
                  value={autoPassTime}
                  onChange={(e) => setAutoPassTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Funded cheques past their due date are marked Passed after this time
                  {region ? ` (${region.timeZone} time)` : ''}.
                </p>
              </div>
            )}
          </div>
          <div>
            <Label>Allocation Sort Order</Label>
            <Select value={allocationSort} onValueChange={(v) => setAllocationSort(v as AllocationSort)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date_asc">Due Date (earliest first)</SelectItem>
                <SelectItem value="amount_asc">Amount (smallest first)</SelectItem>
                <SelectItem value="amount_desc">Amount (largest first)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2 border-t">
            <Label>Bank List</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Configure the banks that appear in the dropdown when adding a cheque.
            </p>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add new bank..."
                value={newBank}
                onChange={(e) => setNewBank(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBank())}
                className="max-w-xs"
              />
              <Button type="button" variant="secondary" onClick={handleAddBank}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 max-w-lg">
              {banksList.map((b) => (
                <div key={b} className="flex items-center gap-1.5 rounded-full border bg-muted/50 pl-3 pr-1 py-1 text-sm font-medium">
                  {b}
                  <button
                    type="button"
                    onClick={() => handleRemoveBank(b)}
                    className="p-1 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {banksList.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No banks configured</p>
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Download all data as Excel</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExport}>Export All Data</Button>
        </CardContent>
      </Card>

      <ImportCard />

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Soft-delete all parties, cheques (given and received) and bank accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete All Data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  Type <strong>DELETE MY DATA</strong> to confirm. This will soft-delete all parties, cheques (given and received) and bank accounts.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE MY DATA"
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  disabled={deleteConfirm !== 'DELETE MY DATA'}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
