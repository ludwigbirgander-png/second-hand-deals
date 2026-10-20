'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SiteConfig, SiteKind } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { SITE_COLORS } from '@/lib/colors'
import { Sheet, SheetSection } from './ui/Sheet'
import { Toggle } from './ui/Form'
import { Button } from './ui/Button'

interface EmailSettings {
  weekly_email: boolean
  alerts_enabled: boolean
}

const SITE_GROUPS: { kind: SiteKind; title: string; hint: string }[] = [
  { kind: 'marketplace', title: 'Marketplaces', hint: 'Choose which marketplaces to search for deals' },
  { kind: 'auction', title: 'Auction houses', hint: 'Prices are the current bid, or the starting price before anyone bids' },
]

export function SettingsSheet({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const router = useRouter()
  const [sites, setSites] = useState<SiteConfig[]>([])
  const [emails, setEmails] = useState<EmailSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/profile/sites')
      .then((r) => r.json())
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]))
    fetch('/api/profile/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setEmails(data))
      .catch(() => setEmails(null))
  }, [open])

  async function toggleEmail(key: keyof EmailSettings, value: boolean) {
    setError(null)
    setEmails((prev) => (prev ? { ...prev, [key]: value } : prev))
    const res = await fetch('/api/profile/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => null)
    if (!res?.ok) {
      setEmails((prev) => (prev ? { ...prev, [key]: !value } : prev))
      setError('Could not save — please try again')
    }
  }

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

      {emails && (
        <SheetSection title="Email">
          <div className="flex flex-col gap-4 mt-2">
            <Toggle
              checked={emails.weekly_email}
              onChange={(v) => toggleEmail('weekly_email', v)}
              label="Weekly email"
              description="Monday morning, with the week's new listings"
            />
            <Toggle
              checked={emails.alerts_enabled}
              onChange={(v) => toggleEmail('alerts_enabled', v)}
              label="Alerts"
              description="Right away for target prices, price drops on favourites, auctions ending soon and rare finds"
            />
          </div>
        </SheetSection>
      )}

      {SITE_GROUPS.map((g) => {
        const group = sites.filter((s) => (s.kind ?? 'marketplace') === g.kind)
        if (group.length === 0) return null
        return (
          <SheetSection key={g.kind} title={g.title}>
            <p className="m-0 mb-2 text-[13px] text-muted">{g.hint}</p>
            {group.map((s) => (
              <div key={s.id} className="flex items-center gap-3 h-[52px] border-b border-line-hair">
                <span className="w-[9px] h-[9px] rounded-full" style={{ background: SITE_COLORS[s.site_name] ?? 'var(--stone)' }} />
                <span className="flex-1 text-[16px] tracking-[-0.01em]">{s.site_name}</span>
                <Toggle checked={s.enabled} onChange={(v) => toggleSite(s.id, v)} ariaLabel={`Search ${s.site_name}`} />
              </div>
            ))}
          </SheetSection>
        )
      })}
      {error && <p role="alert" className="mt-3 text-[13px] text-signal-deep">{error}</p>}
      {sites.some((s) => s.unreliable) && (
        <p className="mt-3 mb-0 text-[12.5px] text-muted">
          <strong className="text-ink font-medium">Facebook Marketplace:</strong> Requires a logged-in browser session — results will always be empty.
        </p>
      )}
    </Sheet>
  )
}
