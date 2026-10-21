'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CATEGORIES, CONDITIONS, LETTER_SIZES, SALE_TYPES, SIZE_SYSTEM_LABELS, SIZE_VALUES, getCategory, visibleFields,
  type CategoryField, type CategoryId, type ConditionGrade, type ItemFilters, type NumberRange, type SaleType, type SizeFilter, type SizeSystem,
} from '@/lib/categories'
import { Chip } from './ui/Chip'
import { FieldLabel, Input, Segmented, Toggle } from './ui/Form'

interface Props {
  category: CategoryId | null
  filters: ItemFilters
  onChange: (category: CategoryId | null, filters: ItemFilters) => void
  /** Shown under the chips when the category was picked from the item name */
  suggested?: boolean
}

const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v])

/** Category chips; picking one reveals its options. Condition and sale type work for any category. */
export function CategoryFields({ category, filters, onChange, suggested }: Props) {
  const c = getCategory(category)
  const [moreOpen, setMoreOpen] = useState(!!(filters.condition || filters.saleType))
  const set = (patch: Partial<ItemFilters>) => onChange(category, { ...filters, ...patch })
  const active = Object.keys(filters).filter((k) => k !== 'strict').length > 0

  // On phones the chips scroll: bring the picked one into view if it's off to the side (Watches, Glass)
  const chipRow = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = chipRow.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!row || !chip) return
    const r = row.getBoundingClientRect()
    const c = chip.getBoundingClientRect()
    if (c.left < r.left || c.right > r.right) row.scrollBy({ left: c.left - r.left - (r.width - c.width) / 2 })
  }, [category])

  function pickCategory(id: CategoryId | null) {
    if (id === category) return
    // Category options don't carry over; condition and sale type do
    onChange(id, { condition: filters.condition, saleType: filters.saleType, strict: filters.strict })
  }

  const shared = (
    <>
      <div>
        <FieldLabel>Condition, at least</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Chip size="sm" label="Any" active={!filters.condition} onClick={() => set({ condition: undefined })} />
          {CONDITIONS.filter((x) => x.id !== 'parts').map((x) => (
            <Chip key={x.id} size="sm" label={x.label} active={filters.condition === x.id} onClick={() => set({ condition: x.id as ConditionGrade })} />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Sale type</FieldLabel>
        <Segmented
          size="sm"
          label="Sale type"
          value={filters.saleType ?? 'any'}
          options={[{ value: 'any', label: 'Both' }, ...SALE_TYPES.map((s) => ({ value: s.id, label: s.id === 'fixed' ? 'Fixed price' : 'Auctions' }))]}
          onChange={(v) => set({ saleType: v === 'any' ? undefined : (v as SaleType) })}
        />
      </div>
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel>Category</FieldLabel>
        {/* One scrolling row on phones, wrapping on wider screens */}
        <div ref={chipRow} className="flex items-center gap-2 max-md:overflow-x-auto max-md:-mx-4 max-md:px-4 max-md:pb-1 md:flex-wrap [scrollbar-width:none]">
          <Chip size="sm" label="Any" active={!c} onClick={() => pickCategory(null)} className="shrink-0" />
          {CATEGORIES.map((x) => (
            <Chip key={x.id} size="sm" label={x.short ?? x.label} active={category === x.id} onClick={() => pickCategory(x.id)} className="shrink-0" />
          ))}
        </div>
        {suggested && c && <p className="m-0 mt-1.5 text-[12px] text-muted">Suggested from the name</p>}
      </div>

      {c && (
        <div className="flex flex-col gap-4 pl-3 border-l-2 border-line-hair">
          {visibleFields(c, filters).map((field) => {
            const value = filters[field.key]
            const setValue = (v: ItemFilters[string]) => set({ [field.key]: v })
            switch (field.kind) {
              case 'size':
                return <SizeField key={field.key} field={field} shoes={c.id === 'shoes'} kids={!!filters.department?.includes('kids')} value={filters.size} onChange={(size) => set({ size })} />
              case 'options':
                return <OptionsField key={field.key} field={field} value={value as string[] | undefined} onChange={setValue} />
              case 'min':
                return <MinField key={field.key} field={field} value={value as number | undefined} onChange={setValue} />
              case 'range':
                return <RangeField key={field.key} field={field} value={value as NumberRange | undefined} onChange={setValue} />
              case 'toggle':
                return (
                  <Toggle
                    key={field.key}
                    checked={value === true}
                    onChange={(on) => setValue(on || undefined)}
                    label={field.label}
                    description={field.description}
                  />
                )
            }
          })}
          {shared}
        </div>
      )}

      {!c && (moreOpen ? (
        <div className="flex flex-col gap-4">{shared}</div>
      ) : (
        <button type="button" onClick={() => setMoreOpen(true)} className="self-start text-[13px] font-medium text-ink underline underline-offset-2 cursor-pointer">
          Condition and sale type
        </button>
      ))}

      {active && (
        <Toggle
          checked={!!filters.strict}
          onChange={(v) => set({ strict: v || undefined })}
          label="Only listings that state these details"
          description="Off: listings that don't say their size, colour… are kept and marked"
        />
      )}
    </div>
  )
}

function OptionsField({ field, value, onChange }: {
  field: CategoryField
  value: string[] | undefined
  onChange: (v: string[] | undefined) => void
}) {
  return (
    <div>
      <FieldLabel>{field.label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {field.options!.map((o) => (
          <Chip
            key={o.id}
            size="sm"
            label={o.label}
            active={!!value?.includes(o.id)}
            onClick={() => {
              const next = toggle(value, o.id)
              onChange(next.length ? next : undefined)
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** Digits, plus one decimal comma or point when the field allows halves ("17,5"); empty means "not set" */
function cleanNumber(text: string, decimals: boolean): string {
  if (!decimals) return text.replace(/\D/g, '')
  const [whole, ...rest] = text.replace(/[^\d.,]/g, '').split(/[.,]/)
  return rest.length ? `${whole},${rest.join('').slice(0, 1)}` : whole
}
const toNumber = (text: string) => (text && text !== ',' ? Number(text.replace(',', '.')) : undefined)

/**
 * A number box that keeps what's typed ("17," on the way to "17,5") and reports the number.
 * Text that no longer matches the value (the filters were reset) is replaced.
 */
function NumberInput({ value, step, onChange, ...rest }: {
  value: number | undefined
  step?: number
  onChange: (n: number | undefined) => void
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'step'>) {
  const decimals = !!step && step < 1
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  const shown = toNumber(text) === value ? text : value == null ? '' : String(value).replace('.', ',')
  return (
    <Input
      {...rest}
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={shown}
      onChange={(e) => {
        const next = cleanNumber(e.target.value, decimals)
        setText(next)
        onChange(toNumber(next))
      }}
    />
  )
}

/** "50–100 %", or an error when outside the field's bounds (it wouldn't be saved) */
function boundsError(field: CategoryField, n: number | undefined) {
  if (n == null || !field.bounds) return null
  const [lo, hi] = field.bounds
  return n < lo || n > hi ? `Between ${lo} and ${hi}${field.unit ? ` ${field.unit}` : ''}` : null
}

function MinField({ field, value, onChange }: {
  field: CategoryField
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  return (
    <NumberInput
      label={`${field.label}, at least`}
      inputSize="sm"
      placeholder="Any"
      suffix={field.unit}
      step={field.step}
      value={value}
      error={boundsError(field, value)}
      wrapperClassName="max-w-[180px]"
      onChange={onChange}
    />
  )
}

function RangeField({ field, value, onChange }: {
  field: CategoryField
  value: NumberRange | undefined
  onChange: (v: NumberRange | undefined) => void
}) {
  const update = (patch: NumberRange) => {
    const next = { ...value, ...patch }
    onChange(next.from == null && next.to == null ? undefined : next)
  }
  return (
    <div className="flex flex-col gap-1.5 max-w-[320px]">
      <span className="text-[13px] font-medium leading-[1.3] text-muted">{field.label}</span>
      <div className="flex items-start gap-2">
        <NumberInput aria-label={`${field.label} from`} inputSize="sm" placeholder="Any" suffix={field.unit} step={field.step} value={value?.from}
          error={boundsError(field, value?.from)} wrapperClassName="flex-1" onChange={(from) => update({ from })} />
        <span className="leading-9 text-faint">–</span>
        <NumberInput aria-label={`${field.label} to`} inputSize="sm" placeholder="Any" suffix={field.unit} step={field.step} value={value?.to}
          error={boundsError(field, value?.to)} wrapperClassName="flex-1" onChange={(to) => update({ to })} />
      </div>
    </div>
  )
}

function SizeField({ field, shoes, kids, value, onChange }: {
  field: CategoryField
  shoes: boolean
  kids: boolean
  value: SizeFilter | undefined
  onChange: (v: SizeFilter | undefined) => void
}) {
  const systems = field.sizeSystems ?? []
  const [system, setSystem] = useState<SizeSystem>(value?.system ?? systems[0])

  const chips = (values: (string | number)[], selected: (string | number)[], pick: (v: string | number) => void, suffix = '') => (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <Chip key={v} size="sm" label={`${v}${suffix}`} active={selected.includes(v)} onClick={() => pick(v)} className="tabular-nums" />
      ))}
    </div>
  )

  const current = value?.system === system ? value : undefined
  let body
  if (system === 'jeans') {
    const j = current?.system === 'jeans' ? current : { system: 'jeans' as const, waist: [], length: [] }
    const update = (patch: Partial<typeof j>) => {
      const next = { ...j, ...patch }
      onChange(next.waist.length || next.length.length ? next : undefined)
    }
    body = (
      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-muted">Waist</span>
        {chips(SIZE_VALUES.jeansWaist, j.waist, (v) => update({ waist: toggle(j.waist, v as number).sort((a, b) => a - b) }))}
        <span className="text-[12px] text-muted">Length</span>
        {chips(SIZE_VALUES.jeansLength, j.length, (v) => update({ length: toggle(j.length, v as number).sort((a, b) => a - b) }))}
      </div>
    )
  } else {
    const values: (string | number)[] =
      system === 'letter' ? LETTER_SIZES
        : system === 'kids' ? SIZE_VALUES.kids
          : shoes ? (kids ? SIZE_VALUES.shoesKids : SIZE_VALUES.shoesAdult)
            : SIZE_VALUES.clothingEu
    const selected: (string | number)[] = current && current.system !== 'jeans' ? current.values : []
    body = chips(values, selected, (v) => {
      const next = toggle(selected, v)
      onChange(next.length ? ({ system, values: next } as SizeFilter) : undefined)
    })
  }

  return (
    <div>
      <FieldLabel>{field.label}</FieldLabel>
      {systems.length > 1 && (
        <Segmented
          size="sm"
          label="Size system"
          className="mb-2.5 max-w-full overflow-x-auto"
          value={system}
          options={systems.map((s) => ({ value: s, label: SIZE_SYSTEM_LABELS[s] }))}
          onChange={(s) => {
            setSystem(s)
            // One size system at a time
            if (value && value.system !== s) onChange(undefined)
          }}
        />
      )}
      {body}
      {shoes && <p className="m-0 mt-1.5 text-[12px] text-muted">Half sizes count as the size below: 42 includes 42½.</p>}
    </div>
  )
}
