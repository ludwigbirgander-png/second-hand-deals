'use client'

import Link from 'next/link'
import type { ItemWithMeta } from '@/lib/types'
import { themeFor, themeOf } from '@/lib/colors'
import { StackCard } from './ui/Cards'
import { Thumb } from './ui/Thumb'
import { Pill } from './ui/Pill'
import { Price } from './ui/Price'
import { AvatarStack } from './ui/Avatar'
import { IconButton, buttonClass } from './ui/Button'

export interface Group {
  id: string
  name: string
  color: string
  items: ItemWithMeta[]
  /** The implicit "All items" / "Uncategorized" group */
  isDefault?: boolean
  shared?: boolean
  members?: { name: string }[]
  emptyText?: string
  emptyHint?: string
  onManage?: () => void
}

interface Props {
  group: Group
  expandedId: string | null
  onExpand: (id: string | null) => void
}

export function WatchlistGroup({ group: g, expandedId, onExpand }: Props) {
  return (
    <section className="min-w-0 max-md:mb-7">
      <div className="flex items-center gap-2 mx-1 mb-2.5 md:mx-1.5 md:mb-3 min-h-7">
        {!g.isDefault && <span className="w-[9px] h-[9px] md:w-2.5 md:h-2.5 rounded-full shrink-0" style={{ background: themeOf(g.color)[0] }} />}
        <h2 className="m-0 text-[15px] md:text-[17px] font-medium tracking-[-0.01em] md:tracking-[-0.015em] truncate">{g.name}</h2>
        <span className="text-[13px] md:text-[14px] text-muted tabular-nums">{g.items.length}</span>
        {g.shared && <Pill variant="dashed" size="sm">shared</Pill>}
        <span className="flex-1 h-px bg-line-hair ml-1 md:bg-transparent" />
        {g.members && g.members.length > 0 && <AvatarStack people={g.members} size={24} ring="var(--screen-bg)" />}
        {g.onManage && (
          <IconButton
            icon="more"
            size="sm"
            variant="plain"
            label={`Manage ${g.name}`}
            onClick={g.onManage}
            className="relative before:content-[''] before:absolute before:-inset-1.5"
          />
        )}
      </div>

      {g.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center border border-dashed border-line-dashed rounded-lg md:rounded-xl py-[22px] px-4 md:min-h-[150px]">
          <span className="text-[14px] text-muted">{g.emptyText ?? 'No items yet'}</span>
          {g.emptyHint && <span className="text-[13px] text-muted mt-1">{g.emptyHint}</span>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {g.items.map((it) => {
            const color = g.isDefault ? themeFor(it)[0] : themeOf(g.color)[0]
            const newCount = it.new_listings_count ?? 0
            return (
              <StackCard
                key={it.id}
                href={`/items/${it.id}`}
                label={`${it.brand ? `${it.brand} ` : ''}${it.name}${newCount > 0 ? `, ${newCount} new` : ''}`}
                color={color}
                leading={<Thumb shape="circle" src={it.lowestListing?.image_url} className="w-11 h-11 md:w-12 md:h-12" />}
                badge={newCount > 0 ? (
                  <Pill variant="ink" size="sm" title={`${newCount} new listing${newCount === 1 ? '' : 's'} since your last visit`}>
                    {newCount} new
                  </Pill>
                ) : null}
                eyebrow={it.brand}
                title={it.name}
                value={<Price value={it.lowestListing?.price} size="lead" />}
                expanded={expandedId === it.id}
                onToggle={() => onExpand(expandedId === it.id ? null : it.id)}
                details={
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-on-color-muted">
                      {it.max_price ? `Up to ${it.max_price.toLocaleString('sv-SE')} kr` : 'Any price'}
                    </span>
                    <Link href={`/items/${it.id}`} className={`${buttonClass({ size: 'sm' })} no-underline`}>See listings</Link>
                  </div>
                }
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
