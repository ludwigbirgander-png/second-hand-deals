'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SiteConfig } from '@/lib/types'

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

export default function ProfilePage() {
  const [sites, setSites] = useState<SiteConfig[]>([])
  const [search, setSearch] = useState('')
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})

  useEffect(() => {
    fetch('/api/profile/sites')
      .then((r) => r.json())
      .then(setSites)
  }, [])

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
    setSites((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
    const site = sites.find((s) => s.id === id)
    if (site) saveSite(id, !site.enabled)
  }

  const filtered = sites.filter((s) =>
    s.site_name.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = sites.filter((s) => s.enabled).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Manage which sites to search for deals</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
              {/* Save feedback dot */}
              {state === 'saved' && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-500" />
              )}
              {state === 'saving' && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-zinc-300 animate-pulse" />
              )}

              <div className="flex items-start gap-3">
                {/* Logo avatar */}
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold ${meta.bg} ${meta.color}`}>
                  {initial}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{site.site_name}</p>
                    {/* Toggle */}
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
    </div>
  )
}
