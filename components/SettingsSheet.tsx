'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SiteConfig } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { SITE_COLORS } from '@/lib/colors'
import { Sheet, SheetSection } from './ui/Sheet'
import { Toggle } from './ui/Form'
import { Button } from './ui/Button'

export function SettingsSheet({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const router = useRouter()
  const [sites, setSites] = useState<SiteConfig[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/profile/sites')
      .then((r) => r.json())
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]))
  }, [open])

  async function toggleSite(id: string, enabled: boolean) {
    setError(null)
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)))
    const res = await fetch('/api/profile/sites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sites: [{ id, enabled }] }),
    }).catch(() => null)
    if (!res?.ok) {
      setSites((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s)))
      setError('Could not save — please try again')
    }
  }

  async function signOut() {
    await createClient().auth.signOut()
    onClose()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <SheetSection title="Account">
        <div className="text-[13px] text-muted mt-2">Email</div>
        <div className="text-[16px] mt-0.5 break-all">{email || '—'}</div>
        <Button variant="secondary" size="sm" className="mt-4" onClick={signOut}>Sign out</Button>
      </SheetSection>

      <SheetSection title="Sites">
        <p className="m-0 mb-2 text-[13px] text-muted">Choose which marketplaces to search for deals</p>
        {sites.map((s) => (
          <div key={s.id} className="flex items-center gap-3 h-[52px] border-b border-line-hair">
            <span className="w-[9px] h-[9px] rounded-full" style={{ background: SITE_COLORS[s.site_name] ?? 'var(--stone)' }} />
            <span className="flex-1 text-[16px] tracking-[-0.01em]">{s.site_name}</span>
            <Toggle checked={s.enabled} onChange={(v) => toggleSite(s.id, v)} ariaLabel={`Search ${s.site_name}`} />
          </div>
        ))}
        {error && <p role="alert" className="mt-3 text-[13px] text-signal-deep">{error}</p>}
        {sites.some((s) => s.unreliable) && (
          <p className="mt-3 mb-0 text-[12.5px] text-muted">
            <strong className="text-ink font-medium">Facebook Marketplace:</strong> Requires a logged-in browser session — results will always be empty.
          </p>
        )}
      </SheetSection>
    </Sheet>
  )
}
