const PALETTE = ['var(--lemon)', 'var(--bubblegum)', 'var(--periwinkle)', 'var(--mint)', 'var(--tangerine)', 'var(--lilac)']

function initials(name = '') {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

interface AvatarProps {
  name: string
  color?: string
  size?: number
  ring?: string
  overlap?: boolean
}

export function Avatar({ name, color, size = 36, ring, overlap }: AvatarProps) {
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center rounded-full text-ink font-medium tracking-[-0.02em] shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: color ?? PALETTE[name.length % PALETTE.length],
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
        marginLeft: overlap ? -size * 0.28 : undefined,
      }}
    >
      {initials(name)}
    </span>
  )
}

export function AvatarStack({ people, size = 36, ring = 'var(--paper)', max = 3 }: { people: { name: string }[]; size?: number; ring?: string; max?: number }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => <Avatar key={i} name={p.name} size={size} ring={ring} overlap={i > 0} />)}
      {extra > 0 && <Avatar name={`+ ${extra}`} color="var(--fill-veil-strong)" size={size} ring={ring} overlap />}
    </span>
  )
}
