// The Brand field is gone: brands live in the item name ("Sony WH-1000XM4").

/** The name with an old brand in front, unless the name already starts with it */
export function nameWithBrand(brand: string | null | undefined, name: string): string {
  const b = brand?.trim()
  if (!b || name.toLowerCase().startsWith(b.toLowerCase())) return name
  return `${b} ${name}`
}
