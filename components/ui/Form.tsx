'use client'

import type { InputHTMLAttributes, ReactNode } from 'react'

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string | null
  suffix?: string
  wrapperClassName?: string
}

export function Input({ label, hint, error, suffix, wrapperClassName, className, ...rest }: InputProps) {
  const ring = error
    ? 'shadow-[inset_0_0_0_1px_var(--signal)] focus:shadow-[inset_0_0_0_1.5px_var(--signal)]'
    : 'shadow-[inset_0_0_0_1px_var(--border-soft)] focus:shadow-[inset_0_0_0_1.5px_var(--ink)]'
  return (
    <label className={`flex flex-col gap-1.5 ${wrapperClassName ?? ''}`}>
      {label && <span className="text-[13px] text-muted">{label}</span>}
      <span className="relative flex items-center">
        <input
          className={
            `w-full h-12 pl-4 ${suffix ? 'pr-10' : 'pr-4'} text-[15px] tracking-[-0.005em] text-ink bg-chalk rounded-sm outline-none ` +
            `placeholder:text-faint transition-shadow duration-[var(--dur-fast)] ${ring} ${className ?? ''}`
          }
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {suffix && <span className="absolute right-4 text-[13px] text-muted pointer-events-none">{suffix}</span>}
      </span>
      {(error || hint) && <span className={`text-[12.5px] ${error ? 'text-signal-deep' : 'text-muted'}`}>{error || hint}</span>}
    </label>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[13px] text-muted mb-2">{children}</span>
}

// ─── Segmented ────────────────────────────────────────────────────────────────

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  variant?: 'track' | 'chips'
  size?: 'sm' | 'md'
  className?: string
  label?: string
}

/** Single-select pill group: view switcher (track) or sort chips (chips). Active option is always ink. */
export function Segmented<T extends string>({ options, value, onChange, variant = 'track', size = 'md', className, label }: SegmentedProps<T>) {
  const track = variant === 'track'
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex rounded-pill ${track ? 'flex-nowrap gap-0.5 p-[3px] bg-shade w-fit' : 'flex-wrap gap-1.5'} ${className ?? ''}`}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={
              `${size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-[38px] px-4 text-[14px]'} rounded-pill font-medium tracking-[-0.01em] whitespace-nowrap cursor-pointer ` +
              `transition-colors duration-[var(--dur-base)] ease-out ${on ? 'bg-ink text-chalk' : track ? 'bg-transparent text-ink' : 'bg-shade text-ink'}`
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── TagToggle ────────────────────────────────────────────────────────────────

/** List/category chip: dashed with a color dot when off, filled color + ink ring when on. */
export function TagToggle({ label, color, selected, onClick }: { label: string; color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        'inline-flex items-center gap-[7px] h-[34px] px-3.5 rounded-pill text-[13.5px] font-medium tracking-[-0.01em] text-ink cursor-pointer box-border ' +
        `transition-colors duration-[var(--dur-base)] ease-out ${selected ? 'border-[1.5px] border-ink' : 'border border-dashed border-line-dashed bg-transparent'}`
      }
      style={selected ? { background: color } : undefined}
    >
      {!selected && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
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

/** On/off switch; ink when on. With a label it renders a settings row. */
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
        'relative w-[46px] h-7 rounded-pill shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-default ' +
        `transition-colors duration-[var(--dur-base)] ease-out ${checked ? 'bg-ink' : 'bg-shade shadow-[inset_0_0_0_1px_var(--border-hair)]'}`
      }
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-chalk shadow-[0_1px_3px_rgba(0,0,0,.18)] transition-transform duration-[var(--dur-base)] ease-spring ${checked ? 'translate-x-[18px]' : ''}`}
      />
    </button>
  )
  if (!label) return sw
  return (
    <label className="flex items-center gap-4">
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] tracking-[-0.01em] text-ink">{label}</span>
        {description && <span className="block text-[13px] text-muted mt-0.5">{description}</span>}
      </span>
      {sw}
    </label>
  )
}
