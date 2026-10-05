import type { ReactNode } from 'react'
import { ScreenBackground } from './ScreenBackground'
import { Logo } from './brand/Logo'

/** Centered paper screen with the Kompi wordmark, used by sign-in, sign-up and invites. */
export function AuthShell({ subtitle, children }: { subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <ScreenBackground color="var(--paper)" />
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="m-0"><Logo size={44} /></h1>
          {subtitle && <p className="mt-3 mb-0 text-[17px] text-muted tracking-[-0.01em]">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
