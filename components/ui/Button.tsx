import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-12 px-[22px] text-[15px]',
  lg: 'h-[60px] px-7 text-[17px]',
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-chalk',
  secondary: 'bg-veil text-ink shadow-[inset_0_0_0_1px_var(--border-soft)]',
  ghost: 'bg-transparent text-ink',
  danger: 'bg-signal text-ink',
}

const BASE =
  'inline-flex items-center justify-center gap-2.5 rounded-pill font-medium tracking-[-0.01em] whitespace-nowrap cursor-pointer ' +
  'transition-[transform,background,opacity] duration-[var(--dur-fast)] ease-out ' +
  'enabled:active:scale-[var(--press-scale)] disabled:opacity-35 disabled:cursor-default ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

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

type IconVariant = 'veil' | 'ink' | 'chalk' | 'outline' | 'plain' | 'shade'

const ICON_VARIANTS: Record<IconVariant, string> = {
  veil: 'bg-veil text-ink',
  ink: 'bg-ink text-chalk',
  chalk: 'bg-chalk text-ink',
  outline: 'bg-transparent text-ink shadow-[inset_0_0_0_1px_var(--border-soft)]',
  plain: 'bg-transparent text-ink hover:bg-shade',
  shade: 'bg-shade text-ink',
}

const ICON_SIZES = { sm: ['w-8 h-8', 15], md: ['w-11 h-11', 18], lg: ['w-14 h-14', 22] } as const

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  label: string
  variant?: IconVariant
  size?: keyof typeof ICON_SIZES
  filled?: boolean
}

export function IconButton({ icon, label, variant = 'veil', size = 'md', filled = false, className, ...rest }: IconButtonProps) {
  const [box, iconSize] = ICON_SIZES[size]
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={
        `${box} ${ICON_VARIANTS[variant]} inline-flex shrink-0 items-center justify-center rounded-full cursor-pointer ` +
        'transition-[transform,background] duration-[var(--dur-fast)] ease-out enabled:active:scale-[.92] disabled:opacity-35 ' +
        `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className ?? ''}`
      }
      {...rest}
    >
      <Icon name={icon} size={iconSize} filled={filled} />
    </button>
  )
}
