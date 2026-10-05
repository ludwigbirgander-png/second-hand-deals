const RING = ['var(--bubblegum)', 'var(--lime)', 'var(--periwinkle)', 'var(--tangerine)', 'var(--lilac)']

function initials(name = '') {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

/** Initials avatar for list members. */
export function Avatar({ name, size = 28, index = 0, ring = 'var(--paper)' }: { name: string; size?: number; index?: number; ring?: string }) {
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center rounded-full text-ink font-semibold leading-none shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: RING[index % RING.length], boxShadow: `0 0 0 2px ${ring}` }}
    >
      {initials(name)}
    </span>
  )
}

export function AvatarStack({ people, size = 28, ring = 'var(--paper)', max = 3 }: { people: { name: string }[]; size?: number; ring?: string; max?: number }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="inline-flex" style={{ paddingLeft: size * 0.3 }}>
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: -size * 0.3 }}>
          <Avatar name={p.name} size={size} index={i} ring={ring} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-paper-2 text-[11px] font-semibold"
          style={{ width: size, height: size, marginLeft: -size * 0.3, boxShadow: `0 0 0 2px ${ring}` }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
