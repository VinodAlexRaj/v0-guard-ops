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
import { LogOut, ArrowRight } from 'lucide-react'

export default function ManagerSitesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const handleSignOut = () => {
    router.push('/')
  }

  const handleViewSite = (siteCode: string) => {
    router.push(`/manager/sites/${siteCode}`)
  }

  // Mock data - all 80 sites (showing 10 here)
  const allSites = [
    { code: 'KLSNT01', name: 'Sentral Tower', supervisor: 'Azri Hamdan', activeShifts: 3, fillRate: 33, openSlots: 4, status: 'Active' },
    { code: 'PJAYA02', name: 'Damansara Heights', supervisor: 'Azri Hamdan', activeShifts: 3, fillRate: 60, openSlots: 2, status: 'Active' },
    { code: 'SUBNG05', name: 'Subang Parade', supervisor: 'Azri Hamdan', activeShifts: 2, fillRate: 75, openSlots: 1, status: 'Active' },
    { code: 'KLBNG07', name: 'Bukit Bintang Plaza', supervisor: 'Rajesh Kumar', activeShifts: 3, fillRate: 41, openSlots: 7, status: 'Active' },
    { code: 'CYBJ03', name: 'Cyberjaya Gateway', supervisor: 'Rajesh Kumar', activeShifts: 3, fillRate: 60, openSlots: 3, status: 'Active' },
    { code: 'SHAH12', name: 'Shah Alam Centre', supervisor: 'Farah Izzati', activeShifts: 2, fillRate: 67, openSlots: 2, status: 'Active' },
    { code: 'SETIA08', name: 'Setia Alam', supervisor: 'Azri Hamdan', activeShifts: 2, fillRate: 80, openSlots: 1, status: 'Active' },
    { code: 'AMPNG03', name: 'Ampang Point', supervisor: 'Azri Hamdan', activeShifts: 3, fillRate: 100, openSlots: 0, status: 'Active' },
    { code: 'MONT11', name: 'Mont Kiara', supervisor: 'Azri Hamdan', activeShifts: 2, fillRate: 100, openSlots: 0, status: 'Active' },
    { code: 'TTGRT09', name: 'Titiwangsa', supervisor: 'Tan Wei Ling', activeShifts: 3, fillRate: 97, openSlots: 0, status: 'Active' },
  ]

  const supervisors = ['All', 'Azri Hamdan', 'Farah Izzati', 'Rajesh Kumar', 'Tan Wei Ling']

  // Filter and search
  const filteredSites = useMemo(() => {
    return allSites.filter((site) => {
      const matchesSearch =
        site.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesSupervisor = supervisorFilter === 'All' || site.supervisor === supervisorFilter
      const matchesStatus = statusFilter === 'All' || site.status === statusFilter

      return matchesSearch && matchesSupervisor && matchesStatus
    })
  }, [searchQuery, supervisorFilter, statusFilter])

  const getFillRateColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-700 border-0'
    if (rate >= 50) return 'bg-amber-100 text-amber-700 border-0'
    return 'bg-red-100 text-red-700 border-0'
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

      {/* Page Content */}
      <div className="p-8">
        {/* Header with Search */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 mb-1">All Sites</h1>
            <p className="text-sm text-slate-600">80 sites across 4 supervisors</p>
          </div>
          <Input
            type="text"
            placeholder="Search site code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>

        {/* Filter Bars */}
        <div className="mb-4 flex gap-6">
          {/* Supervisor Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Supervisor:</span>
            <div className="flex gap-2">
              {supervisors.map((sup) => (
                <button
                  key={sup}
                  onClick={() => setSupervisorFilter(sup)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    supervisorFilter === sup
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {sup}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Status:</span>
            <div className="flex gap-2">
              {['All', 'Active', 'Inactive'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Row - 3 Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-blue-50 border-blue-200 p-4">
            <div className="text-sm text-slate-600">Total sites</div>
            <div className="text-2xl font-bold text-blue-600">80</div>
          </Card>
          <Card className="bg-red-50 border-red-200 p-4">
            <div className="text-sm text-slate-600">Sites with gaps today</div>
            <div className="text-2xl font-bold text-red-600">18</div>
          </Card>
          <Card className="bg-green-50 border-green-200 p-4">
            <div className="text-sm text-slate-600">Fully filled</div>
            <div className="text-2xl font-bold text-green-600">62</div>
          </Card>
        </div>

        {/* Sites Table */}
        <Card className="border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Site Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Site Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Supervisor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Active shifts</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Fill rate</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Open slots</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site, idx) => (
                <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-slate-900">{site.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-900">{site.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{site.supervisor}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{site.activeShifts}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={getFillRateColor(site.fillRate)}>
                      {site.fillRate}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{site.openSlots}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewSite(site.code)}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      View
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Footer */}
        <div className="mt-4">
          <span className="text-sm text-slate-600">Showing {filteredSites.length} of 80 sites</span>
        </div>
      </div>
    </>
  )
}
