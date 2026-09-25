'use client'

import { useEffect, useState } from 'react'
import { Icon } from './ui/Icon'
import { Pill } from './ui/Pill'

export type SiteStatus = 'pending' | 'scraping' | 'done'

export interface ScrapeState {
  sites: { name: string; status: SiteStatus; count?: number }[]
  total: number | null
  pruned: number
  finished: boolean
  error: string | null
}

const INITIAL: ScrapeState = { sites: [], total: null, pruned: 0, finished: false, error: null }

/**
 * Runs the NDJSON scrape stream for an item and exposes live per-site progress.
 * Change `attempt` to run it again.
 */
export function useScrapeStream(itemId: string, attempt = 0): ScrapeState {
  const runKey = `${itemId}:${attempt}`
  // State is tagged with the run it belongs to, so a new run starts from INITIAL
  const [tagged, setTagged] = useState<{ key: string; state: ScrapeState }>({ key: runKey, state: INITIAL })

  useEffect(() => {
    let cancelled = false
    const setState = (update: (s: ScrapeState) => ScrapeState) =>
      setTagged((t) => ({ key: runKey, state: update(t.key === runKey ? t.state : INITIAL) }))

    const setSite = (name: string, patch: Partial<ScrapeState['sites'][number]>) =>
      setState((s) => ({ ...s, sites: s.sites.map((x) => (x.name === name ? { ...x, ...patch } : x)) }))

    function handleLine(line: string) {
      try {
        const event = JSON.parse(line)
        if (event.type === 'sites') setState((s) => ({ ...s, sites: event.sites.map((name: string) => ({ name, status: 'pending' as SiteStatus })) }))
        if (event.type === 'start') setSite(event.site, { status: 'scraping' })
        if (event.type === 'done') setSite(event.site, { status: 'done', count: event.count })
        if (event.type === 'complete') setState((s) => ({ ...s, total: event.total, pruned: event.pruned ?? 0 }))
      } catch {
        // malformed line — skip
      }
    }

    async function run() {
      try {
        const res = await fetch(`/api/scrape/${itemId}/stream`, { method: 'POST' })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        // Buffer across chunks: an NDJSON line can be split between reads
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done || cancelled) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) if (line.trim()) handleLine(line)
        }
        if (!cancelled && buffer.trim()) handleLine(buffer)
        if (!cancelled) setState((s) => ({ ...s, finished: true }))
      } catch {
        if (!cancelled) setState((s) => ({ ...s, error: 'The search could not finish.' }))
      }
    }

    run()
    return () => { cancelled = true }
  }, [itemId, runKey])

  return tagged.key === runKey ? tagged.state : INITIAL
}

function StatusIcon({ status }: { status: SiteStatus }) {
  if (status === 'done') return <Icon name="check" size={18} strokeWidth={2.4} />
  if (status === 'scraping') return <span className="w-4 h-4 rounded-full border-2 border-shade border-t-ink animate-k-spin box-border" />
  return <span className="w-2 h-2 rounded-full bg-line-dashed" />
}

/** Per-site search checklist: dot → spinner → check, with an ink "N found" pill. */
export function ScrapeProgress({ state }: { state: ScrapeState }) {
  return (
    <div aria-live="polite">
      {state.sites.map((s) => (
        <div key={s.name} className="flex items-center gap-3.5 h-[52px] border-b border-line-hair">
          <span className="w-5 flex justify-center"><StatusIcon status={s.status} /></span>
          <span className={`flex-1 text-[18px] tracking-[-0.015em] ${s.status === 'pending' ? 'text-muted' : 'text-ink'} ${s.status === 'scraping' ? 'font-medium' : ''}`}>
            {s.name}
          </span>
          {s.status === 'done' && ((s.count ?? 0) > 0 ? <Pill variant="ink" size="sm">{s.count} found</Pill> : <Pill variant="dashed" size="sm">none</Pill>)}
        </div>
      ))}
      {state.total != null && (
        <p className="mt-3.5 mb-0 text-[14px] text-muted">
          {state.total > 0 ? <><strong className="text-ink font-semibold">{state.total}</strong> new listings found</> : 'No new listings found'}
          {state.pruned > 0 && <span> · {state.pruned} unavailable listing{state.pruned !== 1 ? 's' : ''} removed</span>}
        </p>
      )}
    </div>
  )
}
