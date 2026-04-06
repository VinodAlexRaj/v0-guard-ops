'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LogOut } from 'lucide-react'

export default function SupervisorSitesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSignOut = () => {
    router.push('/')
  }

  const handleSchedule = (siteCode: string) => {
    router.push(`/supervisor/sites/${siteCode}/schedule`)
  }

  const todayDate = new Date(2026, 3, 10) // April 10, 2026
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

  // Mock sites data
  const sitesData = [
    {
      code: 'KLSNT01',
      name: 'Sentral Tower',
      address: 'Jalan Stesen Sentral 5, KL',
      activeShifts: 3,
      fillRate: 33,
    },
    {
      code: 'PJAYA02',
      name: 'Damansara Heights',
      address: 'Damansara Heights, KL',
      activeShifts: 3,
      fillRate: 60,
    },
    {
      code: 'SUBNG05',
      name: 'Subang Parade',
      address: 'Jalan SS 16/1, Subang Jaya',
      activeShifts: 2,
      fillRate: 75,
    },
    {
      code: 'SETIA08',
      name: 'Setia Alam',
      address: 'Shah Alam, Selangor',
      activeShifts: 2,
      fillRate: 80,
    },
    {
      code: 'AMPNG03',
      name: 'Ampang Point',
      address: 'Ampang, KL',
      activeShifts: 3,
      fillRate: 100,
    },
    {
      code: 'MONT11',
      name: 'Mont Kiara',
      address: 'Mont Kiara, KL',
      activeShifts: 2,
      fillRate: 100,
    },
  ]

  // Filter sites based on search query
  const filteredSites = useMemo(() => {
    return sitesData.filter(
      (site) =>
        site.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  // Get fill rate color
  const getFillRateColor = (fillRate: number) => {
    if (fillRate >= 80) return 'bg-green-100 text-green-700'
    if (fillRate >= 50) return 'bg-amber-100 text-amber-700'
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
        {/* Header with Search */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">My Sites</h3>
            <p className="text-sm text-slate-600">22 sites under your supervision</p>
          </div>
          <Input
            type="text"
            placeholder="Search site code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Total Sites */}
          <Card className="border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-2">Total sites</p>
            <p className="text-3xl font-bold text-blue-600">22</p>
          </Card>

          {/* Sites with Gaps */}
          <Card className="border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-2">Sites with gaps today</p>
            <p className="text-3xl font-bold text-red-600">7</p>
          </Card>

          {/* Fully Filled */}
          <Card className="border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-2">Fully filled today</p>
            <p className="text-3xl font-bold text-green-600">15</p>
          </Card>
        </div>

        {/* Sites Table */}
        <Card className="border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Site Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Site Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Address</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Active shifts</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Today&apos;s fill rate</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
                <tr key={site.code} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <code className="text-sm font-mono text-slate-900">{site.code}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-900">{site.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{site.address}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-900">{site.activeShifts}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`border-0 ${getFillRateColor(site.fillRate)}`}>
                      {site.fillRate}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSchedule(site.code)}
                      className="text-teal-600 border-teal-200 hover:bg-teal-50"
                    >
                      Schedule
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}
