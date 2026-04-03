'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, ChevronLeft, CheckCircle2 } from 'lucide-react'

export default function AttendancePage() {
  const router = useRouter()
  const params = useParams()
  const siteId = params.siteId as string

  const [activeShift, setActiveShift] = useState('Morning')
  const [attendanceData, setAttendanceData] = useState([
    {
      id: 1,
      name: 'Ahmad Razif',
      code: 'SO0042',
      checkIn: '06:04',
      checkOut: '14:01',
      status: 'on_time',
      remarks: '',
      saved: true,
    },
    {
      id: 2,
      name: 'Siti Norizan',
      code: 'SO0055',
      checkIn: '06:31',
      checkOut: '',
      status: 'late',
      remarks: 'Stuck in traffic',
      saved: true,
    },
    {
      id: 3,
      name: 'Rajan Muthu',
      code: 'SN0078',
      checkIn: '06:02',
      checkOut: '14:00',
      status: 'on_time',
      remarks: '',
      saved: true,
    },
    {
      id: 4,
      name: 'Kamal Aizuddin',
      code: 'SO0091',
      checkIn: '',
      checkOut: '',
      status: 'absent',
      remarks: 'No show, no contact',
      saved: false,
    },
    {
      id: 5,
      name: 'Hafiz Daud',
      code: 'SO0033',
      checkIn: '',
      checkOut: '',
      status: null,
      remarks: '',
      saved: false,
    },
  ])

  const handleSignOut = () => {
    router.push('/')
  }

  const handleBackToSchedule = () => {
    router.push(`/supervisor/sites/${siteId}/schedule`)
  }

  const updateAttendance = (id: number, field: string, value: any) => {
    setAttendanceData(
      attendanceData.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  const saveRow = (id: number) => {
    updateAttendance(id, 'saved', true)
  }

  const saveAllPending = () => {
    setAttendanceData(attendanceData.map((row) => ({ ...row, saved: true })))
  }

  const markAllOnTime = () => {
    setAttendanceData(
      attendanceData.map((row) => ({
        ...row,
        status: 'on_time',
        saved: true,
      }))
    )
  }

  const getStatusColor = (status: string | null) => {
    if (status === 'on_time') return 'bg-green-100 text-green-700 border-0'
    if (status === 'late') return 'bg-amber-100 text-amber-700 border-0'
    if (status === 'absent') return 'bg-red-100 text-red-700 border-0'
    if (status === 'MC') return 'bg-blue-100 text-blue-700 border-0'
    if (status === 'AL' || status === 'EL' || status === 'UL') return 'bg-purple-100 text-purple-700 border-0'
    return 'border border-slate-300 text-slate-600'
  }

  const statusOptions = ['on_time', 'late', 'absent', 'MC', 'AL', 'EL', 'UL']
  const statusLabels: Record<string, string> = {
    on_time: 'On time',
    late: 'Late',
    absent: 'Absent',
    MC: 'MC',
    AL: 'AL',
    EL: 'EL',
    UL: 'UL',
  }

  const shifts = [
    { name: 'Morning', time: '06-14' },
    { name: 'Afternoon', time: '14-22' },
    { name: 'Night', time: '22-06' },
  ]

  const savedCount = attendanceData.filter((r) => r.saved).length
  const pendingCount = attendanceData.filter((r) => !r.saved).length
  const onTimeCount = attendanceData.filter((r) => r.status === 'on_time').length
  const lateCount = attendanceData.filter((r) => r.status === 'late').length
  const absentCount = attendanceData.filter((r) => r.status === 'absent').length
  const onLeaveCount = attendanceData.filter((r) =>
    ['MC', 'AL', 'EL', 'UL'].includes(r.status)
  ).length
  const pendingStatusCount = attendanceData.filter((r) => !r.status).length

  const todayDate = new Date(2026, 3, 10) // April 10, 2026
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

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

      {/* Back Button */}
      <div className="border-b border-slate-200 bg-white px-8 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToSchedule}
          className="text-slate-600 hover:text-slate-900 pl-0"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Schedule
        </Button>
      </div>

      {/* Page Content */}
      <div className="p-8">
          {/* Title and Subtitle */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              Attendance — {siteId} Sentral Tower
            </h1>
            <p className="text-sm text-slate-600 mt-1">Fri, 10 Apr 2026</p>
          </div>

          {/* Shift Tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-200">
            {shifts.map((shift) => (
              <button
                key={shift.name}
                onClick={() => setActiveShift(shift.name)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                  activeShift === shift.name
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {shift.name} {shift.time}
              </button>
            ))}
          </div>

          {/* Summary Bar */}
          <Card className="border-slate-200 p-4 mb-6 flex items-center justify-between">
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-600"></div>
                <span className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{onTimeCount}</span> On time
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                <span className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{lateCount}</span> Late
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-600"></div>
                <span className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{absentCount}</span> Absent
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                <span className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{onLeaveCount}</span> On leave
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                <span className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{pendingStatusCount}</span> Pending
                </span>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              Recorded by: <span className="font-medium text-slate-900">Azri Hamdan</span>
            </div>
          </Card>

          {/* Attendance Table */}
          <Card className="border-slate-200 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Guard</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Check-in</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Check-out</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Remarks</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((row) => (
                    <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-600">{row.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Input
                          type="time"
                          value={row.checkIn}
                          onChange={(e) => updateAttendance(row.id, 'checkIn', e.target.value)}
                          className="w-24 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Input
                          type="time"
                          value={row.checkOut}
                          onChange={(e) => updateAttendance(row.id, 'checkOut', e.target.value)}
                          className="w-24 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {statusOptions.map((status) => (
                            <button
                              key={status}
                              onClick={() => updateAttendance(row.id, 'status', status)}
                              className={`px-2 py-1 rounded text-xs font-medium transition ${
                                row.status === status
                                  ? getStatusColor(status)
                                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {statusLabels[status]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Input
                          type="text"
                          value={row.remarks}
                          onChange={(e) => updateAttendance(row.id, 'remarks', e.target.value)}
                          placeholder="Add remarks"
                          className="text-sm max-w-xs"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {row.saved ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Saved</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => saveRow(row.id)}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                          >
                            Save
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Footer Bar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{attendanceData.length}</span> guards ·{' '}
              <span className="font-semibold text-slate-900">{savedCount}</span> saved ·{' '}
              <span className="font-semibold text-slate-900">{pendingCount}</span> pending
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={markAllOnTime}
                className="text-slate-700 border-slate-300 hover:bg-slate-50"
              >
                Mark all on time
              </Button>
              <Button
                size="sm"
                onClick={saveAllPending}
                disabled={pendingCount === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
              >
                Save all pending
              </Button>
            </div>
          </div>
        </div>
      </>
    )
  }
