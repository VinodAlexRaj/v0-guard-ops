'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'

// Type definitions
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
  required_headcount: number
  site_id: string
}

interface Assignment {
  id: string
  roster_slot_id: string
  guard_id: string
  assignment_type: string
  is_cancelled: boolean
}

interface Guard {
  id: string
  full_name: string
  external_employee_code: string
  external_role: string
}

export default function SchedulePage() {
  const router = useRouter()
  const params = useParams()
  const siteId = params.siteId as string

  // Helper function to get the Monday of a given week
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // State for transformed data
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week')
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getWeekStart(new Date()))
  const [dayViewDate, setDayViewDate] = useState<Date>(new Date())
  const [selectedCell, setSelectedCell] = useState({ shiftIndex: 1, dayIndex: 2 })
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [guardNames, setGuardNames] = useState<Guard[]>([])
  const [guardsDirectory, setGuardsDirectory] = useState<Guard[]>([])
  const [siteUUID, setSiteUUID] = useState<string | null>(null)
  const [guardShiftCounts, setGuardShiftCounts] = useState<Map<string, Map<string, number>>>(new Map())
  const [guardLeave, setGuardLeave] = useState<any[]>([])
  const [supervisorName, setSupervisorName] = useState('Supervisor')
  const [currentDateStr, setCurrentDateStr] = useState('')

  const slotsRef = useRef<Slot[]>([])

  const handleSignOut = () => {
    router.push('/')
  }

  const handleBackToOverview = () => {
    router.push('/supervisor/overview')
  }

  const weekStart = weekStartDate
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const today = new Date()

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    return date
  })

  const dayNames = days.map(date => {
    const dayName = date.toLocaleDateString('en-MY', { weekday: 'short' })
    const dayNum = date.getDate()
    return `${dayName} ${dayNum}`
  })

  // Initialize and fetch schedule data from Supabase
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true)
        
        // Set current date string
        const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })
        setCurrentDateStr(dateStr)

        // Get logged-in user
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', user.id)
            .single()
          if (userData?.full_name) setSupervisorName(userData.full_name)
        }

        // Resolve site UUID from site code
        const { data: site, error: siteError } = await supabase
          .from('sites')
          .select('id')
          .eq('site_code', siteId.toUpperCase())
          .single()

        if (siteError || !site) {
          setError('Site not found: ' + siteId)
          setLoading(false)
          return
        }

        setSiteUUID(site.id)

        // Fetch all data using the site UUID
        await Promise.all([fetchSchedule(site.id), fetchGuards(site.id)])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schedule')
      } finally {
        setLoading(false)
      }
    }

    initializeData()
  }, [])

  // Refetch schedule when week changes
  useEffect(() => {
    if (siteUUID) {
      fetchSchedule(siteUUID)
    }
  }, [weekStartDate, siteUUID])

  async function fetchSchedule(actualSiteUUID: string) {
    try {
      const startDate = getLocalDateString(weekStart)
      const endDate = getLocalDateString(weekEnd)

      // Query 1 — get roster slots for the selected week
      const { data: slotsData, error: slotsError } = await supabase
        .from('roster_slots')
        .select('id, shift_date, start_time, end_time, shift_definition_id, site_id')
        .eq('site_id', actualSiteUUID)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate)

      if (slotsError) throw slotsError

      // Query 2 — get shift definitions for this site
      const { data: shiftDefsData, error: shiftDefsError } = await supabase
        .from('shift_definitions')
        .select('id, shift_name, shift_code, required_headcount, site_id')
        .eq('site_id', actualSiteUUID)
        .eq('is_active', true)

      if (shiftDefsError) throw shiftDefsError

      // Query 3 — get assignments for these slots (skip if no slots)
      const slotIds = (slotsData || []).map(s => s.id)
      let assignmentsData: Assignment[] = []
      
      if (slotIds.length > 0) {
        const { data, error: assignmentsError } = await supabase
          .from('shift_assignments')
          .select('id, roster_slot_id, guard_id, assignment_type, is_cancelled')
          .in('roster_slot_id', slotIds)
          .eq('is_cancelled', false)

        if (assignmentsError) throw assignmentsError
        assignmentsData = data || []
      }

      // Query 4 — get names for assigned users
      const guardIds = [...new Set((assignmentsData || []).map(a => a.guard_id))]
      const { data: guardsData } = guardIds.length > 0
        ? await supabase
            .from('users')
            .select('id, full_name, external_employee_code, external_role')
            .in('id', guardIds)
        : { data: [] }

      // Query 5 — get guard leave records for this week
      const { data: leaveData } = await supabase
        .from('leaves')
        .select('id, user_id, leave_date, leave_status')
        .gte('leave_date', startDate)
        .lte('leave_date', endDate)
        .eq('leave_status', 'Approved')

      // Update state
      slotsRef.current = slotsData || []
      setSlots(slotsData || [])
      setShiftDefs(shiftDefsData || [])
      setAssignments(assignmentsData || [])
      setGuardNames(guardsData || [])
      setGuardLeave(leaveData || [])

      // Calculate guard shift counts per day
      calculateGuardShiftCounts(assignmentsData || [], slotsData || [])
    } catch (err) {
      console.error('[v0] fetchSchedule error:', err)
      throw err
    }
  }

  function calculateGuardShiftCounts(assignmentsData: Assignment[], slotsData: Slot[]) {
    const countMap = new Map<string, Map<string, number>>()

    assignmentsData.forEach((assignment: Assignment) => {
      const slot = slotsData.find(s => s.id === assignment.roster_slot_id)
      if (!slot) return

      const dateStr = slot.shift_date
      if (!countMap.has(dateStr)) {
        countMap.set(dateStr, new Map())
      }

      const guardMap = countMap.get(dateStr)!
      const currentCount = guardMap.get(assignment.guard_id) || 0
      guardMap.set(assignment.guard_id, currentCount + 1)
    })

    setGuardShiftCounts(countMap)
  }

  function getShiftNameForAssignment(assignmentId: string): string | null {
    const assignment = assignments.find(a => a.id === assignmentId)
    if (!assignment) return null

    const slot = slotsRef.current.find(s => s.id === assignment.roster_slot_id)
    if (!slot) return null

    const shiftDef = shiftDefs.find(sd => sd.id === slot.shift_definition_id)
    return shiftDef?.shift_name || null
  }

  async function fetchGuards(actualSiteUUID: string) {
    try {
      // Use role_mapping table to get guards
      const { data: roleMappings } = await supabase
        .from('role_mapping')
        .select('external_role')
        .eq('internal_role', 'guard')

      const guardRoles = [...new Set((roleMappings || []).map(r => r.external_role))]

      const { data: guards, error: guardsError } = await supabase
        .from('users')
        .select('id, full_name, external_employee_code, external_role')
        .eq('is_active', true)
        .in('external_role', guardRoles.length > 0 ? guardRoles : ['SECURITY OFFICER', 'NEPALESE SECURITY OFFICER'])

      if (guardsError) throw guardsError

      const guardsList = (guards || []).map((g: Guard) => ({
        id: g.id,
        full_name: g.full_name,
        external_employee_code: g.external_employee_code,
        external_role: g.external_role,
      }))

      setGuardsDirectory(guardsList)
    } catch (err) {
      console.error('[v0] fetchGuards error:', err)
    }
  }

  async function saveAssignment() {
    if (!selectedSlot || !selectedGuard || !siteUUID) return

    try {
      const fullSlot = slotsRef.current.find(s => s.id === selectedSlot.id)
      if (!fullSlot) {
        alert('Could not find slot data')
        return
      }

      // Check if already assigned to this slot
      const { data: existingAssignment } = await supabase
        .from('shift_assignments')
        .select('id')
        .eq('roster_slot_id', fullSlot.id)
        .eq('guard_id', selectedGuard.id)
        .eq('is_cancelled', false)
        .single()

      if (existingAssignment) {
        alert('This guard is already assigned to this slot.')
        setSelectedGuard(null)
        setSearchQuery('')
        return
      }

      // Check for overlapping assignments
      const { data: overlappingAssignments } = await supabase
        .from('shift_assignments')
        .select('id, roster_slot_id')
        .eq('guard_id', selectedGuard.id)
        .eq('is_cancelled', false)

      const overlaps = (overlappingAssignments || []).some(a => {
        const slot = slotsRef.current.find(s => s.id === a.roster_slot_id)
        if (!slot) return false
        return (
          slot.shift_date === fullSlot.shift_date &&
          slot.start_time < fullSlot.end_time &&
          slot.end_time > fullSlot.start_time
        )
      })

      if (overlaps) {
        alert('This guard is already assigned to another shift at this time.')
        return
      }

      const { error } = await supabase.from('shift_assignments').insert({
        roster_slot_id: fullSlot.id,
        site_id: siteUUID,
        guard_id: selectedGuard.id,
        start_time: fullSlot.start_time,
        end_time: fullSlot.end_time,
        assignment_type: 'planned',
        reason: null,
        is_cancelled: false,
      })

      if (error) {
        alert(parseTriggerError(error.message))
        return
      }

      setSelectedGuard(null)
      setSearchQuery('')
      await fetchSchedule(siteUUID)
    } catch (err) {
      console.error('[v0] Error saving assignment:', err)
      alert('Failed to save assignment')
    }
  }

  async function cancelAssignment(assignmentId: string) {
    try {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ is_cancelled: true })
        .eq('id', assignmentId)

      if (error) throw error
      if (siteUUID) {
        await fetchSchedule(siteUUID)
      }
    } catch (err) {
      console.error('[v0] Error cancelling assignment:', err)
      alert('Failed to cancel assignment')
    }
  }

  function getSlotForCell(shiftIndex: number, dayIndex: number): Slot | null {
    const dayStr = getLocalDateString(days[dayIndex])
    const slot = slotsRef.current.find(s => {
      const slotDate = getLocalDateString(new Date(s.shift_date))
      return slotDate === dayStr
    })
    return slot || null
  }

  function parseTriggerError(message: string): string {
    if (message.includes('Headcount exceeded')) return 'This slot is already full.'
    if (message.includes('Guard is on approved leave')) return 'This guard is on approved leave on that date.'
    if (message.includes('Invalid assignment')) return 'The assignment falls outside the slot time window.'
    if (message.includes('no_double_booking') || message.includes('No double booking')) return 'This guard is already assigned to another shift at this time.'
    if (message.includes('adhoc_validation')) return 'Ad-hoc assignments require a reason.'
    return message
  }

  // Memoized roster grid computation
  const rosterGrid = useMemo(() => {
    const grid: any[][][] = [
      Array(7).fill(null).map(() => []),
      Array(7).fill(null).map(() => []),
      Array(7).fill(null).map(() => []),
    ]

    const slotMap = new Map(slots.map(s => [s.id, s]))
    const shiftDefMap = new Map(shiftDefs.map(s => [s.id, s]))
    const guardMap = new Map(guardNames.map(g => [g.id, g]))

    assignments.forEach((assignment: Assignment) => {
      const slot = slotMap.get(assignment.roster_slot_id)
      if (!slot) return

      const shiftDef = shiftDefMap.get(slot.shift_definition_id)
      if (!shiftDef) return

      const guard = guardMap.get(assignment.guard_id)
      if (!guard) return

      const shiftDate = new Date(slot.shift_date)
      const dayIndex = (shiftDate.getDay() + 6) % 7

      const shiftIndex = shiftDefs.findIndex(s => s.id === slot.shift_definition_id)

      if (shiftIndex >= 0 && dayIndex >= 0 && dayIndex < 7) {
        grid[shiftIndex][dayIndex].push([
          guard.full_name,
          assignment.assignment_type.toLowerCase(),
          assignment.id,
        ])
      }
    })

    return grid
  }, [slots, shiftDefs, assignments, guardNames])

  function getRosterCell(shiftIndex: number, dayIndex: number) {
    return rosterGrid?.[shiftIndex]?.[dayIndex] || []
  }

  function getAssignedCount(shiftIndex: number, dayIndex: number) {
    return getRosterCell(shiftIndex, dayIndex).filter(cell => cell !== null && cell !== undefined).length
  }

  function getRequiredHeadcount(shiftIndex: number): number {
    const slot = getSlotForCell(shiftIndex, 0)
    if (slot) {
      const shiftDef = shiftDefs.find(sd => sd.id === slot.shift_definition_id)
      if (shiftDef?.required_headcount) {
        return shiftDef.required_headcount
      }
    }
    return 2
  }

  function getRequiredHeadcountForSlot(slotId: string): number {
    const slot = slotsRef.current.find(s => s.id === slotId)
    if (!slot) return 2

    const shiftDef = shiftDefs.find(sd => sd.id === slot.shift_definition_id)
    return shiftDef?.required_headcount || 2
  }

  function calculateCoverage(): number[] {
    const coverage: number[] = []

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      let totalRequired = 0
      let totalFilled = 0

      for (let shiftIdx = 0; shiftIdx < shiftDefs.length; shiftIdx++) {
        const slot = getSlotForCell(shiftIdx, dayIdx)
        const required = slot ? getRequiredHeadcountForSlot(slot.id) : 2
        const filled = getRosterCell(shiftIdx, dayIdx).length

        totalRequired += required
        totalFilled += filled
      }

      const percentage = totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 0
      coverage.push(percentage)
    }

    return coverage
  }

  const realCoverageData = assignments.length > 0 ? calculateCoverage() : [100, 100, 100, 100, 100, 100, 100]

  function getSelectedCellData() {
    const shiftIndex = selectedCell.shiftIndex
    const dayIndex = selectedCell.dayIndex
    const required = selectedSlot ? getRequiredHeadcountForSlot(selectedSlot.id) : 2
    const filled = selectedSlot
      ? assignments.filter(a => a.roster_slot_id === selectedSlot.id).length
      : getAssignedCount(shiftIndex, dayIndex)
    const date = days[dayIndex]
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' })
    
    const slot = getSlotForCell(shiftIndex, dayIndex)
    const shiftDef = slot ? shiftDefs.find(sd => sd.id === slot.shift_definition_id) : null

    return {
      shift: shiftDef?.shift_name || 'Shift',
      time: slot ? `${slot.start_time}–${slot.end_time}` : '00:00–00:00',
      date: dateStr,
      filled,
      required,
      dayIndex,
      shiftIndex,
    }
  }

  const filteredGuards = guardsDirectory.filter((g) =>
    g.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function getCoverageColor(percentage: number) {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  function getChipColor(status: string | null, shiftCount: number = 1) {
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

  return (
    <>
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{currentDateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{supervisorName}</p>
              <Badge variant="secondary" className="mt-1">
                Supervisor
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-600 hover:text-slate-900">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Back Button */}
      <div className="border-b border-slate-200 bg-white px-8 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToOverview}
          className="text-slate-600 hover:text-slate-900 pl-0"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Overview
        </Button>
      </div>

      {/* Schedule Content */}
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
              {/* Site Pill */}
              <div className="mb-6">
                <Badge className="bg-slate-100 text-slate-700 border-0 px-3 py-1 text-sm">
                  {siteId}
                </Badge>
              </div>

              {/* Week / Day Navigation */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <>
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
                      {weekStart.getDate()} – {weekEnd.getDate()} {weekStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
                  </>
                </div>
              </div>

              {/* Coverage Strip */}
              <div className="flex gap-2 mb-6">
                <div className="w-32 flex-shrink-0"></div>
                <div className="grid grid-cols-7 gap-2 flex-1">
                  {days.map((day, idx) => {
                    const isToday = day.getTime() === today.getTime()
                    const coverage = realCoverageData[idx]
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}
                      >
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          {dayNames[idx]}
                        </div>
                        <div className={`text-lg font-bold ${getCoverageColor(coverage)}`}>{coverage}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Roster Grid */}
              <Card className="border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 w-32">Shift</th>
                        {days.map((day, idx) => {
                          const isToday = day.getTime() === today.getTime()
                          return (
                            <th
                              key={idx}
                              className={`px-4 py-3 text-center text-xs font-semibold ${isToday ? 'bg-blue-50' : ''} text-slate-700`}
                            >
                              {dayNames[idx]} {day.getDate()}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {shiftDefs.map((shiftDef, shiftIdx) => (
                        <tr key={shiftIdx} className="border-b border-slate-200">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                            <div>{shiftDef.shift_name}</div>
                            <div className="text-xs text-slate-600">{`${shiftDef.shift_code}`}</div>
                          </td>
                          {days.map((day, dayIdx) => {
                            const isToday = day.getTime() === today.getTime()
                            const dayStr = getLocalDateString(day)
                            const slot = slotsRef.current.find(s => {
                              const slotDate = getLocalDateString(new Date(s.shift_date))
                              return slotDate === dayStr && s.shift_definition_id === shiftDef.id
                            })
                            const isSelected = selectedSlot?.id === slot?.id
                            const cells = getRosterCell(shiftIdx, dayIdx)
                            const required = slot ? getRequiredHeadcountForSlot(slot.id) : shiftDef.required_headcount
                            const filled = cells.length
                            const unfilled = Math.max(0, required - filled)

                            return (
                              <td
                                key={dayIdx}
                                onClick={() => {
                                  setSelectedCell({ shiftIndex: shiftIdx, dayIndex: dayIdx })
                                  setSelectedSlot(slot || null)
                                }}
                                className={`px-4 py-3 text-center cursor-pointer transition ${
                                  isSelected ? 'bg-teal-50 border-2 border-teal-300' : isToday ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="space-y-1">
                                  {cells.map((cell, cellIdx) => {
                                    const dateStr = getLocalDateString(day)
                                    const guardMap = guardShiftCounts.get(dateStr) || new Map()
                                    const guardId = cell[2] ? assignments.find(a => a.id === cell[2])?.guard_id : null
                                    const shiftCount = guardId ? (guardMap.get(guardId) || 1) : 1
                                    return (
                                      <div key={cellIdx} className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(cell[1], shiftCount)}`}>
                                        {cell[0]}
                                      </div>
                                    )
                                  })}
                                  {Array.from({ length: unfilled }).map((_, idx) => (
                                    <div key={`empty-${idx}`} className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(null)}`}>
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

              {/* Legend & Warning */}
              <div>
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <strong>Shift Overload Warning:</strong> Guards highlighted in <strong>amber</strong> are assigned to 2 shifts today. Guards in <strong>red</strong> are assigned to 3+ shifts — please review.
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

            {/* Right Panel */}
            <div className="w-72 flex-shrink-0">
              <Card className="border-slate-200 p-6 sticky top-8">
                {(() => {
                  const cellData = getSelectedCellData()
                  const assignedGuards = getRosterCell(cellData.shiftIndex, cellData.dayIndex)
                  return (
                    <>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">
                        {cellData.shift} — {cellData.date}
                      </h3>
                      <div className="text-sm text-slate-600 mb-4">
                        {cellData.time} · {siteId} · {cellData.filled} of {cellData.required} filled
                      </div>

                      {/* Headcount Bar */}
                      <div className="mb-4">
                        <div className="w-full bg-slate-200 rounded h-2">
                          <div
                            className="bg-teal-600 h-2 rounded transition-all"
                            style={{ width: `${(cellData.filled / cellData.required) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Assigned Section */}
                      <div className="mb-6 pb-6 border-b border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-900 mb-3">Assigned</h4>
                        <div className="space-y-2">
                          {assignedGuards.map(
                            (cell, idx) =>
                              cell && (
                                <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded">
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">{cell[0]}</div>
                                    <Badge
                                      variant="secondary"
                                      className={`text-xs mt-1 ${
                                        cell[1] === 'planned' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {cell[1]}
                                    </Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelAssignment(cell[2])}
                                    className="text-slate-600 hover:text-red-600"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              )
                          )}
                        </div>
                      </div>

                      {/* Add Guard Section */}
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
                            .filter(guard => {
                              const isAlreadyAssignedToThisSlot = selectedSlot && assignments.some(
                                a => a.guard_id === guard.id && a.roster_slot_id === selectedSlot.id
                              )
                              return !isAlreadyAssignedToThisSlot
                            })
                            .map((guard) => {
                              const dateStr = selectedSlot ? getLocalDateString(new Date(selectedSlot.shift_date)) : null

                              const isOnLeave = dateStr && guardLeave.some(leave => {
                                const leaveDate = leave.leave_date
                                return guard.id === leave.user_id && leaveDate === dateStr
                              })

                              const assignmentOnOtherSlotToday = dateStr && assignments.find(a => {
                                const slotDate = slotsRef.current.find(s => s.id === a.roster_slot_id)?.shift_date
                                const assignmentDateStr = slotDate ? getLocalDateString(new Date(slotDate)) : null
                                return a.guard_id === guard.id &&
                                  assignmentDateStr === dateStr &&
                                  a.roster_slot_id !== selectedSlot?.id
                              })

                              const shiftNameForBadge = assignmentOnOtherSlotToday ? getShiftNameForAssignment(assignmentOnOtherSlotToday.id) : null

                              const isDisabled = isOnLeave
                              const isSelected = selectedGuard?.id === guard.id

                              return (
                                <button
                                  key={guard.id}
                                  onClick={() => !isDisabled && setSelectedGuard(guard)}
                                  disabled={isDisabled}
                                  className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition ${
                                    isDisabled
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
                                      {isOnLeave && (
                                        <span className="text-xs text-red-600">(on leave)</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                        </div>

                        {cellData.filled >= cellData.required ? (
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
                    </>
                  )
                })()}
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
