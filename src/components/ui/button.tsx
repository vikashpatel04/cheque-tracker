import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-brand-hover',
        destructive: 'border border-problem-line bg-surface text-problem hover:bg-problem-soft',
        outline: 'border border-line-strong bg-surface text-brand hover:bg-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-hover',
        ghost: 'text-ink hover:bg-hover',
        link: 'text-brand underline underline-offset-[3px] hover:text-brand-hover',
      },
      size: {
        default: 'h-11 px-[18px]',
        sm: 'h-9 px-3 text-sm [&_svg]:size-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
