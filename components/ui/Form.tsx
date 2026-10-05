'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string | null
  suffix?: string
  icon?: IconName
  /** sm 36, md 44, lg 52 */
  inputSize?: 'sm' | 'md' | 'lg'
  wrapperClassName?: string
}

const INPUT_H = { sm: 'h-9', md: 'h-11', lg: 'h-[52px]' }

/** Text field on chalk with a 1.5px ring that turns ink on focus. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, suffix, icon, inputSize = 'md', wrapperClassName, className, ...rest },
  ref,
) {
  const ring = error
    ? 'shadow-[inset_0_0_0_1.5px_var(--state-danger)]'
    : 'shadow-[inset_0_0_0_1.5px_var(--border-soft)] focus-within:shadow-[inset_0_0_0_1.5px_var(--ink)]'
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${wrapperClassName ?? ''}`}>
      {label && <span className="text-[13px] font-medium leading-[1.3] text-muted">{label}</span>}
      <span className={`flex items-center gap-2 px-3.5 rounded-md bg-chalk transition-shadow duration-[var(--dur-fast)] ease-out ${INPUT_H[inputSize]} ${ring}`}>
        {icon && <Icon name={icon} size={17} className="text-muted" />}
        <input
          ref={ref}
          className={`flex-1 min-w-0 h-full bg-transparent outline-none text-ink placeholder:text-faint ${inputSize === 'lg' ? 'text-[17px]' : 'text-[15px]'} ${className ?? ''}`}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {suffix && <span className="text-[14px] font-medium text-muted pointer-events-none">{suffix}</span>}
      </span>
      {(error || hint) && <span className={`text-[12px] font-medium ${error ? 'text-state-danger' : 'text-muted'}`}>{error || hint}</span>}
    </label>
  )
})

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[13px] font-medium leading-[1.3] text-muted mb-2">{children}</span>
}

// ─── Price range ──────────────────────────────────────────────────────────────

export function parsePrice(text: string) {
  return parseInt(text.replace(/\s/g, ''), 10) || 0
}

export function priceRangeError(min: string, max: string) {
  const lo = parsePrice(min)
  const hi = parsePrice(max)
  return lo && hi && hi < lo ? 'Max must be above min' : null
}

/** Min ("Any") and max ("No max") in kr; flags a max below the min. */
export function PriceRange({ min, max, onChange, label = 'Price range' }: {
  min: string
  max: string
  onChange: (v: { min: string; max: string }) => void
  label?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
      <span className="text-[13px] font-medium leading-[1.3] text-muted">{label}</span>
      <div className="flex items-start gap-2">
        <Input aria-label="Minimum price" value={min} placeholder="Any" suffix="kr" inputMode="numeric" wrapperClassName="flex-1" onChange={(e) => onChange({ min: e.target.value, max })} />
        <span className="leading-[44px] text-faint">–</span>
        <Input aria-label="Maximum price" value={max} placeholder="No max" suffix="kr" inputMode="numeric" error={priceRangeError(min, max)} wrapperClassName="flex-1" onChange={(e) => onChange({ min, max: e.target.value })} />
      </div>
    </div>
  )
}

// ─── Segmented ────────────────────────────────────────────────────────────────

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
  label?: string
}

/** Single-select pill group (sheet tabs, role pickers). Active option is ink. */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', className, label }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`flex flex-nowrap gap-0.5 p-[3px] rounded-pill bg-shade w-fit ${className ?? ''}`}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={
              `k-press ${size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-[14px]'} rounded-pill font-medium whitespace-nowrap cursor-pointer ` +
              `transition-colors duration-[var(--dur-base)] ease-out ${on ? 'bg-ink text-chalk' : 'bg-transparent text-ink'}`
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  ariaLabel?: string
}

/** On/off switch: ink track with a lime knob when on. With a label it renders a settings row. */
export function Toggle({ checked, onChange, label, description, disabled, ariaLabel }: ToggleProps) {
  const sw = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'k-press relative w-11 h-[26px] rounded-pill shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-default ' +
        `transition-colors duration-[var(--dur-base)] ease-out ${checked ? 'bg-ink' : 'bg-paper-3'}`
      }
    >
      <span
        className="absolute top-[3px] w-5 h-5 rounded-full transition-[left,background-color] duration-[var(--dur-slow)] ease-spring"
        style={{ left: checked ? 21 : 3, background: checked ? 'var(--lime)' : 'var(--chalk)' }}
      />
    </button>
  )
  if (!label) return sw
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      {sw}
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[15px] font-medium leading-[1.2] text-ink">{label}</span>
        {description && <span className="text-[13px] leading-[1.3] text-muted">{description}</span>}
      </span>
    </label>
  )
}
