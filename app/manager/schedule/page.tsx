'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LogOut, ChevronLeft, ChevronRight, CalendarDays, Building2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'

/* ─── Types ──────────────────────────────────────────────── */
interface SiteOption { id: string; site_code: string; name: string | null }

interface Slot {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  shift_definition_id: string
  site_id: string
}

interface ShiftDefinition {
  id: string
  shift_name: string
  shift_code: string
  start_time?: string | null
  required_headcount: number
  site_id: string
}

interface Assignment {
  id: string
  roster_slot_id: string
  guard_id: string
  assignment_type: 'planned' | 'replacement' | 'adhoc'
  is_cancelled: boolean
}

interface Guard {
  id: string
  full_name: string
  external_employee_code: string | null
  external_role: string | null
}

interface LeaveRecord {
  id: string
  user_id: string
  leave_date: string
  leave_status: string
}

interface RosterCell {
  guardName: string
  assignmentType: string
  assignmentId: string
  guardId: string
}

interface SelectedCellData {
  shift: string
  time: string
  date: string
  filled: number
  required: number
  shiftIndex: number
  dayIndex: number
  hasSlot: boolean
}

/* ─── Helpers ────────────────────────────────────────────── */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })
}

function combineDateAndTime(dateString: string, timeString: string): Date {
  const normalizedTime = timeString.length === 5 ? `${timeString}:00` : timeString
  return new Date(`${dateString}T${normalizedTime}`)
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`
}

/* ─── Main Component ─────────────────────────────────────── */
export default function ManagerSchedulerPage() {
  const router = useRouter()

  /* ── Site selector state ─────── */
  const [sites, setSites] = useState<SiteOption[]>([])
  const [sitesLoading, setSitesLoading] = useState(true)
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')
  const [siteSearchQuery, setSiteSearchQuery] = useState('')

  /* ── Schedule state ──────────── */
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getWeekStart(new Date()))
  const [selectedCell, setSelectedCell] = useState<{ shiftIndex: number; dayIndex: number }>({ shiftIndex: 0, dayIndex: 0 })
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null)

  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const [slots, setSlots] = useState<Slot[]>([])
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignedGuardProfiles, setAssignedGuardProfiles] = useState<Guard[]>([])
  const [guardsDirectory, setGuardsDirectory] = useState<Guard[]>([])
  const [guardLeave, setGuardLeave] = useState<LeaveRecord[]>([])
  const [guardShiftCounts, setGuardShiftCounts] = useState<Map<string, Map<string, number>>>(new Map())
  const [managerName, setManagerName] = useState('Manager')

  const slotsRef = useRef<Slot[]>([])

  /* ── Derived ─────────────────── */
  const currentDateStr = useMemo(() => formatDisplayDate(new Date()), [])

  const weekEnd = useMemo(() => {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + 6)
    return d
  }, [weekStartDate])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate)
      d.setDate(weekStartDate.getDate() + i)
      return d
    }),
    [weekStartDate]
  )

  const dayNames = useMemo(
    () => days.map(date => {
      const dayName = date.toLocaleDateString('en-MY', { weekday: 'short' })
      const dayNum = date.getDate()
      return `${dayName} ${dayNum}`
    }),
    [days]
  )

  const activeSite = useMemo(
    () => sites.find(s => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  )

  const filteredSites = useMemo(
    () => sites.filter(s =>
      s.site_code.toLowerCase().includes(siteSearchQuery.toLowerCase()) ||
      (s.name || '').toLowerCase().includes(siteSearchQuery.toLowerCase())
    ),
    [sites, siteSearchQuery]
  )

  /* ── Auth + sites fetch ──────── */
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userData } = await supabase
            .from('users').select('full_name').eq('id', user.id).single()
          if (userData?.full_name) setManagerName(userData.full_name)
        }
        const { data: sitesData } = await supabase
          .from('sites')
          .select('id, site_code, name')
          .eq('is_active', true)
          .order('site_code')
        setSites((sitesData || []) as SiteOption[])
      } catch (err) {
        console.error('[scheduler] init error:', err)
      } finally {
        setSitesLoading(false)
      }
    }
    init()
  }, [])

  /* ── Guards directory ────────── */
  const fetchGuards = useCallback(async () => {
    // Fetch role_mapping to get manager/supervisor roles so we can EXCLUDE them
    const { data: roleMappings } = await supabase
      .from('role_mapping')
      .select('external_role, internal_role')

    const nonGuardRoles = [...new Set(
      (roleMappings || [])
        .filter((r: any) => r.internal_role !== 'guard' && r.external_role)
        .map((r: any) => r.external_role as string)
    )]

    // Fetch all active users — if we have non-guard roles, exclude them; otherwise fetch all
    let query = supabase
      .from('users')
      .select('id, full_name, external_employee_code, external_role')
      .eq('is_active', true)
      .order('full_name')

    // Exclude known manager/supervisor/admin roles if available
    if (nonGuardRoles.length > 0) {
      query = query.not('external_role', 'in', `(${nonGuardRoles.map(r => `"${r}"`).join(',')})`)
    }

    const { data: guards } = await query
    setGuardsDirectory((guards || []) as Guard[])
  }, [])

  const calculateGuardShiftCounts = useCallback((assignmentRows: Assignment[], slotRows: Slot[]) => {
    const countMap = new Map<string, Map<string, number>>()
    for (const assignment of assignmentRows) {
      const slot = slotRows.find(s => s.id === assignment.roster_slot_id)
      if (!slot) continue
      const dateStr = slot.shift_date
      if (!countMap.has(dateStr)) countMap.set(dateStr, new Map())
      const guardMap = countMap.get(dateStr)!
      guardMap.set(assignment.guard_id, (guardMap.get(assignment.guard_id) || 0) + 1)
    }
    setGuardShiftCounts(countMap)
  }, [])

  const syncSelection = useCallback(
    (nextSlots: Slot[], nextShiftDefs: ShiftDefinition[]) => {
      if (nextSlots.length === 0) { setSelectedSlotId(null); setSelectedCell({ shiftIndex: 0, dayIndex: 0 }); return }
      const currentStillExists = selectedSlotId && nextSlots.some(s => s.id === selectedSlotId)
      const slotToUse = currentStillExists
        ? nextSlots.find(s => s.id === selectedSlotId) || nextSlots[0]
        : nextSlots[0]
      const shiftIndex = nextShiftDefs.findIndex(def => def.id === slotToUse.shift_definition_id)
      const dayIndex = days.findIndex(day => getLocalDateString(day) === getLocalDateString(new Date(slotToUse.shift_date)))
      setSelectedSlotId(slotToUse.id)
      setSelectedCell({ shiftIndex: shiftIndex >= 0 ? shiftIndex : 0, dayIndex: dayIndex >= 0 ? dayIndex : 0 })
    },
    [days, selectedSlotId]
  )

  /* ── Schedule fetch ──────────── */
  const fetchSchedule = useCallback(async (siteUUID: string) => {
    const startDate = getLocalDateString(weekStartDate)
    const endDate = getLocalDateString(weekEnd)

    const { data: slotsData, error: slotsErr } = await supabase
      .from('roster_slots')
      .select('id, shift_date, start_time, end_time, shift_definition_id, site_id')
      .eq('site_id', siteUUID).gte('shift_date', startDate).lte('shift_date', endDate)
    if (slotsErr) throw slotsErr

    const { data: shiftDefsData, error: shiftDefsErr } = await supabase
      .from('shift_definitions')
      .select('id, shift_name, shift_code, start_time, required_headcount, site_id')
      .eq('site_id', siteUUID).eq('is_active', true)
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('shift_code', { ascending: true })
    if (shiftDefsErr) throw shiftDefsErr

    const slotIds = (slotsData || []).map(s => s.id)
    let assignmentsData: Assignment[] = []
    if (slotIds.length > 0) {
      const { data, error: assignErr } = await supabase
        .from('shift_assignments')
        .select('id, roster_slot_id, guard_id, assignment_type, is_cancelled')
        .in('roster_slot_id', slotIds).eq('is_cancelled', false)
      if (assignErr) throw assignErr
      assignmentsData = (data || []) as Assignment[]
    }

    const assignedGuardIds = [...new Set(assignmentsData.map(a => a.guard_id))]
    const { data: guardsData } = assignedGuardIds.length
      ? await supabase.from('users').select('id, full_name, external_employee_code, external_role').in('id', assignedGuardIds)
      : { data: [] }

    const { data: leaveData } = await supabase
      .from('leaves').select('id, user_id, leave_date, leave_status')
      .gte('leave_date', startDate).lte('leave_date', endDate).eq('leave_status', 'Approved')

    const nextSlots = (slotsData || []) as Slot[]
    const nextShiftDefs = (shiftDefsData || []) as ShiftDefinition[]
    slotsRef.current = nextSlots
    setSlots(nextSlots)
    setShiftDefs(nextShiftDefs)
    setAssignments(assignmentsData)
    setAssignedGuardProfiles((guardsData || []) as Guard[])
    setGuardLeave((leaveData || []) as LeaveRecord[])
    calculateGuardShiftCounts(assignmentsData, nextSlots)
    syncSelection(nextSlots, nextShiftDefs)
  }, [calculateGuardShiftCounts, syncSelection, weekEnd, weekStartDate])

  /* ── Load schedule when site or week changes ── */
  useEffect(() => {
    if (!selectedSiteId) return
    setScheduleLoading(true)
    setScheduleError(null)
    Promise.all([fetchSchedule(selectedSiteId), fetchGuards()])
      .catch(err => setScheduleError(err instanceof Error ? err.message : 'Failed to load schedule'))
      .finally(() => setScheduleLoading(false))
  }, [fetchSchedule, fetchGuards, selectedSiteId, weekStartDate])

  /* ── Roster grid ─────────────── */
  const rosterGrid = useMemo(() => {
    const grid: RosterCell[][][] = Array.from({ length: shiftDefs.length }, () => Array.from({ length: 7 }, () => []))
    const slotMap = new Map(slots.map(s => [s.id, s]))
    const guardMap = new Map(assignedGuardProfiles.map(g => [g.id, g]))
    assignments.forEach(assignment => {
      const slot = slotMap.get(assignment.roster_slot_id)
      if (!slot) return
      const guard = guardMap.get(assignment.guard_id)
      if (!guard) return
      const shiftIndex = shiftDefs.findIndex(def => def.id === slot.shift_definition_id)
      const dayIndex = days.findIndex(day => getLocalDateString(day) === getLocalDateString(new Date(slot.shift_date)))
      if (shiftIndex >= 0 && dayIndex >= 0) {
        grid[shiftIndex][dayIndex].push({
          guardName: guard.full_name,
          assignmentType: assignment.assignment_type.toLowerCase(),
          assignmentId: assignment.id,
          guardId: assignment.guard_id,
        })
      }
    })
    return grid
  }, [assignments, assignedGuardProfiles, days, shiftDefs, slots])

  const getSlotForCell = useCallback(
    (shiftIndex: number, dayIndex: number): Slot | null => {
      if (shiftIndex < 0 || shiftIndex >= shiftDefs.length || dayIndex < 0 || dayIndex >= days.length) return null
      const shiftDef = shiftDefs[shiftIndex]
      const dayStr = getLocalDateString(days[dayIndex])
      return slotsRef.current.find(slot => getLocalDateString(new Date(slot.shift_date)) === dayStr && slot.shift_definition_id === shiftDef.id) || null
    },
    [days, shiftDefs]
  )

  const getRosterCell = useCallback(
    (shiftIndex: number, dayIndex: number): RosterCell[] => rosterGrid?.[shiftIndex]?.[dayIndex] || [],
    [rosterGrid]
  )

  const getRequiredHeadcount = useCallback(
    (slotId: string): number => {
      const slot = slotsRef.current.find(s => s.id === slotId)
      if (!slot) return 0
      return shiftDefs.find(sd => sd.id === slot.shift_definition_id)?.required_headcount || 0
    },
    [shiftDefs]
  )

  const selectedSlot = useMemo(
    () => selectedSlotId ? slots.find(s => s.id === selectedSlotId) || null : null,
    [selectedSlotId, slots]
  )

  const realCoverageData = useMemo(() => {
    const coverage: number[] = []
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      let totalRequired = 0, totalFilled = 0
      for (let shiftIdx = 0; shiftIdx < shiftDefs.length; shiftIdx++) {
        const slot = getSlotForCell(shiftIdx, dayIdx)
        if (!slot) continue
        totalRequired += getRequiredHeadcount(slot.id)
        totalFilled += getRosterCell(shiftIdx, dayIdx).length
      }
      coverage.push(totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 0)
    }
    return coverage.length === 7 ? coverage : [0, 0, 0, 0, 0, 0, 0]
  }, [getRequiredHeadcount, getRosterCell, getSlotForCell, shiftDefs.length])

  const getSelectedCellData = useCallback((): SelectedCellData => {
    const { shiftIndex, dayIndex } = selectedCell
    const slot = getSlotForCell(shiftIndex, dayIndex)
    const required = slot ? getRequiredHeadcount(slot.id) : 0
    const filled = slot ? assignments.filter(a => a.roster_slot_id === slot.id).length : getRosterCell(shiftIndex, dayIndex).length
    const date = days[dayIndex] || new Date()
    const shiftDef = slot ? shiftDefs.find(sd => sd.id === slot.shift_definition_id) : shiftDefs[shiftIndex] || null
    return {
      shift: shiftDef?.shift_name || 'Shift',
      time: slot ? formatTimeRange(slot.start_time, slot.end_time) : '—',
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }),
      filled,
      required,
      shiftIndex,
      dayIndex,
      hasSlot: !!slot,
    }
  }, [assignments, days, getRequiredHeadcount, getRosterCell, getSlotForCell, selectedCell, shiftDefs])

  const filteredGuards = useMemo(
    () => guardsDirectory.filter(g => g.full_name.toLowerCase().includes(searchQuery.toLowerCase())),
    [guardsDirectory, searchQuery]
  )

  /* ── Helpers ─────────────────── */
  const getCoverageColor = (pct: number) => pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'

  const getChipColor = (status: string | null, shiftCount = 1): string => {
    if (status) {
      if (shiftCount >= 3) return 'bg-red-100 text-red-700 border-0 font-semibold'
      if (shiftCount === 2) return 'bg-amber-100 text-amber-700 border-0 font-semibold'
      if (status === 'planned') return 'bg-green-100 text-green-700 border-0'
      if (status === 'replacement') return 'bg-amber-100 text-amber-700 border-0'
      if (status === 'adhoc') return 'bg-purple-100 text-purple-700 border-0'
      if (status === 'absent') return 'bg-red-100 text-red-700 border-0 line-through'
    }
    return 'border-2 border-dashed border-slate-300 text-slate-500'
  }

  const parseTriggerError = (msg: string): string => {
    if (msg.includes('Headcount exceeded')) return 'This slot is already full.'
    if (msg.includes('Guard is on approved leave')) return 'This guard is on approved leave on that date.'
    if (msg.includes('no_double_booking') || msg.includes('No double booking')) return 'This guard is already assigned to another shift at this time.'
    return msg
  }

  /* ── Actions ─────────────────── */
  const saveAssignment = async () => {
    if (!selectedSlot || !selectedGuard || !selectedSiteId) return
    try {
      setSaving(true)
      const fullSlot = slotsRef.current.find(s => s.id === selectedSlot.id)
      if (!fullSlot) { alert('No valid roster slot.'); return }

      const { data: existing } = await supabase
        .from('shift_assignments').select('id')
        .eq('roster_slot_id', fullSlot.id).eq('guard_id', selectedGuard.id).eq('is_cancelled', false).single()
      if (existing) { alert('Guard already assigned to this slot.'); setSelectedGuard(null); setSearchQuery(''); return }

      const { data: guardAssignments } = await supabase
        .from('shift_assignments').select('id, roster_slot_id')
        .eq('guard_id', selectedGuard.id).eq('is_cancelled', false)

      const otherSlotIds = [...new Set((guardAssignments || []).map((a: any) => a.roster_slot_id).filter(Boolean))]
      let otherSlots: Slot[] = []
      if (otherSlotIds.length > 0) {
        const { data: otherSlotsData } = await supabase.from('roster_slots')
          .select('id, shift_date, start_time, end_time, shift_definition_id, site_id').in('id', otherSlotIds)
        otherSlots = (otherSlotsData || []) as Slot[]
      }

      const newStart = new Date(fullSlot.start_time)
      const newEnd = new Date(fullSlot.end_time)
      if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1)

      const overlaps = otherSlots.some(slot => {
        if (slot.id === fullSlot.id) return false
        const slotStart = new Date(slot.start_time)
        const slotEnd = new Date(slot.end_time)
        if (slotEnd <= slotStart) slotEnd.setDate(slotEnd.getDate() + 1)
        return slotStart < newEnd && slotEnd > newStart
      })
      if (overlaps) { alert('Guard already assigned to another shift at this time.'); return }

      const { error } = await supabase.from('shift_assignments').insert({
        roster_slot_id: fullSlot.id, site_id: selectedSiteId,
        guard_id: selectedGuard.id, start_time: fullSlot.start_time,
        end_time: fullSlot.end_time, assignment_type: 'planned',
        reason: null, is_cancelled: false,
      })
      if (error) { alert(parseTriggerError(error.message)); return }

      setSelectedGuard(null)
      setSearchQuery('')
      await fetchSchedule(selectedSiteId)
    } catch (err) {
      alert('Failed to save assignment')
    } finally {
      setSaving(false)
    }
  }

  const cancelAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase.from('shift_assignments').update({ is_cancelled: true }).eq('id', assignmentId)
      if (error) throw error
      if (selectedSiteId) await fetchSchedule(selectedSiteId)
    } catch {
      alert('Failed to cancel assignment')
    }
  }

  const cellData = getSelectedCellData()
  const assignedGuards = getRosterCell(cellData.shiftIndex, cellData.dayIndex)

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Scheduler</h1>
              <p className="text-xs text-slate-500">{currentDateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{managerName}</span>
            <Badge className="bg-blue-100 text-blue-700 text-xs">Manager</Badge>
            <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="text-slate-600 hover:text-slate-900">
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-5">

        {/* ── Site Selector Card ─── */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Select Site</span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search sites..."
                value={siteSearchQuery}
                onChange={e => setSiteSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Select value={selectedSiteId} onValueChange={v => { setSelectedSiteId(v); setSiteSearchQuery('') }}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder={sitesLoading ? 'Loading sites...' : 'Choose a site to view schedule'} />
              </SelectTrigger>
              <SelectContent>
                {filteredSites.map(site => (
                  <SelectItem key={site.id} value={site.id}>
                    <span className="font-mono text-xs text-slate-500 mr-2">{site.site_code}</span>
                    {site.name || site.site_code}
                  </SelectItem>
                ))}
                {filteredSites.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500">No sites found</div>
                )}
              </SelectContent>
            </Select>
            {activeSite && (
              <Badge className="bg-teal-100 text-teal-700 font-mono text-xs">{activeSite.site_code}</Badge>
            )}
          </div>
        </Card>

        {/* ── No site selected ─── */}
        {!selectedSiteId && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <CalendarDays className="w-12 h-12 opacity-30" />
            <p className="text-base font-medium">Select a site to view its schedule</p>
            <p className="text-sm">{sites.length} active site{sites.length !== 1 ? 's' : ''} available</p>
          </div>
        )}

        {/* ── Schedule error ─── */}
        {selectedSiteId && scheduleError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {scheduleError}
          </div>
        )}

        {/* ── Schedule content ─── */}
        {selectedSiteId && !scheduleError && (
          <div className="flex gap-5">

            {/* Left: roster grid */}
            <div className="flex-1 min-w-0 space-y-3">

              {/* Week nav */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {activeSite?.name || activeSite?.site_code || ''}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {weekStartDate.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                    {' – '}
                    {weekEnd.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { const d = new Date(weekStartDate); d.setDate(d.getDate() - 7); setWeekStartDate(d) }}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStartDate(getWeekStart(new Date()))}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { const d = new Date(weekStartDate); d.setDate(d.getDate() + 7); setWeekStartDate(d) }}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {scheduleLoading ? (
                <Card className="p-12 text-center text-slate-400 text-sm">Loading schedule...</Card>
              ) : shiftDefs.length === 0 ? (
                <Card className="p-12 text-center text-slate-400 text-sm">
                  No active shift definitions for this site.
                </Card>
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28 min-w-[7rem]">Shift</th>
                        {dayNames.map((day, i) => {
                          const pct = realCoverageData[i]
                          const isToday = getLocalDateString(days[i]) === getLocalDateString(new Date())
                          return (
                            <th key={day} className={`px-2 py-2 font-semibold text-slate-600 text-center min-w-[90px] ${isToday ? 'bg-teal-50' : ''}`}>
                              <div className={isToday ? 'text-teal-700 font-bold' : ''}>{day}</div>
                              <div className={`text-[10px] font-normal mt-0.5 ${getCoverageColor(pct)}`}>{pct}%</div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {shiftDefs.map((shiftDef, shiftIndex) => (
                        <tr key={shiftDef.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-3 py-2 align-top">
                            <div className="font-semibold text-slate-800">{shiftDef.shift_code}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{shiftDef.shift_name}</div>
                          </td>
                          {days.map((day, dayIndex) => {
                            const slot = getSlotForCell(shiftIndex, dayIndex)
                            const cells = getRosterCell(shiftIndex, dayIndex)
                            const required = slot ? getRequiredHeadcount(slot.id) : 0
                            const filled = cells.length
                            const isSelected = selectedCell.shiftIndex === shiftIndex && selectedCell.dayIndex === dayIndex
                            const isToday = getLocalDateString(day) === getLocalDateString(new Date())

                            return (
                              <td
                                key={dayIndex}
                                className={`px-2 py-1.5 align-top cursor-pointer border border-transparent transition-all ${isToday ? 'bg-teal-50/40' : ''} ${isSelected ? 'bg-teal-100 border-teal-400 rounded' : 'hover:bg-slate-50'}`}
                                onClick={() => {
                                  setSelectedCell({ shiftIndex, dayIndex })
                                  setSelectedSlotId(slot?.id || null)
                                  setSelectedGuard(null)
                                  setSearchQuery('')
                                }}
                              >
                                {slot ? (
                                  <div className="space-y-0.5">
                                    <div className={`text-[10px] font-medium mb-1 ${filled >= required && required > 0 ? 'text-green-600' : filled > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                      {filled}/{required}
                                    </div>
                                    {cells.map((cell, idx) => {
                                      const dayStr = getLocalDateString(day)
                                      const shiftCount = guardShiftCounts.get(dayStr)?.get(cell.guardId) || 1
                                      return (
                                        <Badge
                                          key={idx}
                                          className={`block truncate max-w-full text-[10px] px-1.5 py-0 h-5 ${getChipColor(cell.assignmentType, shiftCount)}`}
                                          title={cell.guardName}
                                        >
                                          {cell.guardName.split(' ')[0]}
                                        </Badge>
                                      )
                                    })}
                                    {cells.length < required && (
                                      <Badge className={`block text-[10px] px-1.5 py-0 h-5 ${getChipColor(null)}`}>
                                        +{required - cells.length} open
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-300">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>

            {/* Right: detail panel */}
            {!scheduleLoading && shiftDefs.length > 0 && (
              <div className="w-72 flex-shrink-0 space-y-3">
                {/* Cell info */}
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Selected Slot</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{cellData.shift}</p>
                      <p className="text-xs text-slate-500">{cellData.date} · {cellData.time}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <div className={`text-2xl font-bold ${getCoverageColor(cellData.required > 0 ? Math.round((cellData.filled / cellData.required) * 100) : 0)}`}>
                        {cellData.filled}/{cellData.required}
                      </div>
                      <span className="text-xs text-slate-500">guards assigned</span>
                    </div>
                    {!cellData.hasSlot && (
                      <p className="text-xs text-slate-400 italic">No roster slot for this cell</p>
                    )}
                  </div>
                </Card>

                {/* Assigned guards */}
                {assignedGuards.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Assigned Guards</h3>
                    <div className="space-y-2">
                      {assignedGuards.map(guard => (
                        <div key={guard.assignmentId} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">{guard.guardName}</p>
                            <Badge className={`text-[10px] px-1.5 py-0 h-4 mt-0.5 ${getChipColor(guard.assignmentType)}`}>
                              {guard.assignmentType}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost" size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 px-2 text-xs flex-shrink-0"
                            onClick={() => cancelAssignment(guard.assignmentId)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Assign guard */}
                {cellData.hasSlot && (
                  <Card className="p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Assign Guard</h3>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search guards..."
                          value={searchQuery}
                          onChange={e => { setSearchQuery(e.target.value); setSelectedGuard(null) }}
                          className="pl-8 text-xs h-8"
                        />
                      </div>
                      {searchQuery && !selectedGuard && (
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md bg-white shadow-sm">
                          {filteredGuards.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-400">No guards found</p>
                          ) : filteredGuards.slice(0, 10).map(guard => {
                            const onLeave = guardLeave.some(l =>
                              l.user_id === guard.id &&
                              l.leave_date === getLocalDateString(days[cellData.dayIndex] || new Date())
                            )
                            return (
                              <button
                                key={guard.id}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between ${onLeave ? 'opacity-50' : ''}`}
                                onClick={() => { setSelectedGuard(guard); setSearchQuery(guard.full_name) }}
                              >
                                <span className="truncate">{guard.full_name}</span>
                                {onLeave && <Badge className="bg-red-100 text-red-600 text-[9px] h-4 px-1 flex-shrink-0 ml-1">Leave</Badge>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {selectedGuard && (
                        <div className="flex items-center gap-2 p-2 bg-teal-50 rounded border border-teal-200">
                          <span className="text-xs text-teal-800 font-medium flex-1 truncate">{selectedGuard.full_name}</span>
                          <Button
                            variant="ghost" size="sm"
                            className="h-5 px-1 text-[10px] text-slate-500"
                            onClick={() => { setSelectedGuard(null); setSearchQuery('') }}
                          >
                            ✕
                          </Button>
                        </div>
                      )}
                      <Button
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
                        disabled={!selectedGuard || saving}
                        onClick={saveAssignment}
                      >
                        {saving ? 'Assigning...' : 'Assign Guard'}
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
