import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** When it changes (the page's path), the error is cleared and the page tries again. */
  resetKey?: string
}

interface State {
  error: Error | null
  key?: string
}

/**
 * Keeps a crash in one page from blanking the whole app: the frame stays, the
 * page says what happened, and moving to another page tries again.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-6">
        <p className="font-semibold">Something went wrong on this page</p>
        <p className="text-ink-quiet">
          Nothing you saved is lost. Reload to try again; the other pages still work if it keeps happening.
        </p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    )
  }
}
