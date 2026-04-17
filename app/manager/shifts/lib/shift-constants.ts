// Constants for shift types and days
export const DAY_OPTIONS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
]

export const SHIFT_TYPES = [
  'contract',
  'training',
  'temporary',
  'replacement',
  'internal',
  'other',
]

export const EMPTY_FORM = {
  shift_name: '',
  shift_code: '',
  start_time: '',
  end_time: '',
  required_headcount: 1,
  start_date: '',
  end_date: '',
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  is_chargeable: true,
  type: 'contract',
  is_active: true,
}

export const TYPE_BADGE_COLORS: Record<string, string> = {
  contract: 'bg-green-100 text-green-700 border-0',
  training: 'bg-blue-100 text-blue-700 border-0',
  temporary: 'bg-amber-100 text-amber-700 border-0',
  replacement: 'bg-rose-100 text-rose-700 border-0',
  internal: 'bg-purple-100 text-purple-700 border-0',
  other: 'bg-slate-100 text-slate-700 border-0',
}
