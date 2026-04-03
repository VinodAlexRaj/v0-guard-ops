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

export default function ManagerSupervisorsPage() {
  const router = useRouter()

  const handleSignOut = () => {
    router.push('/')
  }

  const handleViewSupervisor = (id: string) => {
    router.push(`/manager/supervisors/${id}`)
  }

  const supervisors = [
    { id: 'OE0001', name: 'Azri Hamdan', code: 'OE0001', sites: 22, guards: 64, fillRate: 83, gaps: 7, status: 'Active' },
    { id: 'OE0002', name: 'Farah Izzati', code: 'OE0002', sites: 20, guards: 58, fillRate: 90, gaps: 4, status: 'Active' },
    { id: 'OE0003', name: 'Rajesh Kumar', code: 'OE0003', sites: 21, guards: 92, fillRate: 76, gaps: 11, status: 'Active' },
    { id: 'OE0004', name: 'Tan Wei Ling', code: 'OE0004', sites: 17, guards: 86, fillRate: 97, gaps: 1, status: 'Active' },
  ]

  const getFillRateBadgeColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-700'
    if (rate >= 50) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  const getFillRateBarColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500'
    if (rate >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
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
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Supervisors</h1>
          <p className="text-slate-600">4 supervisors managing 80 sites</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-blue-50 border-blue-200 border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total supervisors</p>
                <p className="text-3xl font-bold text-blue-600">4</p>
              </div>
              <div className="text-4xl text-blue-200 opacity-50">👥</div>
            </div>
          </Card>
          <Card className="bg-red-50 border-red-200 border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Sites with gaps</p>
                <p className="text-3xl font-bold text-red-600">18</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-200 opacity-50" />
            </div>
          </Card>
          <Card className="bg-green-50 border-green-200 border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Avg fill rate</p>
                <p className="text-3xl font-bold text-green-600">87%</p>
              </div>
              <PieChart className="w-8 h-8 text-green-200 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Supervisors Table */}
        <Card className="border-slate-200 overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Supervisor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Sites</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Guards</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Fill rate today</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Gaps</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.map((supervisor) => (
                <tr key={supervisor.id} className="border-b border-slate-200 hover:bg-slate-50">
                  {/* Supervisor Name + Code */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-teal-600 text-white text-xs font-bold">
                        {getInitials(supervisor.name)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{supervisor.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{supervisor.code}</div>
                      </div>
                    </div>
                  </td>

                  {/* Sites */}
                  <td className="px-4 py-3 text-sm text-slate-700">{supervisor.sites} sites</td>

                  {/* Guards */}
                  <td className="px-4 py-3 text-sm text-slate-700">{supervisor.guards} guards</td>

                  {/* Fill Rate */}
                  <td className="px-4 py-3">
                    <Badge className={`${getFillRateBadgeColor(supervisor.fillRate)} border-0`}>
                      {supervisor.fillRate}%
                    </Badge>
                  </td>

                  {/* Gaps */}
                  <td className="px-4 py-3 text-sm text-red-600 font-medium">
                    {supervisor.gaps} {supervisor.gaps === 1 ? 'gap' : 'gaps'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge className="bg-green-100 text-green-700 border-0">{supervisor.status}</Badge>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSupervisor(supervisor.id)}
                      className="text-slate-700 border-slate-300 hover:bg-slate-50"
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Performance Chart Section */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Supervisor performance this week</h2>
          <Card className="border-slate-200 p-6">
            <div className="space-y-4">
              {supervisors.map((supervisor) => (
                <div key={supervisor.id} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium text-slate-700">{supervisor.name}</div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full ${getFillRateBarColor(supervisor.fillRate)} transition-all`}
                      style={{ width: `${supervisor.fillRate}%` }}
                    ></div>
                  </div>
                  <div className="w-12 text-right text-sm font-medium text-slate-700">{supervisor.fillRate}%</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
