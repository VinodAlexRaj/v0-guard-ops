'use client'

import Link from 'next/link'
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
import { LogOut, ChevronLeft } from 'lucide-react'

export default function SupervisorDetailPage() {
  const router = useRouter()

  const handleSignOut = () => {
    router.push('/')
  }

  // Mock data - always show Azri Hamdan
  const supervisor = {
    name: 'Azri Hamdan',
    role: 'Operations Executive',
    code: 'OE0001',
    status: 'Active',
    sites: 22,
    guards: 64,
    fillRateToday: 83,
    gapsToday: 7,
  }

  const assignedSites = [
    { code: 'KLSNT01', name: 'Sentral Tower', fillRate: 33, openSlots: 4 },
    { code: 'PJAYA02', name: 'Damansara Heights', fillRate: 60, openSlots: 2 },
    { code: 'SUBNG05', name: 'Subang Parade', fillRate: 75, openSlots: 1 },
    { code: 'SETIA08', name: 'Setia Alam', fillRate: 80, openSlots: 0 },
    { code: 'AMPNG03', name: 'Ampang Point', fillRate: 100, openSlots: 0 },
    { code: 'MONT11', name: 'Mont Kiara', fillRate: 100, openSlots: 0 },
  ]

  const guardsUnderSuper = [
    { code: 'SO0001', name: 'Ahmad Razif', role: 'Security Officer', status: 'Active' },
    { code: 'SO0002', name: 'Siti Norizan', role: 'Security Officer', status: 'Active' },
    { code: 'SO0004', name: 'Nora Baharom', role: 'Security Officer', status: 'On leave' },
    { code: 'SN0001', name: 'Rajan Muthu', role: 'Nepalese Security Officer', status: 'Active' },
    { code: 'SO0003', name: 'Kamal Aizuddin', role: 'Security Officer', status: 'Active' },
  ]

  const getFillRateBadgeColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800'
    if (rate >= 50) return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

  const getStatusColor = (status: string) => {
    if (status === 'Active') return 'bg-green-100 text-green-700'
    if (status === 'On leave') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-700'
  }

  const todayDate = new Date(2026, 3, 10)
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

      {/* Back Button */}
      <div className="border-b border-slate-200 bg-white px-8 py-3">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-slate-600 hover:text-slate-900 pl-0"
        >
          <Link href="/manager/supervisors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Supervisors
          </Link>
        </Button>
      </div>

      {/* Page Content */}
      <div className="p-8">
        {/* Supervisor Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">{supervisor.name}</h1>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-200 text-slate-700 border-0">{supervisor.role}</Badge>
            <Badge className="bg-slate-200 text-slate-700 border-0">{supervisor.code}</Badge>
            <Badge className="bg-green-100 text-green-700 border-0">{supervisor.status}</Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          <Card className="border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-2">Sites assigned</p>
            <p className="text-2xl font-bold text-blue-600">{supervisor.sites}</p>
          </Card>
          <Card className="border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-2">Guards managed</p>
            <p className="text-2xl font-bold text-blue-600">{supervisor.guards}</p>
          </Card>
          <Card className="border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-2">Fill rate today</p>
            <p className="text-2xl font-bold text-amber-600">{supervisor.fillRateToday}%</p>
          </Card>
          <Card className="border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-2">Gaps today</p>
            <p className="text-2xl font-bold text-red-600">{supervisor.gapsToday}</p>
          </Card>
        </div>

        {/* Assigned Sites Section */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Assigned sites</h2>
          <Card className="border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Site Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Site Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Fill rate</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Open slots</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignedSites.map((site) => (
                  <tr key={site.code} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-slate-900">{site.code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{site.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${getFillRateBadgeColor(site.fillRate)} border-0`}>
                        {site.fillRate}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{site.openSlots}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="text-slate-700 border-slate-300 hover:bg-slate-50"
                      >
                        <Link href={`/supervisor/sites/${site.code}/schedule`}>
                          Schedule
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Guards Section */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Guards under this supervisor</h2>
          <Card className="border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {guardsUnderSuper.map((guard) => (
                  <tr key={guard.code} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-slate-900">{guard.code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{guard.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{guard.role}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${getStatusColor(guard.status)} border-0`}>
                        {guard.status}
                      </Badge>
                    </td>
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
