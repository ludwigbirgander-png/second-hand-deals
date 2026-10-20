'use client'

import { useEffect, useState } from 'react'
import type { Listing } from '@/lib/types'
import { isEnded } from '@/lib/auction'
import { suggestExcludeWords } from '@/lib/search/match'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { ListingCard } from './ui/Cards'
import { Chip } from './ui/Chip'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { SiteBadge } from './ui/Pill'
import { formatSEK } from './ui/Price'

type SortKey = 'price-asc' | 'price-desc' | 'date-desc' | 'date-asc' | 'ending' | 'platform'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'ending', label: 'Ending soon' },
  { value: 'platform', label: 'Platform' },
]

function sortListings(listings: Listing[], key: SortKey): Listing[] {
  const arr = [...listings]
  const byPrice = (dir: 1 | -1) => (a: Listing, b: Listing) => {
    if (a.price == null) return 1
    if (b.price == null) return -1
    return (a.price - b.price) * dir
  }
  switch (key) {
    case 'price-asc': return arr.sort(byPrice(1))
    case 'price-desc': return arr.sort(byPrice(-1))
    case 'date-desc': return arr.sort((a, b) => new Date(b.found_at).getTime() - new Date(a.found_at).getTime())
    case 'date-asc': return arr.sort((a, b) => new Date(a.found_at).getTime() - new Date(b.found_at).getTime())
    // Auctions by end time; fixed-price listings after them
    case 'ending': return arr.sort((a, b) => endTime(a) - endTime(b))
    case 'platform': return arr.sort((a, b) => a.site.localeCompare(b.site))
  }
}

const endTime = (l: Listing) => (l.auction_ends_at ? new Date(l.auction_ends_at).getTime() : Infinity)

type Toast =
  | { kind: 'removed'; listing: Listing; suggestions: string[] }
  | { kind: 'word'; word: string; count: number }
  | { kind: 'error'; text: string }

interface Props {
  itemId: string
  /** Brand + name, used to suggest words to hide */
  query: string
  /** Every listing for the item, removed and possible ones included */
  listings: Listing[]
  onListingsChange: (update: (prev: Listing[]) => Listing[]) => void
  excludeWords: string[]
  onExcludeWordsChange: (words: string[]) => void
  /** The item's last visit; listings found after it get a "New" badge */
  newSince?: string | null
}

