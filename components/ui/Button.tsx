import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

// height / font size / horizontal padding: sm 32/14/14, md 40/15/16, lg 48/16/20
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[14px]',
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-12 px-5 text-[16px]',
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-chalk',
  secondary: 'bg-chalk text-ink shadow-[inset_0_0_0_1.5px_var(--border-soft)]',
  ghost: 'bg-transparent text-ink',
  danger: 'bg-transparent text-state-danger',
}

const BASE =
  'k-press inline-flex items-center justify-center gap-2 rounded-pill font-semibold leading-none tracking-[-0.01em] whitespace-nowrap cursor-pointer ' +
  'disabled:opacity-40 disabled:cursor-default disabled:active:scale-100'

export function buttonClass({ variant = 'primary', size = 'md', block = false }: { variant?: Variant; size?: Size; block?: boolean } = {}) {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${block ? 'w-full' : ''}`
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: ReactNode
}

export function Button({ variant, size, block, icon, className, type = 'button', children, ...rest }: Props) {
  return (
    <button type={type} className={`${buttonClass({ variant, size, block })} ${className ?? ''}`} {...rest}>
      {icon}
      {children}
    </button>
  )
}

type IconVariant = 'chalk' | 'ink' | 'outline' | 'ghost' | 'star'

const ICON_VARIANTS: Record<IconVariant, string> = {
  chalk: 'bg-chalk text-ink',
  ink: 'bg-ink text-chalk',
  outline: 'bg-transparent text-ink shadow-[inset_0_0_0_1.5px_var(--border-soft)]',
  ghost: 'bg-transparent text-ink hover:bg-shade',
  star: 'bg-chalk text-ink',
}

// sm 32, md 40 (44 on mobile for the hit target), lg 48; icon ≈ 45% of the button
const ICON_SIZES = { sm: ['w-8 h-8', 15], md: ['w-11 h-11 md:w-10 md:h-10', 18], lg: ['w-12 h-12', 22] } as const

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  label: string
  variant?: IconVariant
  size?: keyof typeof ICON_SIZES
  filled?: boolean
}

export function IconButton({ icon, label, variant = 'chalk', size = 'md', filled = false, className, ...rest }: IconButtonProps) {
  const [box, iconSize] = ICON_SIZES[size]
  const look = variant === 'star' && filled ? 'bg-lemon text-ink' : ICON_VARIANTS[variant]
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`k-press ${box} ${look} inline-flex shrink-0 items-center justify-center rounded-full cursor-pointer disabled:opacity-40 ${className ?? ''}`}
      {...rest}
    >
      <Icon name={icon} size={iconSize} strokeWidth={2} filled={filled} />
    </button>
  )
}
