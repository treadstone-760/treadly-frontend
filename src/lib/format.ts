export function formatMoney(amount: string | number | null | undefined, currency = 'GHS'): string {
  const value = Number(amount ?? 0)
  if (!Number.isFinite(value)) return `${currency} ${amount ?? '0'}`
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function labelize(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function today(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function monthStart(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}-01`
}

export function compact(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === undefined || value === null) continue
    output[key] = value
  }
  return output
}

export function canWrite(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export function canManage(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function isNegative(amount: string): boolean {
  return amount.trim().startsWith('-')
}

export function unwrapList<T>(value: T[] | { data: T[] } | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : value.data
}
