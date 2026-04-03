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
import { LogOut, AlertCircle, PieChart } from 'lucide-react'

export default function SupervisorOverviewPage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('All')

  const handleSignOut = () => {
    router.push('/')
  }

  const handleSchedule = (siteId: string) => {
    router.push(`/supervisor/sites/${siteId}/schedule`)
  }

  // Mock data for stats
  const stats = [
    { label: 'Sites with gaps today', value: 7, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Unfilled slots today', value: 14, color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-600', icon: AlertCircle },
    { label: 'Guards absent', value: 5, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Overall fill rate', value: '83%', color: 'bg-green-50 border-green-200', textColor: 'text-green-600', icon: PieChart },
  ]

  const sitesData = [
    { code: 'KLSNT01', name: 'Sentral Tower', shifts: [{ name: 'Morning', status: 'gap' }, { name: 'Afternoon', status: 'gap' }, { name: 'Night', status: 'filled' }], fillRate: 33, openSlots: 4 },
    { code: 'PJAYA02', name: 'Damansara Heights', shifts: [{ name: 'Morning', status: 'gap' }, { name: 'Afternoon', status: 'partial' }, { name: 'Night', status: 'filled' }], fillRate: 60, openSlots: 2 },
    { code: 'SUBNG05', name: 'Subang Parade', shifts: [{ name: 'Morning', status: 'filled' }, { name: 'Afternoon', status: 'partial' }, { name: 'Night', status: 'filled' }], fillRate: 75, openSlots: 1 },
    { code: 'SETIA08', name: 'Setia Alam', shifts: [{ name: 'Morning', status: 'filled' }, { name: 'Afternoon', status: 'partial' }, { name: 'Night', status: 'filled' }], fillRate: 80, openSlots: 1 },
    { code: 'AMPNG03', name: 'Ampang Point', shifts: [{ name: 'Morning', status: 'filled' }, { name: 'Afternoon', status: 'filled' }, { name: 'Night', status: 'filled' }], fillRate: 100, openSlots: 0 },
    { code: 'MONT11', name: 'Mont Kiara', shifts: [{ name: 'Morning', status: 'filled' }, { name: 'Afternoon', status: 'filled' }, { name: 'Night', status: 'filled' }], fillRate: 100, openSlots: 0 },
  ]

  const absenceData = [
    { name: 'Ahmad Razif', siteCode: 'KLSNT01', shift: 'Morning 06:00-14:00', status: 'absent' },
    { name: 'Siti Norizan', siteCode: 'PJAYA02', shift: 'Morning 06:00-14:00', status: 'absent' },
    { name: 'Nora Baharom', siteCode: 'KLSNT01', shift: 'Afternoon 14:00-22:00', status: 'leave' },
  ]

  const getFilteredSites = () => {
    if (activeFilter === 'All') return sitesData
    if (activeFilter === 'Urgent') return sitesData.filter(s => s.fillRate < 50)
    if (activeFilter === 'Partial') return sitesData.filter(s => s.fillRate >= 50 && s.fillRate < 80)
    if (activeFilter === 'Filled') return sitesData.filter(s => s.fillRate >= 80)
    return sitesData
  }

  const getShiftStatusColor = (status: string) => {
    if (status === 'gap') return 'bg-red-100 text-red-700'
    if (status === 'partial') return 'bg-amber-100 text-amber-700'
    return 'bg-green-100 text-green-700'
  }

  const getShiftStatusSymbol = (status: string) => {
    if (status === 'gap') return '✕'
    if (status === 'partial') return '~'
    return '✓'
  }

  const getFillRateBadgeColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800'
    if (rate >= 50) return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

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

      {/* Page Content */}
      <div className="p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {stats.map((stat, idx) => {
              const Icon = stat.icon
              return (
                <Card
                  key={idx}
                  className={`${stat.color} border p-6`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-600 mb-2">{stat.label}</p>
                      <p className={`text-3xl font-bold ${stat.textColor}`}>
                        {stat.value}
                      </p>
                    </div>
                    <Icon className={`w-5 h-5 ${stat.textColor}`} />
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Sites Needing Attention */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Sites needing attention today</h3>
            
            {/* Filter Pills */}
            <div className="flex gap-2 mb-4">
              {['All', 'Urgent', 'Partial', 'Filled'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    activeFilter === filter
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Table */}
            <Card className="border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-200">
                    <TableHead className="text-slate-700 font-semibold">Site Code</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Site Name</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Shifts today</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Fill rate</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Open slots</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredSites().map((site, idx) => (
                    <TableRow key={idx} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-900">{site.code}</TableCell>
                      <TableCell className="text-slate-900">{site.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {site.shifts.map((shift, sidx) => (
                            <span key={sidx} className={`px-2 py-1 rounded text-xs font-medium ${getShiftStatusColor(shift.status)}`}>
                              {shift.name} {getShiftStatusSymbol(shift.status)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getFillRateBadgeColor(site.fillRate)}>
                          {site.fillRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {site.openSlots === 0 ? (
                          <span className="text-slate-500">Filled</span>
                        ) : (
                          <span className="text-red-600 font-medium">{site.openSlots} open</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSchedule(site.code)}
                          className="text-teal-600 border-teal-200 hover:bg-teal-50"
                        >
                          Schedule
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Guards Absent Today */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Guards absent today</h3>
            <Card className="border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-200">
                    <TableHead className="text-slate-700 font-semibold">Guard Name</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Site Code</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Shift</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absenceData.map((absence, idx) => (
                    <TableRow key={idx} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-900">{absence.name}</TableCell>
                      <TableCell className="text-slate-900">{absence.siteCode}</TableCell>
                      <TableCell className="text-slate-700">{absence.shift}</TableCell>
                      <TableCell>
                        {absence.status === 'leave' ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            on leave (AL)
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-teal-600 border-teal-200 hover:bg-teal-50"
                          >
                            Find Replacement
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </>
    )
  }
