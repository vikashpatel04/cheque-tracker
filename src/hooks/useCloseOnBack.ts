import { createElement, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'

/** The part of the CloseWatcher API used here (Chrome 120+; not in TypeScript's DOM types yet). */
interface CloseWatcherLike {
  onclose: ((event: Event) => void) | null
  destroy(): void
}

type CloseWatcherConstructor = new () => CloseWatcherLike

/**
 * While `open`, the phone's back button or back gesture closes this overlay
 * instead of leaving the page (plan item 82). Chrome on Android, and the
 * installed app, send Back to the newest CloseWatcher, so nested overlays
 * close one at a time. It doesn't touch the address bar, so it can't undo
 * filters a sheet wrote there. Radix cancels the Esc keydown it handles, so
 * Esc on a desktop isn't handled twice. Where there's no CloseWatcher,
 * Back works as before.
 */
export function useCloseOnBack(open: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    const Watcher = (window as unknown as { CloseWatcher?: CloseWatcherConstructor }).CloseWatcher
    if (!open || !Watcher) return
    let watcher: CloseWatcherLike
    try {
      watcher = new Watcher()
    } catch {
      return
    }
    watcher.onclose = () => closeRef.current()
    return () => watcher.destroy()
  }, [open])
}

interface OpenProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * An overlay's root (dialog, sheet, popover, menu, select) that Back closes.
 * It keeps the open state itself when the root isn't controlled, so every
 * overlay gets this without changes where it's used.
 */
export function closesOnBack<P extends OpenProps>(Root: ComponentType<P>) {
  function ClosesOnBack({ open: openProp, defaultOpen, onOpenChange, ...rest }: P) {
    const [own, setOwn] = useState(defaultOpen ?? false)
    const controlled = openProp !== undefined
    const open = controlled ? openProp : own
    const change = useCallback(
      (next: boolean) => {
        if (!controlled) setOwn(next)
        onOpenChange?.(next)
      },
      [controlled, onOpenChange]
    )
    useCloseOnBack(open, () => change(false))
    return createElement(Root, { ...(rest as unknown as P), open, onOpenChange: change })
  }
  ClosesOnBack.displayName = `ClosesOnBack(${Root.displayName ?? Root.name ?? 'Root'})`
  return ClosesOnBack
}
