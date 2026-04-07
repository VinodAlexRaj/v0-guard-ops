'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export default function SchedulePage() {
  const router = useRouter()
  const params = useParams()
  const siteId = params.siteId as string

  // State for transformed data
  const [selectedCell, setSelectedCell] = useState({ shiftIndex: 1, dayIndex: 2 }) // Wed Afternoon pre-selected
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGuard, setSelectedGuard] = useState<{ id: string; full_name: string; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<any[]>([])
  const [shiftDefs, setShiftDefs] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [guardNames, setGuardNames] = useState<any[]>([])
  const [guardsDirectory, setGuardsDirectory] = useState<any[]>([])
  const [siteUUID, setSiteUUID] = useState<string | null>(null)
  const [coverageData, setCoverageData] = useState<number[]>([100, 100, 100, 100, 100, 100, 100])
  const [guardShiftCounts, setGuardShiftCounts] = useState<Map<string, Map<string, number>>>(new Map()) // Map<dateStr, Map<guardId, count>>

  // Ref to maintain persistent reference to slots data
  const slotsRef = useRef<any[]>([])

  const handleSignOut = () => {
    router.push('/')
  }

  const handleBackToOverview = () => {
    router.push('/supervisor/overview')
  }

  const weekStart = new Date(2026, 3, 7) // April 7, 2026
  const weekEnd = new Date(2026, 3, 13) // April 13, 2026
  const today = new Date(2026, 3, 10) // April 10, 2026 (Thursday)

  const shifts = [
    { name: 'Morning', code: 'MRN', time: '06:00-14:00', required: 3 },
    { name: 'Afternoon', code: 'AFT', time: '14:00-22:00', required: 2 },
    { name: 'Night', code: 'NGT', time: '22:00-06:00', required: 2 },
  ]

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    return date
  })

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Initialize and fetch schedule data from Supabase
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true)
        // First, resolve the site UUID from site code
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

        console.log('[v0] Site lookup:', { siteCode: siteId, siteUUID: site.id })
        setSiteUUID(site.id)

        // Now fetch all data using the site UUID
        await Promise.all([fetchSchedule(site.id), fetchGuards()])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schedule')
        console.error('[v0] Error loading schedule:', err)
      } finally {
        setLoading(false)
      }
    }

    initializeData()
  }, [])

  async function fetchSchedule(actualSiteUUID: string) {
    try {
      console.log('[v0] fetchSchedule starting with siteUUID:', actualSiteUUID)

      // Query 1 — get roster slots
      const { data: slotsData, error: slotsError } = await supabase
        .from('roster_slots')
        .select('id, shift_date, start_time, end_time, shift_definition_id, site_id')
        .eq('site_id', actualSiteUUID)
        .gte('shift_date', '2026-04-07')
        .lte('shift_date', '2026-04-13')

      if (slotsError) throw slotsError
      if (!slotsData || slotsData.length === 0) {
        console.log('[v0] No slots found for site:', actualSiteUUID)
        setSlots([])
        return
      }

      console.log('[v0] Found slots:', slotsData.length)

      // Query 2 — get shift definitions for this site
      const { data: shiftDefsData, error: shiftDefsError } = await supabase
        .from('shift_definitions')
        .select('id, shift_name, shift_code, required_headcount')
        .eq('site_id', actualSiteUUID)
        .eq('is_active', true)

      if (shiftDefsError) throw shiftDefsError
      console.log('[v0] Found shift definitions:', shiftDefsData?.length || 0)

      // Query 3 — get assignments for these slots
      const slotIds = slotsData.map(s => s.id)
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('shift_assignments')
        .select('id, roster_slot_id, guard_id, assignment_type, is_cancelled')
        .in('roster_slot_id', slotIds)
        .eq('is_cancelled', false)

      if (assignmentsError) throw assignmentsError
      console.log('[v0] Found assignments:', assignmentsData?.length || 0)

      // Query 4 — get guard names
      const guardIds = [...new Set(assignmentsData?.map(a => a.guard_id) || [])]
      const { data: guardsData } = guardIds.length > 0
        ? await supabase
            .from('users')
            .select('id, full_name, external_employee_code')
            .in('id', guardIds)
        : { data: [] }

      console.log('[v0] Found guards:', guardsData?.length || 0)

      // Update state with separate data
      slotsRef.current = slotsData
      setSlots(slotsData)
      setShiftDefs(shiftDefsData || [])
      setAssignments(assignmentsData || [])
      setGuardNames(guardsData || [])

      // Calculate guard shift counts per day for shift overload warnings
      calculateGuardShiftCounts(assignmentsData || [], slotsData)
    } catch (err) {
      console.error('[v0] fetchSchedule error:', err)
      throw err
    }
  }

  function calculateGuardShiftCounts(assignmentsData: any[], slotsData: any[]) {
    const countMap = new Map<string, Map<string, number>>()

    // For each assignment, increment the count for that guard on that date
    assignmentsData.forEach((assignment: any) => {
      const slot = slotsData.find(s => s.id === assignment.roster_slot_id)
      if (!slot) return

      const dateStr = slot.shift_date // format: YYYY-MM-DD
      if (!countMap.has(dateStr)) {
        countMap.set(dateStr, new Map())
      }

      const guardMap = countMap.get(dateStr)!
      const currentCount = guardMap.get(assignment.guard_id) || 0
      guardMap.set(assignment.guard_id, currentCount + 1)
    })

    setGuardShiftCounts(countMap)
  }

  async function fetchGuards() {
    const { data: guards, error: guardsError } = await supabase
      .from('users')
      .select('id, full_name, external_employee_code')
      .eq('is_active', true)

    if (guardsError) throw guardsError

    const guardsList = (guards || []).map((g: any) => ({
      id: g.id,
      full_name: g.full_name,
      external_employee_code: g.external_employee_code,
      status: 'available',
    }))

    setGuardsDirectory(guardsList)
    setGuardNames(guardsList)
  }

  async function saveAssignment() {
    if (!selectedSlot || !selectedGuard || !siteUUID) return

    try {
      // Debug: Log what we're looking for
      console.log('[v0] saveAssignment called')
      console.log('[v0] slotsRef.current length:', slotsRef.current.length)
      console.log('[v0] looking for slot id:', selectedSlot?.id)
      console.log('[v0] slots ids:', slotsRef.current.map(s => s.id))

      // Find the full slot data from the slotsRef using selectedSlot.id
      const fullSlot = slotsRef.current.find(s => s.id === selectedSlot.id)

      if (!fullSlot) {
        console.error('[v0] Could not find slot data in slotsRef')
        alert('Could not find slot data')
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
        console.error('[v0] Save error:', error)
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

  function getSlotForCell(shiftIndex: number, dayIndex: number) {
    const targetShiftCode = shifts[shiftIndex]?.code
    const slot = slotsRef.current.find(s => {
      const slotDate = new Date(s.shift_date)
      const dayIndex_slot = (slotDate.getDay() + 6) % 7
      const shiftDef = shiftDefs.find(sd => sd.id === s.shift_definition_id)
      // Match using startsWith since DB has 'MRN-01' and we have 'MRN'
      return dayIndex_slot === dayIndex && shiftDef?.shift_code?.startsWith(targetShiftCode)
    })
    console.log('[v0] getSlotForCell:', { shiftIndex, dayIndex, targetShiftCode, foundSlotId: slot?.id })
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

  function buildRosterGrid() {
    // Initialize grid: 3 shifts × 7 days
    const grid: any[][][] = [
      Array(7).fill(null).map(() => []),
      Array(7).fill(null).map(() => []),
      Array(7).fill(null).map(() => []),
    ]

    // Build lookup maps
    const slotMap = new Map(slots.map(s => [s.id, s]))
    const shiftDefMap = new Map(shiftDefs.map(s => [s.id, s]))
    const guardMap = new Map(guardNames.map(g => [g.id, g]))

    console.log('[v0] buildRosterGrid called with:', {
      slotsCount: slots.length,
      shiftDefsCount: shiftDefs.length,
      assignmentsCount: assignments.length,
      guardNamesCount: guardNames.length,
      slotSample: slots.slice(0, 2),
      shiftDefsSample: shiftDefs,
    })

    // Place assignments in grid
    assignments.forEach((assignment: any) => {
      const slot = slotMap.get(assignment.roster_slot_id)
      if (!slot) {
        console.log('[v0] ❌ No slot found for assignment:', assignment.roster_slot_id)
        return
      }

      const shiftDef = shiftDefMap.get(slot.shift_definition_id)
      if (!shiftDef) {
        console.log('[v0] ❌ No shiftDef found for slot:', slot.shift_definition_id)
        return
      }

      const guard = guardMap.get(assignment.guard_id)
      if (!guard) {
        console.log('[v0] ❌ No guard found for assignment:', assignment.guard_id)
        return
      }

      const shiftDate = new Date(slot.shift_date)
      const dayIndex = (shiftDate.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
      
      // Match shift by checking if the database shift_code starts with our prefix
      // DB has 'MRN-01', we have 'MRN' - use startsWith for matching
      const shiftIndex = shifts.findIndex(s => shiftDef.shift_code.startsWith(s.code))

      console.log('[v0] Placing:', {
        guard: guard.full_name,
        type: assignment.assignment_type,
        dbShiftCode: shiftDef.shift_code,
        shiftIndex,
        dayIndex,
        dayName: dayNames[dayIndex],
      })

      if (shiftIndex >= 0 && dayIndex >= 0 && dayIndex < 7) {
        grid[shiftIndex][dayIndex].push([
          guard.full_name,
          assignment.assignment_type.toLowerCase(),
          assignment.id,
        ])
      }
    })

    // Log final grid state
    console.log('[v0] Grid built. Summary:')
    shifts.forEach((shift, shiftIdx) => {
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        if (grid[shiftIdx][dayIdx].length > 0) {
          console.log(`[v0]   ${shift.name} ${dayNames[dayIdx]}: ${grid[shiftIdx][dayIdx].map(c => c[0]).join(', ')}`)
        }
      }
    })

    return grid
  }

  function getRosterCell(shiftIndex: number, dayIndex: number) {
    const grid = buildRosterGrid()
    return grid?.[shiftIndex]?.[dayIndex] || []
  }

  function getAssignedCount(shiftIndex: number, dayIndex: number) {
    return getRosterCell(shiftIndex, dayIndex).filter((cell) => cell !== null && cell !== undefined).length
  }

  function getRequiredHeadcount(shiftIndex: number): number {
    // Try to get from database shift definitions first
    const targetShiftCode = shifts[shiftIndex]?.code
    const dbShiftDef = shiftDefs.find(sd => sd.shift_code?.startsWith(targetShiftCode))
    if (dbShiftDef?.required_headcount) {
      return dbShiftDef.required_headcount
    }
    // Fallback to hardcoded value
    return shifts[shiftIndex]?.required || 2
  }

  function getRequiredHeadcountForSlot(slotId: string): number {
    // Get required headcount for a specific slot by looking up its shift definition
    const slot = slotsRef.current.find(s => s.id === slotId)
    if (!slot) return 2
    
    const shiftDef = shiftDefs.find(sd => sd.id === slot.shift_definition_id)
    return shiftDef?.required_headcount || 2
  }

  // Calculate coverage percentages based on actual assignments
  function calculateCoverage(): number[] {
    const grid = buildRosterGrid()
    const coverage: number[] = []

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      let totalRequired = 0
      let totalFilled = 0

      for (let shiftIdx = 0; shiftIdx < shifts.length; shiftIdx++) {
        totalRequired += shifts[shiftIdx].required
        totalFilled += grid[shiftIdx][dayIdx].length
      }

      const percentage = totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 0
      coverage.push(percentage)
    }

    return coverage
  }

  // Get real coverage data
  const realCoverageData = assignments.length > 0 ? calculateCoverage() : coverageData

  function getSelectedCellData() {
    const shiftIndex = selectedCell.shiftIndex
    const dayIndex = selectedCell.dayIndex
    // Get required from the actual slot if available, otherwise use hardcoded
    const required = selectedSlot ? getRequiredHeadcountForSlot(selectedSlot.id) : shifts[shiftIndex].required
    const filled = getAssignedCount(shiftIndex, dayIndex)
    const date = days[dayIndex]
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' })
    return {
      shift: shifts[shiftIndex].name,
      time: shifts[shiftIndex].time,
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
    // For assigned guards, check shift overload count
    if (status) {
      if (shiftCount >= 3) return 'bg-red-100 text-red-700 border-0 font-semibold'
      if (shiftCount === 2) return 'bg-amber-100 text-amber-700 border-0 font-semibold'
      // Otherwise apply normal assignment type colors
      if (status === 'planned') return 'bg-green-100 text-green-700 border-0'
      if (status === 'replacement') return 'bg-amber-100 text-amber-700 border-0'
      if (status === 'adhoc') return 'bg-purple-100 text-purple-700 border-0'
      if (status === 'absent') return 'bg-red-100 text-red-700 border-0 line-through'
    }
    return 'border-2 border-dashed border-slate-300 text-slate-500'
  }

  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

  return (
    <>
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{dateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">Azri Hamdan</p>
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

            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="text-slate-600">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="text-sm font-medium text-slate-900">
                  {weekStart.getDate()} – {weekEnd.getDate()} Apr 2026
                </span>
                <Button variant="ghost" size="sm" className="text-slate-600">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-teal-600 border-teal-200">
                  Week
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-600">
                  Day
                </Button>
              </div>
            </div>

            {/* Coverage Strip */}
            <div className="grid grid-cols-7 gap-2 mb-6">
              {days.map((day, idx) => {
                const isToday = day.getTime() === today.getTime()
                const coverage = realCoverageData[idx]
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}
                  >
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      {dayNames[idx]} {day.getDate()}
                    </div>
                    <div className={`text-lg font-bold ${getCoverageColor(coverage)}`}>{coverage}%</div>
                  </div>
                )
              })}
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
                    {shifts.map((shift, shiftIdx) => (
                      <tr key={shiftIdx} className="border-b border-slate-200">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          <div>{shift.name}</div>
                          <div className="text-xs text-slate-600">{shift.time}</div>
                        </td>
                        {days.map((day, dayIdx) => {
                          const isToday = day.getTime() === today.getTime()
                          const isSelected = selectedCell.shiftIndex === shiftIdx && selectedCell.dayIndex === dayIdx
                          
                          // Find the slot for this shift/day
                          const targetShiftCode = shifts[shiftIdx]?.code
                          const dayStr = day.toISOString().split('T')[0]
                          const slot = slotsRef.current.find(s => {
                            const slotDate = new Date(s.shift_date).toISOString().split('T')[0]
                            const shiftDef = shiftDefs.find(sd => sd.id === s.shift_definition_id)
                            return slotDate === dayStr && shiftDef?.shift_code?.startsWith(targetShiftCode)
                          })
                          
                          const cells = getRosterCell(shiftIdx, dayIdx)
                          const required = slot ? getRequiredHeadcountForSlot(slot.id) : getRequiredHeadcount(shiftIdx)
                          const filled = cells.length
                          const unfilled = Math.max(0, required - filled)
                          
                          return (
                            <td
                              key={dayIdx}
                              onClick={() => {
                                setSelectedCell({ shiftIndex: shiftIdx, dayIndex: dayIdx })
                                setSelectedSlot(slot)
                              }}
                              className={`px-4 py-3 text-center cursor-pointer transition ${
                                isSelected ? 'bg-teal-50 border-2 border-teal-300' : isToday ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="space-y-1">
                                {/* Show assigned guard chips */}
                                {cells.map((cell, cellIdx) => {
                                  // Get shift count for this guard on this date
                                  const dateObj = days[dayIdx]
                                  const dateStr = dateObj.toISOString().split('T')[0]
                                  const guardMap = guardShiftCounts.get(dateStr) || new Map()
                                  const guardId = cell[2] ? assignments.find(a => a.id === cell[2])?.guard_id : null
                                  const shiftCount = guardId ? (guardMap.get(guardId) || 1) : 1
                                  
                                  return (
                                    <div key={cellIdx} className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(cell[1], shiftCount)}`}>
                                      {cell[0]}
                                    </div>
                                  )
                                })}
                                {/* Show "+ assign" chips for unfilled slots */}
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
              {/* Warning Note */}
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <strong>Shift Overload Warning:</strong> Guards highlighted in <strong>amber</strong> are assigned to 2 shifts today. Guards in <strong>red</strong> are assigned to 3+ shifts — please review.
              </div>

              {/* Legend */}
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

                      {/* Search Input */}
                      <Input
                        type="text"
                        placeholder="Search guards..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="mb-4 text-sm"
                      />

                      {/* Guard List */}
                      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                        {filteredGuards.map((guard) => {
                          // Check if guard is already assigned to selected slot
                          const isAlreadyAssigned = selectedSlot && assignments.some(
                            a => a.guard_id === guard.id && a.roster_slot_id === selectedSlot.id
                          )
                          const isDisabled = guard.status !== 'available' || isAlreadyAssigned
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
                              <div className="flex items-center justify-between">
                                <span>{guard.full_name}</span>
                                {isAlreadyAssigned ? (
                                  <span className="text-xs text-green-600">(assigned)</span>
                                ) : guard.status !== 'available' && (
                                  <span className="text-xs text-slate-500">({guard.status})</span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                        {/* Save Button */}
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
