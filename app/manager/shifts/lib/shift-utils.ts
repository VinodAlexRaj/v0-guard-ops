// Utility functions for shift operations
export function normalizeTime(time: string | null | undefined): string {
  if (!time) return ''
  return time.slice(0, 5)
}

export function toMinutes(time: string | null | undefined): number | null {
  const normalized = normalizeTime(time)
  if (!normalized || !normalized.includes(':')) return null
  const [hh, mm] = normalized.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

export function isOvernightShift(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): boolean {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start === null || end === null) return false
  return end <= start
}

export function formatTime(time: string | null) {
  if (!time) return '-'
  return normalizeTime(time)
}

export function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDays(days: number[] | null) {
  if (!days || days.length === 0) return '-'

  const sorted = [...days].sort((a, b) => a - b)
  const joined = sorted.join(',')

  if (joined === '1,2,3,4,5,6,7') return 'Daily'
  if (joined === '1,2,3,4,5') return 'Weekdays'
  if (joined === '6,7') return 'Weekends'

  const map: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
  }

  return sorted.map((d) => map[d]).join(', ')
}

export function getTypeBadgeColor(type: string | null) {
  const colors: Record<string, string> = {
    contract: 'bg-green-100 text-green-700 border-0',
    training: 'bg-blue-100 text-blue-700 border-0',
    temporary: 'bg-amber-100 text-amber-700 border-0',
    replacement: 'bg-rose-100 text-rose-700 border-0',
    internal: 'bg-purple-100 text-purple-700 border-0',
  }
  return colors[(type || '').toLowerCase()] || 'bg-slate-100 text-slate-700 border-0'
}

export function formatTypeLabel(type: string | null) {
  if (!type) return 'Other'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function sortDays(days: number[]) {
  return [...days].sort((a, b) => a - b)
}

export function sameDays(
  a: number[] | null | undefined,
  b: number[] | null | undefined
) {
  const left = sortDays(a || [])
  const right = sortDays(b || [])
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

export function parseShiftSaveError(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes('cannot modify shift: assigned slots exist')) {
    return 'This shift cannot be edited because assigned roster slots already exist. Remove those future assignments first.'
  }

  if (lower.includes('assigned slots exist')) {
    return 'This change is blocked because assigned roster slots already exist. Remove those future assignments first.'
  }

  if (lower.includes('duplicate') || lower.includes('already exists')) {
    return 'A similar shift template already exists for this site.'
  }

  if (lower.includes('row-level security')) {
    return 'This action is blocked by database permissions for this user.'
  }

  return message || 'Failed to save shift.'
}
