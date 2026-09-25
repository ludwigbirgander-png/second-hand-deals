'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * Bottom sheet on mobile, right-side drawer from md up. The only shadowed surface.
 * Escape and the backdrop close it.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Mount as soon as it opens (render-phase update); unmount after the exit transition
  if (open && !mounted) setMounted(true)
  const shown = open && entered

  useEffect(() => {
    if (open) {
      let inner = 0
      const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setEntered(true)) })
      return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner) }
    }
    const t = setTimeout(() => { setMounted(false); setEntered(false) }, 420)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  // Move focus into the dialog once it is on screen
  useEffect(() => { if (shown) panelRef.current?.focus() }, [shown])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:flex-row">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(11,11,10,.34)] transition-opacity duration-[var(--dur-base)] ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={
          'relative bg-chalk overflow-y-auto box-border outline-none transition-transform duration-[var(--dur-slow)] ease-out ' +
          // mobile: bottom sheet
          'max-md:rounded-t-xl max-md:px-5 max-md:pt-2.5 max-md:pb-8 max-md:max-h-[86dvh] max-md:shadow-sheet ' +
          // md+: right drawer
          'md:ml-auto md:h-full md:w-[min(440px,100%)] md:rounded-l-xl md:px-7 md:pt-7 md:pb-8 md:shadow-drawer ' +
          (shown ? 'translate-x-0 translate-y-0' : 'max-md:translate-y-full md:translate-x-full')
        }
      >
        <div className="md:hidden w-10 h-[5px] rounded-pill bg-shade mx-auto mb-[18px]" />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="max-md:hidden absolute top-[22px] right-[22px] w-11 h-11 rounded-full bg-shade text-ink flex items-center justify-center cursor-pointer"
        >
          <Icon name="x" size={16} strokeWidth={1.5} />
        </button>
        {title && (
          <h2 className="m-0 mb-4 text-[28px] md:mt-1.5 md:mr-14 md:mb-5 md:text-[36px] font-normal tracking-[-0.03em] leading-[1.05]">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mt-[22px] mb-1 text-[13px] font-medium text-muted">{title}</h3>
      {children}
    </section>
  )
}
