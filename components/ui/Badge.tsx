import type { HTMLAttributes } from 'react'

type Variant = 'new' | 'soft' | 'outline'

const VARIANTS: Record<Variant, string> = {
  new: 'bg-ink text-chalk',
  soft: 'bg-paper-2 text-ink-2',
  outline: 'bg-transparent text-ink shadow-[inset_0_0_0_1.5px_var(--border-soft)]',
}

const SIZES = { sm: 'h-5 px-2 text-[11px]', md: 'h-6 px-2.5 text-[12px]' }

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: keyof typeof SIZES
}

/** Small status label. `new` is an ink pill with a red dot ("3 new"). */
export function Badge({ variant = 'new', size = 'md', className, children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-pill font-semibold leading-none whitespace-nowrap tabular-nums ${SIZES[size]} ${VARIANTS[variant]} ${className ?? ''}`}
      {...rest}
    >
      {variant === 'new' && <span className="w-[7px] h-[7px] rounded-full bg-state-new shrink-0" />}
      {children}
    </span>
  )
}
