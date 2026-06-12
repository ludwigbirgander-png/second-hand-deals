'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SiteConfig } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useTheme, type Theme } from '@/components/ThemeProvider'

// ─── Theme icons ──────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

const THEME_OPTIONS: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: 'light',  icon: <SunIcon />,     label: 'Light'  },
  { value: 'system', icon: <MonitorIcon />, label: 'System' },
  { value: 'dark',   icon: <MoonIcon />,    label: 'Dark'   },
]

// ─── Sites data ───────────────────────────────────────────────────────────────

const SITE_META: Record<string, { color: string; bg: string; description: string; category: string }> = {
  Blocket: {
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    description: "Sweden's largest classifieds marketplace for second-hand goods.",
    category: 'Classifieds',
  },
  Tradera: {
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    description: 'Swedish auction and buy-now marketplace owned by eBay.',
    category: 'Auctions',
  },
  Vinted: {
    color: 'text-teal-700',
    bg: 'bg-teal-100',
    description: 'European peer-to-peer marketplace focused on clothing and accessories.',
    category: 'Fashion',
  },
  Sellpy: {
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    description: 'Curated second-hand marketplace for fashion and household items.',
    category: 'Fashion',
  },
  'Facebook Marketplace': {
    color: 'text-zinc-600',
    bg: 'bg-zinc-100',
    description: 'Local and national listings across all categories.',
    category: 'Classifieds',
  },
}

const DEFAULT_META = { color: 'text-zinc-600', bg: 'bg-zinc-100', description: '', category: 'Other' }

type SaveState = 'idle' | 'saving' | 'saved'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const [email, setEmail] = useState('')
  const [sites, setSites] = useState<SiteConfig[]>([])
  const [search, setSearch] = useState('')
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
    })
    fetch('/api/profile/sites')
      .then((r) => r.json())
      .then((data) => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]))
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const saveSite = useCallback(async (id: string, enabled: boolean) => {
    setSaveStates((prev) => ({ ...prev, [id]: 'saving' }))
    await fetch('/api/profile/sites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sites: [{ id, enabled }] }),
    })
    setSaveStates((prev) => ({ ...prev, [id]: 'saved' }))
    setTimeout(() => setSaveStates((prev) => ({ ...prev, [id]: 'idle' })), 1500)
  }, [])

  function toggle(id: string) {
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)))
    const site = sites.find((s) => s.id === id)
    if (site) saveSite(id, !site.enabled)
  }

  const filtered = sites.filter((s) =>
    s.site_name.toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = sites.filter((s) => s.enabled).length

  const sectionHeading = 'text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500'
  const divider = 'border-t border-zinc-100 dark:border-zinc-800 pt-8'

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* ── Account ─────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <h2 className={sectionHeading}>Account</h2>

        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Email</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{email || '—'}</p>
        </div>

        <button
          onClick={signOut}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </section>

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <section className={`space-y-5 ${divider}`}>
        <h2 className={sectionHeading}>Appearance</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Theme</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Choose your preferred color scheme</p>
          </div>
          <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 gap-0.5">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                title={opt.label}
                aria-label={`${opt.label} mode`}
                className={`p-1.5 rounded-md transition-colors ${
                  theme === opt.value
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {opt.icon}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sites ───────────────────────────────────────────────────────── */}
      <section className={`space-y-5 ${divider}`}>
        <div>
          <h2 className={sectionHeading}>Sites</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Choose which marketplaces to search for deals</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sites…"
              className="w-full pl-8 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-700 bg-white dark:bg-zinc-800"
            />
          </div>
          <span className="text-sm text-zinc-400 dark:text-zinc-500 shrink-0">
            {activeCount} of {sites.length} active
          </span>
        </div>

        {filtered.length === 0 && search && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">No sites match &ldquo;{search}&rdquo;</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((site) => {
            const meta = SITE_META[site.site_name] ?? DEFAULT_META
            const initial = site.site_name.charAt(0).toUpperCase()
            const state = saveStates[site.id] ?? 'idle'

            return (
              <div
                key={site.id}
                onClick={() => toggle(site.id)}
                className={`relative cursor-pointer rounded-xl border p-4 transition-all select-none ${
                  site.enabled
                    ? 'border-zinc-900 dark:border-zinc-300 bg-white dark:bg-zinc-800 shadow-sm'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 opacity-60'
                }`}
              >
                {state === 'saved' && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-500" />
                )}
                {state === 'saving' && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-zinc-300 animate-pulse" />
                )}

                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold ${meta.bg} ${meta.color}`}>
                    {initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{site.site_name}</p>
                      <div
                        className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          site.enabled ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            site.enabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{site.base_url.replace('https://', '')}</p>

                    {meta.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed line-clamp-2">
                        {meta.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        {meta.category}
                      </span>
                      {site.unreliable && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          Limited support
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {sites.some((s) => s.unreliable) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 text-sm text-amber-800 dark:text-amber-300">
            <p><strong>Facebook Marketplace:</strong> Requires a logged-in browser session — results will always be empty.</p>
          </div>
        )}
      </section>
    </div>
  )
}
