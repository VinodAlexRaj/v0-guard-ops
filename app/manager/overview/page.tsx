'use client'

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

export default function ManagerOverviewPage() {
  const router = useRouter()

  const handleSignOut = () => {
    router.push('/')
  }

  // Mock data for stats
  const stats = [
    { label: 'Sites with gaps today', value: 18, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Unfilled slots', value: 31, color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-600', icon: AlertCircle },
    { label: 'Guards on leave', value: 12, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-600', icon: Calendar },
    { label: 'Guards absent', value: 7, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Org fill rate', value: '87%', color: 'bg-green-50 border-green-200', textColor: 'text-green-600', icon: PieChart },
  ]

  const supervisors = [
    { name: 'Azri Hamdan', sites: 22, guards: 64, fillRate: 83, gaps: 7 },
    { name: 'Farah Izzati', sites: 20, guards: 58, fillRate: 90, gaps: 4 },
    { name: 'Rajesh Kumar', sites: 21, guards: 92, fillRate: 76, gaps: 11 },
    { name: 'Tan Wei Ling', sites: 17, guards: 86, fillRate: 97, gaps: 1 },
  ]

  const sitesTable = [
    { code: 'KLBNG07', name: 'Bukit Bintang Plaza', supervisor: 'Rajesh Kumar', fillRate: 41, openSlots: 7 },
    { code: 'KLSNT01', name: 'Sentral Tower', supervisor: 'Azri Hamdan', fillRate: 33, openSlots: 4 },
    { code: 'CYBJ03', name: 'Cyberjaya Gateway', supervisor: 'Rajesh Kumar', fillRate: 60, openSlots: 3 },
    { code: 'PJAYA02', name: 'Damansara Heights', supervisor: 'Azri Hamdan', fillRate: 60, openSlots: 2 },
    { code: 'SHAH12', name: 'Shah Alam Centre', supervisor: 'Farah Izzati', fillRate: 67, openSlots: 2 },
  ]

  const getFillRateColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-50 text-green-700 border-green-200'
    if (rate >= 50) return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-red-50 text-red-700 border-red-200'
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
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4 mb-8">
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

          {/* By Supervisor Section */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">By supervisor</h3>
            <div className="grid grid-cols-4 gap-4">
              {supervisors.map((supervisor, idx) => (
                <Card key={idx} className="border-slate-200 p-6">
                  <h4 className="font-medium text-slate-900 mb-4">{supervisor.name}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Sites:</span>
                      <span className="font-medium text-slate-900">{supervisor.sites}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Guards:</span>
                      <span className="font-medium text-slate-900">{supervisor.guards}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Fill rate:</span>
                      <Badge className={getFillRateBadgeColor(supervisor.fillRate)}>
                        {supervisor.fillRate}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gaps:</span>
                      <span className="font-medium text-red-600">{supervisor.gaps}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Sites Needing Attention Table */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Sites needing attention</h3>
            <Card className="border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-200">
                    <TableHead className="text-slate-700 font-semibold">Site Code</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Site Name</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Supervisor</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Fill Rate</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Open Slots</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sitesTable.map((site, idx) => (
                    <TableRow key={idx} className="border-slate-200 hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-900">{site.code}</TableCell>
                      <TableCell className="text-slate-900">{site.name}</TableCell>
                      <TableCell className="text-slate-700">{site.supervisor}</TableCell>
                      <TableCell>
                        <Badge className={getFillRateBadgeColor(site.fillRate)}>
                          {site.fillRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-red-600 font-medium">{site.openSlots}</span>
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
