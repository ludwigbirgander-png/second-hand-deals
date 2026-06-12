'use client'

import { useEffect, useState } from 'react'

interface Props {
  itemId: string
  label?: string
  onComplete: () => void
}

type SiteStatus = 'pending' | 'scraping' | 'done'

export function ScrapeProgress({ itemId, label, onComplete }: Props) {
  const [siteList, setSiteList] = useState<string[]>([])
  const [siteStatuses, setSiteStatuses] = useState<Record<string, SiteStatus>>({})
  const [siteCounts, setSiteCounts] = useState<Record<string, number>>({})
  const [totalFound, setTotalFound] = useState<number | null>(null)
  const [pruned, setPruned] = useState(0)

  useEffect(() => {
    let cancelled = false

    function handleLine(line: string) {
      try {
        const event = JSON.parse(line)
        if (event.type === 'sites') {
          setSiteList(event.sites)
          setSiteStatuses(Object.fromEntries(event.sites.map((s: string) => [s, 'pending' as SiteStatus])))
        }
        if (event.type === 'start') {
          setSiteStatuses((p) => ({ ...p, [event.site]: 'scraping' }))
        }
        if (event.type === 'done') {
          setSiteStatuses((p) => ({ ...p, [event.site]: 'done' }))
          setSiteCounts((p) => ({ ...p, [event.site]: event.count }))
        }
        if (event.type === 'complete') {
          setTotalFound(event.total)
          setPruned(event.pruned ?? 0)
        }
      } catch {
        // malformed line — skip
      }
    }

    async function run() {
      const res = await fetch(`/api/scrape/${itemId}/stream`, { method: 'POST' })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      // Buffer across chunks: an NDJSON line can be split between reads
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done || cancelled) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trim()) handleLine(line)
        }
      }
      if (!cancelled && buffer.trim()) handleLine(buffer)

      if (!cancelled) {
        await new Promise((r) => setTimeout(r, 900))
        onComplete()
      }
    }

    run()
    return () => { cancelled = true }
  }, [itemId, onComplete])

  const doneCount = Object.values(siteStatuses).filter((s) => s === 'done').length
  const progress = siteList.length > 0 ? (doneCount / siteList.length) * 100 : 0

  return (
    <div className="space-y-4">
      {label && <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>}

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Site checklist */}
      <div className="space-y-2">
        {siteList.map((site) => {
          const status = siteStatuses[site] ?? 'pending'
          const count = siteCounts[site]
          return (
            <div key={site} className="flex items-center gap-3">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                {status === 'done' ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : status === 'scraping' ? (
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-700 dark:border-t-zinc-300 animate-spin" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                )}
              </div>
              <span className={`flex-1 text-sm ${status === 'scraping' ? 'font-medium text-zinc-900 dark:text-zinc-50' : status === 'done' ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {site}
              </span>
              {status === 'done' && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${count > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                  {count > 0 ? `${count} found` : 'none'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {totalFound !== null && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 pt-1">
          {totalFound > 0
            ? <><strong className="text-zinc-900 dark:text-zinc-100">{totalFound}</strong> new listings found</>
            : 'No new listings found'}
          {pruned > 0 && (
            <span className="text-zinc-500 dark:text-zinc-400"> · {pruned} unavailable listing{pruned !== 1 ? 's' : ''} removed</span>
          )}
        </p>
      )}
    </div>
  )
}
