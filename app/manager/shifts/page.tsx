'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Edit2, LogOut, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type Site = {
  id: string
  site_code: string
  name: string
}

type Shift = {
  id: string
  site_id: string
  shift_name: string
  shift_code: string | null
  start_time: string
  end_time: string
  required_headcount: number
  start_date: string | null
  end_date: string | null
  days_of_week: number[] | null
  is_chargeable: boolean | null
  type: string | null
  is_active: boolean | null
  created_at?: string
  updated_at?: string
}

type ShiftFormValues = {
  shift_name: string
  shift_code: string
  start_time: string
  end_time: string
  required_headcount: number
  start_date: string
  end_date: string
  days_of_week: number[]
  is_chargeable: boolean
  type: string
  is_active: boolean
}

const dayOptions = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
]

const emptyForm: ShiftFormValues = {
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

export default function ShiftsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [sites, setSites] = useState<Site[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])

  const [selectedSiteCode, setSelectedSiteCode] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddMode, setIsAddMode] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [formValues, setFormValues] = useState<ShiftFormValues>({ ...emptyForm })

  const todayDate = new Date()
  const dateStr = todayDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

  const handleSignOut = () => {
    router.push('/')
  }

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, site_code, name')
        .order('site_code')

      if (sitesError) throw sitesError

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shift_definitions')
        .select(`
          id,
          site_id,
          shift_name,
          shift_code,
          start_time,
          end_time,
          required_headcount,
          start_date,
          end_date,
          days_of_week,
          is_chargeable,
          type,
          is_active,
          created_at,
          updated_at
        `)
        .order('start_time')

      if (shiftsError) throw shiftsError

      const safeSites = (sitesData || []) as Site[]
      const safeShifts = (shiftsData || []) as Shift[]

      setSites(safeSites)
      setShifts(safeShifts)

      if (!selectedSiteCode && safeSites.length > 0) {
        setSelectedSiteCode(safeSites[0].site_code)
      }
    } catch (error) {
      console.error('[shifts] Error loading data:', error)
      alert('Failed to load shift setup data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredSites = useMemo(() => {
    return sites.filter(
      (site) =>
        site.site_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [sites, searchQuery])

  const selectedSite = useMemo(() => {
    return sites.find((s) => s.site_code === selectedSiteCode) || null
  }, [sites, selectedSiteCode])

  const selectedShifts = useMemo(() => {
    if (!selectedSite) return []
    return shifts.filter((shift) => shift.site_id === selectedSite.id)
  }, [shifts, selectedSite])

  const getTypeBadgeColor = (type: string | null) => {
    switch ((type || '').toLowerCase()) {
      case 'contract':
        return 'bg-green-100 text-green-700 border-0'
      case 'training':
        return 'bg-blue-100 text-blue-700 border-0'
      case 'temporary':
        return 'bg-amber-100 text-amber-700 border-0'
      case 'replacement':
        return 'bg-rose-100 text-rose-700 border-0'
      default:
        return 'bg-slate-100 text-slate-700 border-0'
    }
  }

  const formatTypeLabel = (type: string | null) => {
    if (!type) return 'Other'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const formatDays = (days: number[] | null) => {
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

  const formatTime = (time: string | null) => {
    if (!time) return '-'
    return time.slice(0, 5)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const isOvernightShift = (startTime: string, endTime: string) => {
    return endTime < startTime
  }

  const handleFormChange = <K extends keyof ShiftFormValues>(
    field: K,
    value: ShiftFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleDayToggle = (dayValue: number) => {
    setFormValues((prev) => {
      const current = prev.days_of_week || []
      const updated = current.includes(dayValue)
        ? current.filter((d) => d !== dayValue)
        : [...current, dayValue].sort((a, b) => a - b)

      return {
        ...prev,
        days_of_week: updated,
      }
    })
  }

  const handleAddShift = () => {
    setIsAddMode(true)
    setEditingShift(null)
    setFormValues({ ...emptyForm })
    setIsEditModalOpen(true)
  }

  const handleEditShift = (shift: Shift) => {
    setIsAddMode(false)
    setEditingShift(shift)
    setFormValues({
      shift_name: shift.shift_name || '',
      shift_code: shift.shift_code || '',
      start_time: shift.start_time || '',
      end_time: shift.end_time || '',
      required_headcount: shift.required_headcount || 1,
      start_date: shift.start_date || '',
      end_date: shift.end_date || '',
      days_of_week: shift.days_of_week || [1, 2, 3, 4, 5, 6, 7],
      is_chargeable: shift.is_chargeable ?? true,
      type: shift.type || 'contract',
      is_active: shift.is_active ?? true,
    })
    setEditingShift(shift)
    setIsEditModalOpen(true)
  }

  const closeModal = () => {
    setIsEditModalOpen(false)
    setIsAddMode(false)
    setEditingShift(null)
    setFormValues({ ...emptyForm })
  }

  const validateForm = () => {
    if (!selectedSite) {
      alert('Please select a site.')
      return false
    }
    if (!formValues.shift_name.trim()) {
      alert('Shift name is required.')
      return false
    }
    if (!formValues.shift_code.trim()) {
      alert('Shift code is required.')
      return false
    }
    if (!formValues.start_time || !formValues.end_time) {
      alert('Start time and end time are required.')
      return false
    }
    if (!formValues.start_date || !formValues.end_date) {
      alert('Start date and end date are required.')
      return false
    }
    if (!formValues.required_headcount || formValues.required_headcount < 1) {
      alert('Required headcount must be at least 1.')
      return false
    }
    if (formValues.days_of_week.length === 0) {
      alert('Select at least one day.')
      return false
    }
    if (formValues.end_date < formValues.start_date) {
      alert('End date cannot be earlier than start date.')
      return false
    }
    return true
  }

  const handleSaveShift = async () => {
    if (!validateForm() || !selectedSite) return

    try {
      setSaving(true)

      const payload = {
        site_id: selectedSite.id,
        shift_name: formValues.shift_name.trim(),
        shift_code: formValues.shift_code.trim(),
        start_time: formValues.start_time,
        end_time: formValues.end_time,
        required_headcount: Number(formValues.required_headcount),
        start_date: formValues.start_date,
        end_date: formValues.end_date,
        days_of_week: formValues.days_of_week,
        is_chargeable: formValues.is_chargeable,
        type: formValues.type.toLowerCase(),
        is_active: formValues.is_active,
      }

      if (isAddMode) {
        const { error } = await supabase
          .from('shift_definitions')
          .insert(payload)

        if (error) throw error
      } else {
        if (!editingShift) {
          alert('No shift selected for editing.')
          return
        }

        const { error } = await supabase
          .from('shift_definitions')
          .update(payload)
          .eq('id', editingShift.id)

        if (error) throw error
      }

      await loadData()
      closeModal()
    } catch (error: any) {
      console.error('[shifts] Error saving shift:', error)
      alert(error?.message || 'Failed to save shift.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading shifts...</p>
      </div>
    )
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{dateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">Vinod Alex Raj</p>
              <Badge variant="secondary" className="mt-1">
                Manager
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-slate-600 hover:text-slate-900"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)] bg-slate-50">
        <div className="w-[320px] border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Sites</h3>
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1 p-2">
            {filteredSites.map((site) => {
              const siteShifts = shifts.filter((s) => s.site_id === site.id)
              const totalCount = siteShifts.length
              const activeCount = siteShifts.filter((s) => s.is_active).length

              return (
                <button
                  type="button"
                  key={site.id}
                  onClick={() => setSelectedSiteCode(site.site_code)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${selectedSiteCode === site.site_code
                      ? 'bg-teal-50 font-medium text-teal-900'
                      : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{site.site_code}</div>
                      <div className="text-xs text-slate-500">{site.name}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {activeCount} active / {totalCount} total
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {activeCount}/{totalCount}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-white">
          {selectedSite ? (
            <>
              <div className="border-b border-slate-200 p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedSite.site_code}</h2>
                    <p className="text-sm text-slate-600">{selectedSite.name}</p>
                  </div>

                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddShift}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Shift
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Total Shifts</p>
                    <p className="text-lg font-bold text-slate-900">{selectedShifts.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Active</p>
                    <p className="text-lg font-bold text-green-600">
                      {selectedShifts.filter((s) => s.is_active).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Total Headcount</p>
                    <p className="text-lg font-bold text-slate-900">
                      {selectedShifts.reduce((sum, s) => sum + s.required_headcount, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {selectedShifts.length === 0 ? (
                  <div className="flex h-[400px] items-center justify-center">
                    <div className="text-center">
                      <AlertCircle className="mx-auto mb-2 h-10 w-10 text-amber-500" />
                      <p className="text-sm text-slate-600">No shifts defined</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            Shift
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            Headcount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            Days
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            Start Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            End Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-700">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {selectedShifts.map((shift) => (
                          <tr key={shift.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{shift.shift_name}</p>
                                <p className="text-xs text-slate-500">{shift.shift_code || '-'}</p>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                              <div>
                                <span>
                                  {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
                                </span>
                                {isOvernightShift(shift.start_time, shift.end_time) && (
                                  <span className="ml-2 text-xs text-amber-600">(next day)</span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                              {shift.required_headcount}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-600">
                              {formatDays(shift.days_of_week)}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-600">
                              {formatDate(shift.start_date)}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-600">
                              {formatDate(shift.end_date)}
                            </td>

                            <td className="px-4 py-3">
                              <Badge className={getTypeBadgeColor(shift.type)}>
                                {formatTypeLabel(shift.type)}
                              </Badge>
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                className={
                                  shift.is_active
                                    ? 'border-0 bg-green-100 text-green-700'
                                    : 'border-0 bg-slate-200 text-slate-700'
                                }
                              >
                                {shift.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditShift(shift)}
                                className="text-teal-600 hover:bg-teal-50"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-slate-500">No site selected</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-full max-w-5xl p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-slate-200 px-8 py-6">
            <DialogTitle className="text-xl font-bold text-slate-900">
              {isAddMode ? 'Add New Shift' : 'Edit Shift'}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[80vh] overflow-y-auto px-8 py-6">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase text-slate-500">Basic Info</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Shift Name *
                      </label>
                      <Input
                        value={formValues.shift_name}
                        onChange={(e) => handleFormChange('shift_name', e.target.value)}
                        placeholder="e.g. Morning"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Shift Code *
                      </label>
                      <Input
                        value={formValues.shift_code}
                        onChange={(e) => handleFormChange('shift_code', e.target.value)}
                        placeholder="e.g. MRN-01"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Type
                      </label>
                      <select
                        value={formValues.type}
                        onChange={(e) => handleFormChange('type', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="contract">Contract</option>
                        <option value="training">Training</option>
                        <option value="temporary">Temporary</option>
                        <option value="replacement">Replacement</option>
                        <option value="internal">Internal</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formValues.is_active}
                        onChange={(e) => handleFormChange('is_active', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Active</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formValues.is_chargeable}
                        onChange={(e) => handleFormChange('is_chargeable', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Chargeable</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase text-slate-500">Schedule</h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Start Time *
                        </label>
                        <Input
                          type="time"
                          value={formValues.start_time}
                          onChange={(e) => handleFormChange('start_time', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          End Time *
                        </label>
                        <Input
                          type="time"
                          value={formValues.end_time}
                          onChange={(e) => handleFormChange('end_time', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Days of Week
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {dayOptions.map((day) => (
                          <button
                            type="button"
                            key={day.value}
                            onClick={() => handleDayToggle(day.value)}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${formValues.days_of_week.includes(day.value)
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Start Date *
                        </label>
                        <Input
                          type="date"
                          value={formValues.start_date}
                          onChange={(e) => handleFormChange('start_date', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          End Date *
                        </label>
                        <Input
                          type="date"
                          value={formValues.end_date}
                          onChange={(e) => handleFormChange('end_date', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Required Headcount *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={formValues.required_headcount}
                        onChange={(e) =>
                          handleFormChange('required_headcount', Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-8 py-6">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveShift}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? 'Saving...' : isAddMode ? 'Create Shift' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}