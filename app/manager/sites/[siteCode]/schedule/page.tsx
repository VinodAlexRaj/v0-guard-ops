'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'

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

interface SiteRecord {
  id: string
  site_code: string
  name?: string | null
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function combineDateAndTime(dateString: string, timeString: string): Date {
  const normalizedTime = timeString.length === 5 ? `${timeString}:00` : timeString
  return new Date(`${dateString}T${normalizedTime}`)
}

function formatTimeRange(startTime: string, endTime: string): string {
  const start = startTime.slice(0, 5)
  const end = endTime.slice(0, 5)
  return `${start}–${end}`
}

export default function ManagerSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const siteCode = String(params.siteCode || '').toUpperCase()

  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getWeekStart(new Date()))
  const [selectedCell, setSelectedCell] = useState<{ shiftIndex: number; dayIndex: number }>({
    shiftIndex: 0,
    dayIndex: 0,
  })
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [slots, setSlots] = useState<Slot[]>([])
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignedGuardProfiles, setAssignedGuardProfiles] = useState<Guard[]>([])
  const [guardsDirectory, setGuardsDirectory] = useState<Guard[]>([])
  const [guardLeave, setGuardLeave] = useState<LeaveRecord[]>([])
  const [guardShiftCounts, setGuardShiftCounts] = useState<Map<string, Map<string, number>>>(new Map())

  const [siteUUID, setSiteUUID] = useState<string | null>(null)
  const [siteName, setSiteName] = useState('')
  const [managerName, setManagerName] = useState('Manager')

  const slotsRef = useRef<Slot[]>([])

  const currentDateStr = useMemo(() => formatDisplayDate(new Date()), [])

  const weekStart = weekStartDate
  const weekEnd = useMemo(() => {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + 6)
    return d
  }, [weekStartDate])

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStartDate)
        d.setDate(weekStartDate.getDate() + i)
        return d
      }),
    [weekStartDate]
  )

  const dayNames = useMemo(
    () =>
      days.map((date) => {
        const dayName = date.toLocaleDateString('en-MY', { weekday: 'short' })
        const dayNum = date.getDate()
        return `${dayName} ${dayNum}`
      }),
    [days]
  )

  const handleSignOut = () => {
    router.push('/')
  }

  const handleBackToSiteDetails = () => {
    router.push(`/manager/sites/${siteCode}`)
  }

  const getSlotForCell = useCallback(
    (shiftIndex: number, dayIndex: number): Slot | null => {
      if (shiftIndex < 0 || shiftIndex >= shiftDefs.length || dayIndex < 0 || dayIndex >= days.length) {
        return null
      }

      const shiftDef = shiftDefs[shiftIndex]
      const dayStr = getLocalDateString(days[dayIndex])

      return (
        slotsRef.current.find((slot) => {
          const slotDate = getLocalDateString(new Date(slot.shift_date))
          return slotDate === dayStr && slot.shift_definition_id === shiftDef.id
        }) || null
      )
    },
    [days, shiftDefs]
  )

  const selectedSlot = useMemo(() => {
    if (!selectedSlotId) return null
    return slots.find((slot) => slot.id === selectedSlotId) || null
  }, [selectedSlotId, slots])

  const calculateGuardShiftCounts = useCallback((assignmentRows: Assignment[], slotRows: Slot[]) => {
    const countMap = new Map<string, Map<string, number>>()

    for (const assignment of assignmentRows) {
      const slot = slotRows.find((s) => s.id === assignment.roster_slot_id)
      if (!slot) continue

      const dateStr = slot.shift_date
      if (!countMap.has(dateStr)) {
        countMap.set(dateStr, new Map())
      }

      const guardMap = countMap.get(dateStr)!
      guardMap.set(assignment.guard_id, (guardMap.get(assignment.guard_id) || 0) + 1)
    }

    setGuardShiftCounts(countMap)
  }, [])

  const fetchGuards = useCallback(async () => {
    const { data: roleMappings, error: roleError } = await supabase
      .from('role_mapping')
      .select('external_role')
      .eq('internal_role', 'guard')

    if (roleError) throw roleError

    const guardRoles = [...new Set((roleMappings || []).map((r: any) => r.external_role).filter(Boolean))]
    const fallbackRoles = ['SECURITY OFFICER', 'NEPALESE SECURITY OFFICER']
    const rolesToUse = guardRoles.length > 0 ? guardRoles : fallbackRoles

    const { data: guards, error: guardsError } = await supabase
      .from('users')
      .select('id, full_name, external_employee_code, external_role')
      .eq('is_active', true)
      .in('external_role', rolesToUse)
      .order('full_name')

    if (guardsError) throw guardsError

    setGuardsDirectory((guards || []) as Guard[])
  }, [])

  const syncSelection = useCallback(
    (nextSlots: Slot[], nextShiftDefs: ShiftDefinition[]) => {
      if (nextSlots.length === 0) {
        setSelectedSlotId(null)
        setSelectedCell({ shiftIndex: 0, dayIndex: 0 })
        return
      }

      const currentStillExists =
        selectedSlotId && nextSlots.some((slot) => slot.id === selectedSlotId)

      const slotToUse = currentStillExists
        ? nextSlots.find((slot) => slot.id === selectedSlotId) || nextSlots[0]
        : nextSlots[0]

      const shiftIndex = nextShiftDefs.findIndex((def) => def.id === slotToUse.shift_definition_id)
      const dayIndex = days.findIndex(
        (day) => getLocalDateString(day) === getLocalDateString(new Date(slotToUse.shift_date))
      )

      setSelectedSlotId(slotToUse.id)
      setSelectedCell({
        shiftIndex: shiftIndex >= 0 ? shiftIndex : 0,
        dayIndex: dayIndex >= 0 ? dayIndex : 0,
      })
    },
    [days, selectedSlotId]
  )

  const fetchSchedule = useCallback(
    async (actualSiteUUID: string) => {
      const startDate = getLocalDateString(weekStartDate)
      const endDate = getLocalDateString(weekEnd)
      console.log('Week start:', getLocalDateString(weekStartDate))
      console.log('Week end:', getLocalDateString(weekEnd))
      console.log('Start date for query:', startDate)
      console.log('End date for query:', endDate)
      const { data: slotsData, error: slotsError } = await supabase
        .from('roster_slots')
        .select('id, shift_date, start_time, end_time, shift_definition_id, site_id')
        .eq('site_id', actualSiteUUID)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate)

      if (slotsError) throw slotsError

      console.log('  slotsData returned:', slotsData?.length, 'slots')
      if (slotsData && slotsData.length > 0) {
        console.log('  Slots by date:')
        slotsData.forEach(slot => {
          console.log(`    ${slot.shift_date}: ${slot.id} (${slot.start_time} to ${slot.end_time})`)
        })
      }

      const { data: shiftDefsData, error: shiftDefsError } = await supabase
        .from('shift_definitions')
        .select('id, shift_name, shift_code, start_time, required_headcount, site_id')
        .eq('site_id', actualSiteUUID)
        .eq('is_active', true)
        .order('start_time', { ascending: true, nullsFirst: false })
        .order('shift_code', { ascending: true })

      if (shiftDefsError) throw shiftDefsError

      const slotIds = (slotsData || []).map((s) => s.id)
      let assignmentsData: Assignment[] = []

      if (slotIds.length > 0) {
        const { data, error: assignmentsError } = await supabase
          .from('shift_assignments')
          .select('id, roster_slot_id, guard_id, assignment_type, is_cancelled')
          .in('roster_slot_id', slotIds)
          .eq('is_cancelled', false)

        if (assignmentsError) throw assignmentsError
        assignmentsData = (data || []) as Assignment[]
      }

      const assignedGuardIds = [...new Set(assignmentsData.map((a) => a.guard_id))]
      const { data: guardsData, error: assignedGuardError } = assignedGuardIds.length
        ? await supabase
          .from('users')
          .select('id, full_name, external_employee_code, external_role')
          .in('id', assignedGuardIds)
        : { data: [], error: null }

      if (assignedGuardError) throw assignedGuardError

      const { data: leaveData, error: leaveError } = await supabase
        .from('leaves')
        .select('id, user_id, leave_date, leave_status')
        .gte('leave_date', startDate)
        .lte('leave_date', endDate)
        .eq('leave_status', 'Approved')

      if (leaveError) throw leaveError

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
    },
    [calculateGuardShiftCounts, syncSelection, weekEnd, weekStartDate]
  )

  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true)
        setError(null)

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', user.id)
            .single()

          if (userError) throw userError
          if (userData?.full_name) setManagerName(userData.full_name)
        }

        const { data: site, error: siteError } = await supabase
          .from('sites')
          .select('id, site_code, name')
          .eq('site_code', siteCode)
          .single()

        if (siteError || !site) {
          setError(`Site not found: ${siteCode}`)
          setLoading(false)
          return
        }

        const siteRecord = site as SiteRecord
        setSiteUUID(siteRecord.id)
        setSiteName(siteRecord.name || siteRecord.site_code)

        await Promise.all([fetchSchedule(siteRecord.id), fetchGuards()])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schedule')
      } finally {
        setLoading(false)
      }
    }

    initializeData()
  }, [fetchGuards, fetchSchedule, siteCode])

  useEffect(() => {
    if (!siteUUID) return

    fetchSchedule(siteUUID).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to refresh schedule')
    })
  }, [fetchSchedule, siteUUID, weekStartDate])

  const rosterGrid = useMemo(() => {
    const grid: RosterCell[][][] = Array.from({ length: shiftDefs.length }, () =>
      Array.from({ length: 7 }, () => [])
    )

    const slotMap = new Map(slots.map((s) => [s.id, s]))
    const guardMap = new Map(assignedGuardProfiles.map((g) => [g.id, g]))

    assignments.forEach((assignment) => {
      const slot = slotMap.get(assignment.roster_slot_id)
      if (!slot) return

      const guard = guardMap.get(assignment.guard_id)
      if (!guard) return

      const shiftIndex = shiftDefs.findIndex((def) => def.id === slot.shift_definition_id)
      const dayIndex = days.findIndex(
        (day) => getLocalDateString(day) === getLocalDateString(new Date(slot.shift_date))
      )

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

  const getRosterCell = useCallback(
    (shiftIndex: number, dayIndex: number): RosterCell[] => rosterGrid?.[shiftIndex]?.[dayIndex] || [],
    [rosterGrid]
  )

  const getRequiredHeadcountForSlot = useCallback(
    (slotId: string): number => {
      const slot = slotsRef.current.find((s) => s.id === slotId)
      if (!slot) return 0
      const shiftDef = shiftDefs.find((sd) => sd.id === slot.shift_definition_id)
      return shiftDef?.required_headcount || 0
    },
    [shiftDefs]
  )

  const realCoverageData = useMemo(() => {
    const coverage: number[] = []

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      let totalRequired = 0
      let totalFilled = 0

      for (let shiftIdx = 0; shiftIdx < shiftDefs.length; shiftIdx++) {
        const slot = getSlotForCell(shiftIdx, dayIdx)
        if (!slot) continue

        totalRequired += getRequiredHeadcountForSlot(slot.id)
        totalFilled += getRosterCell(shiftIdx, dayIdx).length
      }

      const percentage = totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 0
      coverage.push(percentage)
    }

    return coverage.length === 7 ? coverage : [0, 0, 0, 0, 0, 0, 0]
  }, [getRequiredHeadcountForSlot, getRosterCell, getSlotForCell, shiftDefs.length])

  const getSelectedCellData = useCallback((): SelectedCellData => {
    const shiftIndex = selectedCell.shiftIndex
    const dayIndex = selectedCell.dayIndex
    const slot = getSlotForCell(shiftIndex, dayIndex)

    const required = slot ? getRequiredHeadcountForSlot(slot.id) : 0
    const filled = slot
      ? assignments.filter((a) => a.roster_slot_id === slot.id).length
      : getRosterCell(shiftIndex, dayIndex).length

    const date = days[dayIndex] || new Date()
    const shiftDef = slot
      ? shiftDefs.find((sd) => sd.id === slot.shift_definition_id)
      : shiftDefs[shiftIndex] || null

    return {
      shift: shiftDef?.shift_name || 'Shift',
      time: slot ? formatTimeRange(slot.start_time, slot.end_time) : '—',
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
      }),
      filled,
      required,
      shiftIndex,
      dayIndex,
      hasSlot: !!slot,
    }
  }, [assignments, days, getRequiredHeadcountForSlot, getRosterCell, getSlotForCell, selectedCell, shiftDefs])

  const filteredGuards = useMemo(
    () => guardsDirectory.filter((guard) => guard.full_name.toLowerCase().includes(searchQuery.toLowerCase())),
    [guardsDirectory, searchQuery]
  )

  const getCoverageColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

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

  const getShiftNameForAssignment = (assignmentId: string): string | null => {
    const assignment = assignments.find((a) => a.id === assignmentId)
    if (!assignment) return null

    const slot = slotsRef.current.find((s) => s.id === assignment.roster_slot_id)
    if (!slot) return null

    const shiftDef = shiftDefs.find((sd) => sd.id === slot.shift_definition_id)
    return shiftDef?.shift_name || null
  }

  const parseTriggerError = (message: string): string => {
    if (message.includes('Headcount exceeded')) return 'This slot is already full.'
    if (message.includes('Guard is on approved leave')) return 'This guard is on approved leave on that date.'
    if (message.includes('Invalid assignment')) return 'The assignment falls outside the slot time window.'
    if (message.includes('no_double_booking') || message.includes('No double booking')) {
      return 'This guard is already assigned to another shift at this time.'
    }
    if (message.includes('adhoc_validation')) return 'Ad-hoc assignments require a reason.'
    return message
  }

  const saveAssignment = async () => {
    if (!selectedSlot || !selectedGuard || !siteUUID) return

    try {
      setSaving(true)

      const fullSlot = slotsRef.current.find((s) => s.id === selectedSlot.id)
      if (!fullSlot) {
        alert('No valid roster slot exists for this cell.')
        return
      }

      const { data: existingAssignment, error: existingError } = await supabase
        .from('shift_assignments')
        .select('id')
        .eq('roster_slot_id', fullSlot.id)
        .eq('guard_id', selectedGuard.id)
        .eq('is_cancelled', false)
        .single()

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError
      }

      if (existingAssignment) {
        alert('This guard is already assigned to this slot.')
        setSelectedGuard(null)
        setSearchQuery('')
        return
      }

      const { data: guardAssignments, error: guardAssignmentsError } = await supabase
        .from('shift_assignments')
        .select('id, roster_slot_id')
        .eq('guard_id', selectedGuard.id)
        .eq('is_cancelled', false)

      if (guardAssignmentsError) throw guardAssignmentsError

      const otherSlotIds = [...new Set((guardAssignments || []).map((a: any) => a.roster_slot_id).filter(Boolean))]

      let otherSlots: Slot[] = []
      if (otherSlotIds.length > 0) {
        const { data: otherSlotsData, error: otherSlotsError } = await supabase
          .from('roster_slots')
          .select('id, shift_date, start_time, end_time, shift_definition_id, site_id')
          .in('id', otherSlotIds)

        if (otherSlotsError) throw otherSlotsError
        otherSlots = (otherSlotsData || []) as Slot[]
      }

      // fullSlot.start_time and end_time are already full timestamptz from the database
      // No need to combine with shift_date — use them directly
      const newStart = new Date(fullSlot.start_time)
      const newEnd = new Date(fullSlot.end_time)
      if (newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1)
      }

      const overlaps = otherSlots.some((slot) => {
        if (slot.id === fullSlot.id) return false

        const slotStart = new Date(slot.start_time)
        const slotEnd = new Date(slot.end_time)
        if (slotEnd <= slotStart) {
          slotEnd.setDate(slotEnd.getDate() + 1)
        }

        return !(newEnd <= slotStart || newStart >= slotEnd)
      })

      if (overlaps) {
        alert('This guard is already assigned to another shift at this time.')
        return
      }

      console.log('saveAssignment:')
      console.log('  selectedSlot.id:', selectedSlot?.id)
      console.log('  fullSlot.id:', fullSlot?.id)
      console.log('  fullSlot.shift_date:', fullSlot?.shift_date)
      console.log('  fullSlot.start_time:', fullSlot?.start_time)
      console.log('  fullSlot.end_time:', fullSlot?.end_time)

      console.log('About to insert:')
      console.log('  roster_slot_id:', fullSlot.id)
      console.log('  site_id:', siteUUID)
      console.log('  guard_id:', selectedGuard.id)
      console.log('  start_time (raw):', fullSlot.start_time)
      console.log('  start_time (type):', typeof fullSlot.start_time)
      console.log('  end_time (raw):', fullSlot.end_time)
      console.log('  end_time (type):', typeof fullSlot.end_time)

      // fullSlot.start_time and end_time are already full timestamps from the database
      // No need to combine with shift_date — use them directly as-is
      const result = await supabase.from('shift_assignments').insert({
        roster_slot_id: fullSlot.id,
        site_id: siteUUID,
        guard_id: selectedGuard.id,
        start_time: fullSlot.start_time,
        end_time: fullSlot.end_time,
        assignment_type: 'planned',
        reason: null,
        is_cancelled: false,
      })

      if (result.error) {
        alert(parseTriggerError(result.error.message))
        return
      }

      setSelectedGuard(null)
      setSearchQuery('')
      await fetchSchedule(siteUUID)
    } catch (err) {
      console.error('[schedule] Error saving assignment:', err)
      alert('Failed to save assignment')
    } finally {
      setSaving(false)
    }
  }

  const cancelAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ is_cancelled: true })
        .eq('id', assignmentId)

      if (error) throw error
      if (siteUUID) await fetchSchedule(siteUUID)
    } catch (err) {
      console.error('[schedule] Error cancelling assignment:', err)
      alert('Failed to cancel assignment')
    }
  }

  const cellData = getSelectedCellData()
  const assignedGuards = getRosterCell(cellData.shiftIndex, cellData.dayIndex)

  return (
    <>
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{currentDateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{managerName}</p>
              <Badge variant="secondary" className="mt-1 bg-teal-100 text-teal-700">
                Manager
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-slate-600 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-8 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToSiteDetails}
          className="text-slate-600 hover:text-slate-900 pl-0"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Site Details
        </Button>
      </div>

      <div className="p-8 flex gap-8">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <p className="text-slate-600">Loading schedule...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center p-8">
            <p className="text-red-600">Error: {error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="flex-1">
              <div className="mb-6">
                <Badge className="bg-slate-100 text-slate-700 border-0 px-3 py-1 text-sm">
                  {siteCode}
                  {siteName ? ` · ${siteName}` : ''}
                </Badge>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600"
                    onClick={() => {
                      const prev = new Date(weekStart)
                      prev.setDate(prev.getDate() - 7)
                      setWeekStartDate(prev)
                    }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className="text-sm font-medium text-slate-900">
                    {weekStart.getDate()} – {weekEnd.getDate()}{' '}
                    {weekStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600"
                    onClick={() => {
                      const next = new Date(weekStart)
                      next.setDate(next.getDate() + 7)
                      setWeekStartDate(next)
                    }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <div className="w-32 shrink-0"></div>
                <div className="grid grid-cols-7 gap-2 flex-1">
                  {days.map((day, idx) => {
                    const isToday = getLocalDateString(day) === getLocalDateString(new Date())
                    const coverage = realCoverageData[idx] || 0
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                          }`}
                      >
                        <div className="text-xs font-semibold text-slate-700 mb-2">{dayNames[idx]}</div>
                        <div className={`text-lg font-bold ${getCoverageColor(coverage)}`}>{coverage}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <Card className="border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 w-32">Shift</th>
                        {days.map((day, idx) => {
                          const isToday = getLocalDateString(day) === getLocalDateString(new Date())
                          return (
                            <th
                              key={idx}
                              className={`px-4 py-3 text-center text-xs font-semibold ${isToday ? 'bg-blue-50' : ''
                                } text-slate-700`}
                            >
                              {dayNames[idx]}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {shiftDefs.map((shiftDef, shiftIdx) => (
                        <tr key={shiftDef.id} className="border-b border-slate-200">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                            <div>{shiftDef.shift_name}</div>
                            <div className="text-xs text-slate-600">{shiftDef.shift_code}</div>
                          </td>

                          {days.map((day, dayIdx) => {
                            const isToday = getLocalDateString(day) === getLocalDateString(new Date())
                            const slot = getSlotForCell(shiftIdx, dayIdx)
                            const isSelected = selectedSlot?.id === slot?.id
                            const cells = getRosterCell(shiftIdx, dayIdx)
                            const required = slot ? getRequiredHeadcountForSlot(slot.id) : 0
                            const filled = cells.length
                            const unfilled = Math.max(0, required - filled)

                            return (
                              <td
                                key={dayIdx}
                                onClick={() => {
                                  setSelectedCell({ shiftIndex: shiftIdx, dayIndex: dayIdx })
                                  setSelectedSlotId(slot?.id || null)
                                  setSelectedGuard(null)
                                }}
                                className={`px-4 py-3 text-center cursor-pointer transition ${isSelected ? 'bg-teal-50 border-2 border-teal-300' : isToday ? 'bg-blue-50' : ''
                                  }`}
                              >
                                <div className="space-y-1">
                                  {cells.map((cell, cellIdx) => {
                                    const dateStr = getLocalDateString(day)
                                    const guardMap = guardShiftCounts.get(dateStr) || new Map()
                                    const shiftCount = guardMap.get(cell.guardId) || 1

                                    return (
                                      <div
                                        key={cellIdx}
                                        className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(
                                          cell.assignmentType,
                                          shiftCount
                                        )}`}
                                      >
                                        {cell.guardName}
                                      </div>
                                    )
                                  })}

                                  {Array.from({ length: unfilled }).map((_, idx) => (
                                    <div
                                      key={`empty-${idx}`}
                                      className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(null)}`}
                                    >
                                      + assign
                                    </div>
                                  ))}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div>
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <strong>Shift Overload Warning:</strong> Guards highlighted in <strong>amber</strong>{' '}
                  are assigned to 2 shifts today. Guards in <strong>red</strong> are assigned to 3+ shifts
                  — please review.
                </div>

                <div className="flex flex-col gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                    <span>Green = Planned (1 shift)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div>
                    <span>Amber = Double shift (2 shifts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                    <span>Red = Triple shift (3+ shifts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-dashed border-slate-300"></div>
                    <span>Dashed = Unassigned slot</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-72 shrink-0">
              <Card className="border-slate-200 p-6 sticky top-8">
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {cellData.shift} — {cellData.date}
                </h3>

                <div className="text-sm text-slate-600 mb-4">
                  {cellData.time} · {siteCode} · {cellData.filled} of {cellData.required} filled
                </div>

                <div className="mb-4">
                  <div className="w-full bg-slate-200 rounded h-2">
                    <div
                      className="bg-teal-600 h-2 rounded transition-all"
                      style={{
                        width: `${cellData.required > 0 ? (cellData.filled / cellData.required) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {!cellData.hasSlot && (
                  <div className="mb-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    No roster slot exists for this shift/date.
                  </div>
                )}

                <div className="mb-6 pb-6 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Assigned</h4>
                  <div className="space-y-2">
                    {assignedGuards.map((cell, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{cell.guardName}</div>
                          <Badge
                            variant="secondary"
                            className={`text-xs mt-1 ${cell.assignmentType === 'planned'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                              }`}
                          >
                            {cell.assignmentType}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelAssignment(cell.assignmentId)}
                          className="text-slate-600 hover:text-red-600"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Add guard</h4>

                  <Input
                    type="text"
                    placeholder="Search guards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-4 text-sm"
                  />

                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {filteredGuards
                      .filter((guard) => {
                        const isAlreadyAssignedToThisSlot =
                          selectedSlot &&
                          assignments.some(
                            (a) => a.guard_id === guard.id && a.roster_slot_id === selectedSlot.id
                          )
                        return !isAlreadyAssignedToThisSlot
                      })
                      .map((guard) => {
                        const dateStr = selectedSlot
                          ? getLocalDateString(new Date(selectedSlot.shift_date))
                          : null

                        const isOnLeave =
                          !!dateStr &&
                          guardLeave.some((leave) => guard.id === leave.user_id && leave.leave_date === dateStr)

                        const assignmentOnOtherSlotToday =
                          !!dateStr &&
                          assignments.find((a) => {
                            const slotDate = slotsRef.current.find((s) => s.id === a.roster_slot_id)?.shift_date
                            const assignmentDateStr = slotDate
                              ? getLocalDateString(new Date(slotDate))
                              : null

                            return (
                              a.guard_id === guard.id &&
                              assignmentDateStr === dateStr &&
                              a.roster_slot_id !== selectedSlot?.id
                            )
                          })

                        const shiftNameForBadge = assignmentOnOtherSlotToday
                          ? getShiftNameForAssignment(assignmentOnOtherSlotToday.id)
                          : null

                        const isDisabled = isOnLeave
                        const isSelected = selectedGuard?.id === guard.id

                        return (
                          <button
                            key={guard.id}
                            onClick={() => !isDisabled && setSelectedGuard(guard)}
                            disabled={isDisabled}
                            className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition ${isDisabled
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : isSelected
                                ? 'bg-teal-50 text-teal-700 border-2 border-teal-300'
                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{guard.full_name}</span>
                              <div className="flex items-center gap-2">
                                {shiftNameForBadge && !isDisabled && (
                                  <Badge className="bg-teal-500 text-white text-xs">
                                    Assigned: {shiftNameForBadge}
                                  </Badge>
                                )}
                                {isOnLeave && <span className="text-xs text-red-600">(on leave)</span>}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                  </div>

                  {saving ? (
                    <Button disabled className="w-full bg-slate-400" size="sm">
                      Saving...
                    </Button>
                  ) : !cellData.hasSlot ? (
                    <Button disabled className="w-full bg-slate-300 text-slate-600" size="sm">
                      No Slot Available
                    </Button>
                  ) : cellData.required > 0 && cellData.filled >= cellData.required ? (
                    <div className="text-center text-sm text-amber-600 font-medium py-2 bg-amber-50 rounded">
                      Slot is full ({cellData.filled}/{cellData.required})
                    </div>
                  ) : (
                    <Button
                      onClick={saveAssignment}
                      disabled={!selectedGuard || !selectedSlot}
                      className="w-full bg-teal-600 hover:bg-teal-700"
                      size="sm"
                    >
                      Save
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
