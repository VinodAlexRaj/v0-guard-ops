'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react'

export default function SchedulePage() {
  const router = useRouter()
  const params = useParams()
  const siteId = params.siteId as string

  const [selectedCell, setSelectedCell] = useState({ shiftIndex: 1, dayIndex: 2 }) // Wed Afternoon pre-selected
  const [assignmentType, setAssignmentType] = useState('Planned')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGuard, setSelectedGuard] = useState<{ name: string; status: string } | null>(null)

  const handleSignOut = () => {
    router.push('/')
  }

  const handleBackToOverview = () => {
    router.push('/supervisor/overview')
  }

  // Mock data
  const siteNames: Record<string, string> = {
    'KLSNT01': 'Sentral Tower',
  }
  const siteName = siteNames[siteId] || 'Site'

  const weekStart = new Date(2026, 3, 7) // April 7, 2026
  const today = new Date(2026, 3, 10) // April 10, 2026 (Thursday)

  const shifts = [
    { name: 'Morning', time: '06:00-14:00', required: 3 },
    { name: 'Afternoon', time: '14:00-22:00', required: 2 },
    { name: 'Night', time: '22:00-06:00', required: 2 },
  ]

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    return date
  })

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const coverageData = [100, 100, 67, 33, 0, 100, 100]

  // Roster data structured as [shiftIndex][dayIndex] = array of [name, status, isAbsent]
  const roster = [
    [
      [['Ahmad R.', 'planned'], ['Siti N.', 'planned'], ['Rajan M.', 'planned']],
      [['Ahmad R.', 'planned'], ['Siti N.', 'planned'], ['Kamal A.', 'replacement']],
      [['Ahmad R.', 'planned'], ['Siti N.', 'planned'], null],
      [['Ahmad R.', 'absent'], null, null],
      [null, null, null],
      [['Ahmad R.', 'planned'], ['Siti N.', 'planned'], ['Rajan M.', 'planned']],
      [['Ahmad R.', 'planned'], ['Siti N.', 'planned'], ['Rajan M.', 'planned']],
    ],
    [
      [['Lim C.H.', 'planned'], ['Nora B.', 'planned']],
      [['Lim C.H.', 'planned'], ['Nora B.', 'planned']],
      [['Lim C.H.', 'planned'], null],
      [null, null],
      [null, null],
      [['Lim C.H.', 'planned'], ['Nora B.', 'planned']],
      [['Lim C.H.', 'planned'], ['Nora B.', 'planned']],
    ],
    [
      [['Hafiz D.', 'planned'], ['Mei L.', 'planned']],
      [['Hafiz D.', 'planned'], ['Mei L.', 'planned']],
      [['Hafiz D.', 'planned'], ['Mei L.', 'planned']],
      [['Hafiz D.', 'planned'], ['Mei L.', 'planned']],
      [null, null],
      [['Hafiz D.', 'planned'], ['Mei L.', 'planned']],
      [['Hafiz D.', 'planned'], ['Mei L.', 'planned']],
    ],
  ]

  const guardsDirectory = [
    { name: 'Nora B.', status: 'available' },
    { name: 'Rajan M.', status: 'available' },
    { name: 'Kamal A.', status: 'available' },
    { name: 'Siti N.', status: 'on leave' },
    { name: 'Ahmad R.', status: 'double-booked' },
  ]

  const getCoverageColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100 text-green-700'
    if (percentage >= 50) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  const getChipColor = (status: string | null) => {
    if (status === 'planned') return 'bg-green-100 text-green-700 border-0'
    if (status === 'replacement') return 'bg-amber-100 text-amber-700 border-0'
    if (status === 'adhoc') return 'bg-purple-100 text-purple-700 border-0'
    if (status === 'absent') return 'bg-red-100 text-red-700 border-0 line-through'
    return 'border-2 border-dashed border-slate-300 text-slate-500'
  }

  const getRosterCell = (shiftIndex: number, dayIndex: number) => {
    return roster[shiftIndex][dayIndex] || []
  }

  const getAssignedCount = (shiftIndex: number, dayIndex: number) => {
    return getRosterCell(shiftIndex, dayIndex).filter((cell) => cell !== null).length
  }

  const getSelectedCellData = () => {
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
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' })}
            </div>
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
          <div className="flex-1">
            {/* Site Pill */}
            <div className="mb-6">
              <Badge className="bg-slate-100 text-slate-700 border-0 px-3 py-1 text-sm">
                {siteId} — {siteName}
              </Badge>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="text-slate-600">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="text-sm font-medium text-slate-900">
                  {days[0].getDate()} – {days[6].getDate()} Apr 2026
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
                                    {cell ? (
                                      <div className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(cell[1])}`}>
                                        {cell[0]}
                                      </div>
                                    ) : (
                                      <div className={`px-2 py-1 rounded text-xs font-medium ${getChipColor(null)}`}>
                                        + assign
                                      </div>
                                    )}
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
                                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-red-600">
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
                        {filteredGuards.map((guard, idx) => {
                          const isDisabled = guard.status === 'on leave' || guard.status === 'double-booked'
                          const isSelected = selectedGuard?.name === guard.name
                          return (
                            <button
                              key={idx}
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
                                <span>{guard.name}</span>
                                {guard.status !== 'available' && (
                                  <span className="text-xs text-slate-500">
                                    {guard.status === 'on leave' ? '(on leave)' : '(double-booked)'}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {/* Save Button */}
                      <Button className="w-full bg-teal-600 hover:bg-teal-700" disabled={!selectedGuard} size="sm">
                        Save
                      </Button>
                    </div>
                  </>
                )
              })()}
            </Card>
          </div>
        </div>
      </>
    )
}