const patchListing = (id: string, body: object) =>
  fetch(`/api/listings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.ok)
    .catch(() => false)

const wordRequest = (itemId: string, method: 'POST' | 'DELETE', word: string) =>
  fetch(`/api/items/${itemId}/exclude-words`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word }) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)

/**
 * The item's listings: real matches (favourites first), then "Possible matches",
 * then removed listings and hidden words. Ended auctions are hidden unless favourited.
 */
export function ListingGrid({ itemId, query, listings, onListingsChange, excludeWords, onExcludeWordsChange, newSince }: Props) {
  const desktop = useMediaQuery(DESKTOP)
  // Whole rows: 5 columns on desktop, 2 on mobile
  const pageSize = desktop ? 15 : 6
  const [sortKey, setSortKey] = useState<SortKey>('price-asc')
  const [pages, setPages] = useState(1)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [showPossible, setShowPossible] = useState<boolean | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  // Fixed when the grid mounts; the page remounts it whenever the listings are reloaded
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.kind === 'removed' && toast.suggestions.length ? 10000 : 6000)
    return () => clearTimeout(t)
  }, [toast])

  const setFields = (ids: string[], fields: Partial<Listing>) =>
    onListingsChange((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, ...fields } : l)))

  async function toggleStar(l: Listing) {
    setFields([l.id], { starred: !l.starred })
    if (!(await patchListing(l.id, { starred: !l.starred }))) setFields([l.id], { starred: l.starred })
  }

  async function remove(l: Listing) {
    setFields([l.id], { removed_at: new Date().toISOString(), removed_word: null, starred: false })
    setToast({ kind: 'removed', listing: l, suggestions: suggestExcludeWords(l.title, query) })
    if (!(await patchListing(l.id, { removed: true }))) {
      setFields([l.id], { removed_at: null, starred: l.starred })
      setToast({ kind: 'error', text: 'Couldn’t remove the listing. Try again.' })
    }
  }

  async function restore(l: Listing) {
    setFields([l.id], { removed_at: null, removed_word: null, starred: l.starred })
    setToast(null)
    if (!(await patchListing(l.id, { removed: false, starred: l.starred }))) {
      setFields([l.id], { removed_at: l.removed_at ?? new Date().toISOString(), removed_word: l.removed_word })
      setToast({ kind: 'error', text: 'Couldn’t restore the listing. Try again.' })
    }
  }

  async function hideWord(word: string) {
    setToast(null)
    const res = await wordRequest(itemId, 'POST', word)
    if (!res) return setToast({ kind: 'error', text: `Couldn’t hide “${word}”. Try again.` })
    setFields(res.hidden, { removed_at: res.removed_at, removed_word: word })
    onExcludeWordsChange(res.exclude_words)
    setToast({ kind: 'word', word, count: res.hidden.length })
  }

  async function unhideWord(word: string) {
    setToast(null)
    const res = await wordRequest(itemId, 'DELETE', word)
    if (!res) return setToast({ kind: 'error', text: `Couldn’t show “${word}” again. Try again.` })
    setFields(res.restored, { removed_at: null, removed_word: null })
    onExcludeWordsChange(res.exclude_words)
  }

  const since = newSince ? new Date(newSince).getTime() : null
  const isNew = (l: Listing) => since != null && new Date(l.found_at).getTime() > since

  const active = listings.filter((l) => !l.removed_at)
  const current = active.filter((l) => l.starred || !isEnded(l, now))
  const matches = current.filter((l) => l.match !== 'possible')
  const possible = current.filter((l) => l.match === 'possible')
  const removed = listings.filter((l) => l.removed_at)
  const hasFavorites = active.some((l) => l.starred)
  const favoritesView = favoritesOnly && hasFavorites
  const main = favoritesView ? active.filter((l) => l.starred) : matches
  const newCount = matches.filter(isNew).length
  const possibleOpen = showPossible ?? matches.length === 0
  const sortOptions = current.some((l) => l.auction_ends_at) ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.value !== 'ending')

  const sorted = sortListings(main, sortKey)
  const ordered = [...sorted.filter((l) => l.starred), ...sorted.filter((l) => !l.starred)]
  const visible = pages * pageSize
  const card = (l: Listing) => (
    <ListingCard key={l.id} listing={l} isNew={isNew(l)} starred={l.starred} onStar={() => toggleStar(l)} onRemove={() => remove(l)} />
  )
  const grid = 'grid grid-cols-2 gap-x-2.5 gap-y-3.5 md:grid-cols-5 md:gap-x-3.5 md:gap-y-4'

  return (
    <>
      <div className="flex flex-col items-start gap-3.5 mb-3.5 md:mb-5">
        <div className="flex items-center gap-2.5 mx-1 md:mx-0">
          <h2 className="m-0 text-[20px] md:text-[26px] font-bold tracking-[-0.02em] leading-[1.1]">
            {favoritesView
              ? `${main.length} favorite${main.length !== 1 ? 's' : ''}`
              : `${matches.length} listing${matches.length !== 1 ? 's' : ''} found`}
          </h2>
          {!favoritesView && newCount > 0 && <Badge>{newCount} new</Badge>}
        </div>
        {main.length > 0 && (
          <div role="group" aria-label="Filter and sort listings" className="flex gap-2 w-[calc(100%_+_32px)] -mx-4 px-4 md:w-auto md:mx-0 md:px-0 md:flex-wrap overflow-x-auto k-noscroll">
            {hasFavorites && (
              <>
                <Chip size="sm" label="★ Favorites" active={favoritesView} onClick={() => { setFavoritesOnly((v) => !v); setPages(1) }} />
                <span aria-hidden="true" className="w-px self-stretch my-1 bg-line-soft shrink-0" />
              </>
            )}
            {sortOptions.map((o) => (
              <Chip key={o.value} size="sm" label={o.label} active={sortKey === o.value} onClick={() => { setSortKey(o.value); setPages(1) }} />
            ))}
          </div>
        )}
      </div>

      {main.length === 0 ? (
        <div className="text-center py-10 md:py-16 px-4">
          <p className="m-0 text-[15px] md:text-[18px]">Nothing yet — the flea market restocks daily.</p>
          <p className="mt-1.5 md:mt-2 mb-0 text-[14px] md:text-[15px] text-muted">
            Try hitting Refresh, widening the price range, or a shorter item name.
          </p>
        </div>
      ) : (
        <>
          <div className={grid}>{ordered.slice(0, visible).map(card)}</div>
          {visible < ordered.length && (
            <Button variant="secondary" block className="mt-3 md:mt-4" onClick={() => setPages((p) => p + 1)}>
              Load more ({ordered.length - visible} remaining)
            </Button>
          )}
        </>
      )}

      {!favoritesView && possible.length > 0 && (
        <section className="mt-10 md:mt-14">
          <button
            type="button"
            aria-expanded={possibleOpen}
            onClick={() => setShowPossible(!possibleOpen)}
            className="k-press flex items-center gap-2 mx-1 md:mx-0 bg-transparent border-0 p-0 cursor-pointer text-ink"
          >
            <h3 className="m-0 text-[18px] md:text-[22px] font-bold tracking-[-0.02em]">Possible matches</h3>
            <Badge variant="soft">{possible.length}</Badge>
            <Icon name="chevron-down" size={18} strokeWidth={2} className={`transition-transform ${possibleOpen ? 'rotate-180' : ''}`} />
          </button>
          <p className="mt-1 mb-3.5 mx-1 md:mx-0 text-[14px] text-muted">Close to your search: a small typo, or one of the words is missing.</p>
          {possibleOpen && <div className={grid}>{sortListings(possible, sortKey).map(card)}</div>}
        </section>
      )}

      {(removed.length > 0 || excludeWords.length > 0) && (
        <section className="mt-10 md:mt-14 pt-5 border-t border-line-hair">
          {excludeWords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 mx-1 md:mx-0">
              <span className="text-[14px] text-muted mr-1">Hidden words</span>
              {excludeWords.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => unhideWord(w)}
                  aria-label={`Stop hiding “${w}”`}
                  className="k-press inline-flex items-center gap-1.5 h-[30px] px-3 rounded-pill bg-chalk text-ink text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--border-hair)] cursor-pointer"
                >
                  {w}
                  <Icon name="x" size={12} strokeWidth={2} />
                </button>
              ))}
            </div>
          )}
          {removed.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={showRemoved}
                onClick={() => setShowRemoved((v) => !v)}
                className="k-press mx-1 md:mx-0 bg-transparent border-0 p-0 cursor-pointer text-[14px] font-medium text-muted underline underline-offset-2"
              >
                {showRemoved ? 'Hide removed' : `Show removed (${removed.length})`}
              </button>
              {showRemoved && (
                <ul className="list-none m-0 mt-3 p-0">
                  {removed.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 py-2.5 border-b border-line-hair">
                      <span className="w-12 h-12 shrink-0 rounded-md bg-paper-2 overflow-hidden">
                        {l.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.image_url} alt="" className="w-full h-full object-cover opacity-70" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="block text-[14px] text-ink-2 truncate no-underline hover:underline">{l.title}</a>
                        <SiteBadge site={l.site} meta={[l.price != null ? formatSEK(l.price) : null, l.removed_word ? `hidden by “${l.removed_word}”` : null].filter(Boolean).join(' · ')} />
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => restore(l)}>Restore</Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {toast && (
        <div
          role="status"
          className="fixed z-40 bottom-28 left-1/2 -translate-x-1/2 w-[min(440px,calc(100%_-_32px))] px-4 py-3 rounded-lg bg-ink text-chalk shadow-float k-rise"
        >
          {toast.kind === 'error' && <p className="m-0 text-[14px]">{toast.text}</p>}
          {toast.kind === 'word' && (
            <div className="flex items-center gap-3">
              <p className="m-0 flex-1 text-[14px]">
                Hiding “{toast.word}”{toast.count > 0 ? ` · ${toast.count} listing${toast.count !== 1 ? 's' : ''} removed` : ''}
              </p>
              <button type="button" onClick={() => unhideWord(toast.word)} className="bg-transparent border-0 p-0 text-chalk text-[14px] font-semibold underline cursor-pointer">Undo</button>
            </div>
          )}
          {toast.kind === 'removed' && (
            <>
              <div className="flex items-center gap-3">
                <p className="m-0 flex-1 text-[14px]">Listing removed</p>
                <button type="button" onClick={() => restore(toast.listing)} className="bg-transparent border-0 p-0 text-chalk text-[14px] font-semibold underline cursor-pointer">Undo</button>
              </div>
              {toast.suggestions.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-[rgba(255,253,248,0.16)]">
                  <p className="m-0 mb-2 text-[13px] text-[rgba(255,253,248,0.72)]">Also hide future listings with:</p>
                  <div className="flex flex-wrap gap-2">
                    {toast.suggestions.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => hideWord(w)}
                        className="k-press h-[30px] px-3 rounded-pill bg-[rgba(255,253,248,0.14)] text-chalk text-[13px] font-medium border-0 cursor-pointer"
                      >
                        “{w}”
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
