'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LogOut } from 'lucide-react'

export default function SupervisorLeavesPage() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')

  const handleSignOut = () => {
    router.push('/')
  }

  const todayDate = new Date(2026, 3, 10) // April 10, 2026
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

  // Mock data for summary stats
  const summaryStats = [
    { label: 'On leave today', value: 2, color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-600' },
    { label: 'AL this month', value: 8, color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-600' },
    { label: 'MC this month', value: 3, color: 'bg-red-50 border-red-200', textColor: 'text-red-600' },
    { label: 'EL this month', value: 2, color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-600' },
  ]

  // Week data - Mon 7 to Sun 13 Apr
  const weekStart = new Date(2026, 3, 7)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    return date
  })
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Guards with leave this week
  const guardLeaves = [
    {
      id: 1,
      name: 'Nora Baharom',
      code: 'SO0004',
      leaves: [null, null, null, 'AL', 'AL', null, null],
    },
    {
      id: 2,
      name: 'Kamal Aizuddin',
      code: 'SO0003',
      leaves: [null, null, null, null, null, null, 'MC'],
    },
    {
      id: 3,
      name: 'Hafiz Daud',
      code: 'SO0006',
      leaves: ['EL', null, null, null, null, null, null],
    },
  ]

  // Upcoming leave table
  const upcomingLeaves = [
    {
      id: 1,
      guard: 'Nora Baharom',
      type: 'AL',
      dates: '10-11 Apr',
      status: 'Approved',
      remarks: 'Annual leave',
    },
    {
      id: 2,
      guard: 'Kamal Aizuddin',
      type: 'MC',
      dates: '12 Apr',
      status: 'Approved',
      remarks: 'Medical certificate',
    },
    {
      id: 3,
      guard: 'Hafiz Daud',
      type: 'EL',
      dates: '13 Apr',
      status: 'Approved',
      remarks: 'Family emergency',
    },
    {
      id: 4,
      guard: 'Ahmad Razif',
      type: 'AL',
      dates: '20-22 Apr',
      status: 'Pending',
      remarks: '—',
    },
    {
      id: 5,
      guard: 'Siti Norizan',
      type: 'AL',
      dates: '25 Apr',
      status: 'Pending',
      remarks: '—',
    },
  ]

  const getLeaveColor = (type: string | null) => {
    if (type === 'AL') return 'bg-purple-100 text-purple-700'
    if (type === 'MC') return 'bg-red-100 text-red-700'
    if (type === 'EL') return 'bg-amber-100 text-amber-700'
    if (type === 'UL') return 'bg-slate-100 text-slate-700'
    return 'bg-slate-50 text-slate-400'
  }

  const getLeaveLabel = (type: string | null) => {
    if (!type) return '—'
    return type
  }

  const getStatusBadgeColor = (status: string) => {
    if (status === 'Approved') return 'bg-green-100 text-green-700'
    if (status === 'Pending') return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

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

      {/* Page Content */}
      <div className="p-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Leave calendar</h3>
            <p className="text-sm text-slate-600">Guards on leave — Apr 2026</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                viewMode === 'week'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                viewMode === 'month'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {summaryStats.map((stat) => (
            <Card
              key={stat.label}
              className={`border-2 p-4 ${stat.color}`}
            >
              <p className={`text-sm font-medium ${stat.textColor} mb-2`}>{stat.label}</p>
              <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Calendar - Week View */}
        {viewMode === 'week' && (
          <>
            <div className="mb-8">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">
                Week of {days[0].toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - {days[6].toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
              </h4>
              <Card className="border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 w-40">Guard</th>
                        {days.map((day, idx) => (
                          <th
                            key={idx}
                            className="px-4 py-3 text-center text-sm font-semibold text-slate-700 min-w-20"
                          >
                            <div>{dayNames[idx]}</div>
                            <div className="text-xs text-slate-500">{day.getDate()}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guardLeaves.map((guard) => (
                        <tr key={guard.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900">{guard.name}</div>
                            <div className="text-xs text-slate-500">{guard.code}</div>
                          </td>
                          {guard.leaves.map((leave, idx) => (
                            <td key={idx} className="px-4 py-3 text-center">
                              {leave ? (
                                <Badge className={`${getLeaveColor(leave)} border-0 w-full`}>
                                  {getLeaveLabel(leave)}
                                </Badge>
                              ) : (
                                <div className="text-sm text-slate-300">—</div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}

        {/* Month View Placeholder */}
        {viewMode === 'month' && (
          <Card className="border-slate-200 p-8 mb-8">
            <p className="text-center text-slate-500">Month view coming soon</p>
          </Card>
        )}

        {/* Upcoming Leave Table */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Upcoming leave requests</h4>
          <Card className="border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Guard</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Dates</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {upcomingLeaves.map((leave) => (
                  <tr key={leave.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{leave.guard}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${getLeaveColor(leave.type)} border-0`}>
                        {leave.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{leave.dates}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${getStatusBadgeColor(leave.status)} border-0`}>
                        {leave.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{leave.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  )
}
