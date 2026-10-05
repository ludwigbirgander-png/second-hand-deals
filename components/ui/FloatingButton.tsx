'use client'

import { forwardRef } from 'react'
import { Icon, type IconName } from './Icon'

interface Props {
  label: string
  icon?: IconName
  onClick: () => void
  /** Desktop-only hint to the right of the button, e.g. "or press /" */
  hint?: string
  /** Hidden (but kept mounted, for focus return) while its panel is open */
  hidden?: boolean
}

/**
 * The one floating action: "+ Add item" on the watchlist, "Edit item" on an item page.
 * Pink pill with an ink disc. Centred at the bottom on desktop, bottom-right on mobile.
 */
export const FloatingButton = forwardRef<HTMLButtonElement, Props>(function FloatingButton({ label, icon = 'plus', onClick, hint, hidden = false }, ref) {
  return (
    <div
      className={
        'fixed z-30 bottom-7 flex items-center gap-2.5 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 ' +
        `transition-[opacity,scale] duration-[var(--dur-base)] ease-out ${hidden ? 'opacity-0 scale-90 pointer-events-none' : ''}`
      }
    >
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
        className="k-press inline-flex items-center gap-2 h-[52px] pl-[18px] pr-[22px] rounded-pill bg-add text-ink font-semibold text-[16px] leading-none tracking-[-0.01em] whitespace-nowrap shadow-float cursor-pointer"
      >
        <span className="w-[26px] h-[26px] rounded-full bg-ink text-chalk inline-flex items-center justify-center">
          <Icon name={icon} size={15} strokeWidth={2.4} />
        </span>
        {label}
      </button>
      {hint && <span className="max-md:hidden text-[13px] font-medium text-muted">{hint}</span>}
    </div>
  )
})
