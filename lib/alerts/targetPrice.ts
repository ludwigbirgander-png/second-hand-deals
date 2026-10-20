/** Reads a target price from a request: a whole number of kronor, null to clear it, undefined if missing or invalid */
export function parseTargetPrice(v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : undefined
}
