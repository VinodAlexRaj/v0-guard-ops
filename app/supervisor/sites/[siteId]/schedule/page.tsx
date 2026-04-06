'use client'

import { useState, useEffect } from 'react'
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
  const [assignmentType, setAssignmentType] = useState('Planned')
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

  // Fetch schedule and guards data
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
      setSlots(slotsData)
      setShiftDefs(shiftDefsData || [])
      setAssignments(assignmentsData || [])
      setGuardNames(guardsData || [])
    } catch (err) {
      console.error('[v0] fetchSchedule error:', err)
      throw err
    }
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
    if (!selectedGuard || !siteUUID) return

    try {
      const cellData = getSelectedCellData()
      const slot = await getSlotForCell(cellData.shiftIndex, cellData.dayIndex, siteUUID)

      if (!slot) {
        alert('Could not find slot for this assignment')
        return
      }

      const { error } = await supabase.from('shift_assignments').insert({
        roster_slot_id: slot.id,
        site_id: siteUUID,
        guard_id: selectedGuard.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        assignment_type: assignmentType.toUpperCase(),
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

  async function getSlotForCell(shiftIndex: number, dayIndex: number, actualSiteUUID: string) {
    const shiftCode = shifts[shiftIndex]?.code
    const slotDate = days[dayIndex]
    const dateStr = slotDate.toISOString().split('T')[0]

    const { data: foundSlots } = await supabase
      .from('roster_slots')
      .select('id, start_time, end_time')
      .eq('site_id', actualSiteUUID)
      .eq('shift_date', dateStr)
      .order('start_time')
      .limit(1)

    return foundSlots?.[0]
  }

  function parseTriggerError(message: string): string {
    if (message.includes('Headcount exceeded')) return 'This slot is already full.'
    if (message.includes('Guard is on approved leave')) return 'This guard is on approved leave on that date.'
    if (message.includes('Invalid assignment')) return 'The assignment falls outside the slot time window.'
    if (message.includes('No double booking')) return 'This guard is already assigned during that time.'
    return message
  }

  function buildRosterGrid() {
    // Initialize grid: 3 shifts × 7 days
    const grid = [
      Array(7).fill(null).map(() => []),
      Array(7).fill(null).map(() => []),
      Array(7).fill(null).map(() => []),
    ]

    // Build lookup maps
    const slotMap = new Map(slots.map(s => [s.id, s]))
    const shiftDefMap = new Map(shiftDefs.map(s => [s.id, s]))
    const guardMap = new Map(guardNames.map(g => [g.id, g]))

    // Place assignments in grid
    assignments.forEach((assignment: any) => {
      const slot = slotMap.get(assignment.roster_slot_id)
      if (!slot) return

      const shiftDef = shiftDefMap.get(slot.shift_definition_id)
      if (!shiftDef) return

      const guard = guardMap.get(assignment.guard_id)
      if (!guard) return

      const shiftDate = new Date(slot.shift_date)
      const dayIndex = (shiftDate.getDay() + 6) % 7 // Convert Sunday=0 to Monday=0
      const shiftIndex = shifts.findIndex(s => s.code === shiftDef.shift_code)

      if (shiftIndex >= 0 && dayIndex >= 0 && dayIndex < 7) {
        grid[shiftIndex][dayIndex].push([
          guard.full_name,
          assignment.assignment_type.toLowerCase(),
          assignment.id,
        ])
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

  function getSelectedCellData() {
    const shiftIndex = selectedCell.shiftIndex
    const dayIndex = selectedCell.dayIndex
    const required = shifts[shiftIndex].required
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

  function getChipColor(status: string | null) {
    if (status === 'planned') return 'bg-green-100 text-green-700 border-0'
    if (status === 'replacement') return 'bg-amber-100 text-amber-700 border-0'
    if (status === 'adhoc') return 'bg-purple-100 text-purple-700 border-0'
    if (status === 'absent') return 'bg-red-100 text-red-700 border-0 line-through'
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
                const coverage = coverageData[idx]
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
                          const cells = getRosterCell(shiftIdx, dayIdx)
                          return (
                            <td
                              key={dayIdx}
                              onClick={() => setSelectedCell({ shiftIndex: shiftIdx, dayIndex: dayIdx })}
                              className={`px-4 py-3 text-center cursor-pointer transition ${
                                isSelected ? 'bg-teal-50 border-2 border-teal-300' : isToday ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="space-y-2">
                                {cells.map((cell, cellIdx) => (
                                  <div key={cellIdx}>
                            cell ? (
                              <div key={cellIdx} className="flex items-center justify-between">
                                <div className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(cell[1])}`}>
                                  {cell[0]}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => cancelAssignment(cell[2])}
                                  className="text-slate-400 hover:text-red-600 p-0 h-auto"
                                >
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <div key={cellIdx} className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(null)}`}>
                                + assign
                              </div>
                            )
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

            {/* Legend */}
            <div className="mt-6 flex gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                <span>Planned</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div>
                <span>Replacement</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
                <span>Ad-hoc</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                <span>Absent</span>
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

                      {/* Type Toggle */}
                      <div className="flex gap-2 mb-4">
                        {['Planned', 'Replace', 'Ad-hoc'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setAssignmentType(type)}
                            className={`flex-1 px-2 py-2 rounded text-xs font-medium transition ${
                              assignmentType === type
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

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
                          const isDisabled = guard.status !== 'available'
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
                                {guard.status !== 'available' && (
                                  <span className="text-xs text-slate-500">({guard.status})</span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {/* Save Button */}
                      <Button
                        onClick={saveAssignment}
                        disabled={!selectedGuard}
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        size="sm"
                      >
                        Save
                      </Button>
                    </div>
                  </>
                )
              })()}
            </Card>
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

                        {/* Type Toggle */}
                        <div className="flex gap-2 mb-4">
                          {['Planned', 'Replace', 'Ad-hoc'].map((type) => (
                            <button
                              key={type}
                              onClick={() => setAssignmentType(type)}
                              className={`flex-1 px-2 py-2 rounded text-xs font-medium transition ${
                                assignmentType === type
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

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
                            const isDisabled = guard.status !== 'available'
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
                                  {guard.status !== 'available' && (
                                    <span className="text-xs text-slate-500">({guard.status})</span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* Save Button */}
                        <Button
                          onClick={saveAssignment}
                          disabled={!selectedGuard}
                          className="w-full bg-teal-600 hover:bg-teal-700"
                          size="sm"
                        >
                          Save
                        </Button>
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
