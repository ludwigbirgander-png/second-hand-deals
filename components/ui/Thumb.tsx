interface Props {
  src?: string | null
  alt?: string
  shape?: 'rounded' | 'circle'
  /** Fixed square size in px. Omit to fill the width at 1:1, or size it with `className`. */
  size?: number
  className?: string
}

/** Photo frame with a hatched placeholder when there is no image. */
export function Thumb({ src, alt = '', shape = 'rounded', size, className }: Props) {
  const box = size ? { width: size, height: size } : undefined
  return (
    <div
      className={`relative overflow-hidden bg-paper-2 shrink-0 ${shape === 'circle' ? 'rounded-full' : 'rounded-[18px]'} ${className ?? (size ? '' : 'w-full aspect-square')}`}
      style={box}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'var(--pattern-hatch)' }} />
      )}
    </div>
  )
}
