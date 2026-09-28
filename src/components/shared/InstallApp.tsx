import { useState } from 'react'
import { Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { brand } from '@/config/brand'
import { promptInstall, useInstallOption } from '@/lib/pwa'

/**
 * Installing the app on this device. Chrome, Edge and Android show their own
 * prompt; iPhones and iPads install from Safari's Share menu, so they get
 * the steps instead. Renders nothing once the app is installed.
 */
export function useInstallApp() {
  const option = useInstallOption()
  const [helpOpen, setHelpOpen] = useState(false)

  const install = () => {
    if (option === 'prompt') void promptInstall()
    else if (option === 'share-menu') setHelpOpen(true)
  }

  const help = (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install {brand.name}</DialogTitle>
          <DialogDescription>It opens like any other app, full screen, straight from your home screen.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-[15px]">
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-track">
              <Share className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            In Safari, tap Share.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-track">
              <SquarePlus className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            Choose “Add to Home Screen”, then Add.
          </li>
        </ol>
        <DialogFooter>
          <Button variant="outline" onClick={() => setHelpOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { canInstall: option !== null, install, help }
}
