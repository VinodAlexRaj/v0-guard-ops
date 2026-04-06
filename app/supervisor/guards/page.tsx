'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, ArrowRight } from 'lucide-react'

interface Guard {
  id: string
  name: string
  code: string
  role: 'Guard' | 'Supervisor'
  status: 'Active' | 'On leave' | 'Inactive'
  leave?: string
  sites: string[]
  initials: string
}

export default function GuardsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All roles')

  const guards: Guard[] = [
    {
      id: '1',
      name: 'Ahmad Razif',
      code: 'SO0001',
      role: 'Guard',
      status: 'Active',
      sites: ['KLSNT01', 'PJAYA02'],
      initials: 'AR',
    },
    {
      id: '2',
      name: 'Siti Norizan',
      code: 'SO0002',
      role: 'Guard',
      status: 'Active',
      sites: ['KLSNT01'],
      initials: 'SN',
    },
    {
      id: '3',
      name: 'Nora Baharom',
      code: 'SO0004',
      role: 'Guard',
      status: 'On leave',
      leave: 'AL 10-11 Apr',
      sites: ['KLSNT01', 'SUBNG05'],
      initials: 'NB',
    },
    {
      id: '4',
      name: 'Rajan Muthu',
      code: 'SN0001',
      role: 'Guard',
      status: 'Active',
      sites: ['KLSNT01', 'AMPNG03'],
      initials: 'RM',
    },
    {
      id: '5',
      name: 'Kamal Aizuddin',
      code: 'SO0003',
      role: 'Guard',
      status: 'Active',
      leave: 'MC 12 Apr',
      sites: ['PJAYA02'],
      initials: 'KA',
    },
    {
      id: '6',
      name: 'Lim Chee Hoe',
      code: 'SO0005',
      role: 'Guard',
      status: 'Active',
      sites: ['KLSNT01', 'SUBNG05', 'SETIA08'],
      initials: 'LCH',
    },
    {
      id: '7',
      name: 'Hafiz Daud',
      code: 'SO0006',
      role: 'Guard',
      status: 'Active',
      leave: 'EL 13 Apr',
      sites: ['KLSNT01', 'MONT11'],
      initials: 'HD',
    },
    {
      id: '8',
      name: 'Mei Ling',
      code: 'SN0002',
      role: 'Guard',
      status: 'Active',
      sites: ['KLSNT01'],
      initials: 'ML',
    },
    {
      id: '9',
      name: 'Azri Hamdan',
      code: 'OE0001',
      role: 'Supervisor',
      status: 'Active',
      sites: [],
      initials: 'AH',
    },
  ]

  const filteredGuards = useMemo(() => {
    return guards.filter((guard) => {
      const matchesSearch =
        guard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guard.code.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'All' || guard.status === statusFilter
      const matchesRole =
        roleFilter === 'All roles' ||
        (roleFilter === 'Guard' && guard.role === 'Guard') ||
        (roleFilter === 'Supervisor' && guard.role === 'Supervisor')

      return matchesSearch && matchesStatus && matchesRole
    })
  }, [searchQuery, statusFilter, roleFilter])

  const handleSignOut = () => {
    router.push('/')
  }

  const handleSchedule = (guardName: string) => {
    router.push('/supervisor/sites/KLSNT01/schedule')
  }

  const getLeaveColor = (leave?: string) => {
    if (!leave) return ''
    if (leave.startsWith('AL')) return 'bg-purple-100 text-purple-700'
    if (leave.startsWith('MC')) return 'bg-red-100 text-red-700'
    if (leave.startsWith('EL')) return 'bg-amber-100 text-amber-700'
    return ''
  }

  const getAvatarColor = (role: string) => {
    return role === 'Supervisor' ? 'bg-purple-600' : 'bg-teal-600'
  }

  const activeCount = guards.filter((g) => g.status === 'Active').length
  const onLeaveCount = guards.filter((g) => g.status === 'On leave').length
  const inactiveCount = guards.filter((g) => g.status === 'Inactive').length

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
        {/* Header with Search */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Guards</h3>
            <p className="text-sm text-slate-600">64 guards across your 22 sites</p>
          </div>
          <Input
            type="text"
            placeholder="Search name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>

        {/* Filter Bars */}
        <div className="mb-4 flex gap-6">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Status:</span>
            <div className="flex gap-2">
              {['All', 'Active', 'On leave', 'Inactive'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    statusFilter === status
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Role:</span>
            <div className="flex gap-2">
              {['All roles', 'Guard', 'Supervisor'].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    roleFilter === role
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Guards Table */}
        <Card className="border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Guard</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Leave this week</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Assigned sites</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuards.map((guard) => {
                const isInactive = guard.status === 'Inactive'
                return (
                  <tr
                    key={guard.id}
                    className={`border-b border-slate-200 hover:bg-slate-50 ${isInactive ? 'opacity-50' : ''}`}
                  >
                    {/* Guard Name + Code */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(
                            guard.role
                          )}`}
                        >
                          {guard.initials}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{guard.name}</div>
                          <div className="text-xs text-slate-500">{guard.code}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge
                        className={`${
                          guard.role === 'Supervisor'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-teal-100 text-teal-700'
                        } border-0`}
                      >
                        {guard.role}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge
                        className={`border-0 ${
                          guard.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : guard.status === 'On leave'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {guard.status}
                      </Badge>
                    </td>

                    {/* Leave */}
                    <td className="px-4 py-3">
                      {guard.leave ? (
                        <Badge className={`border-0 ${getLeaveColor(guard.leave)}`}>{guard.leave}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Sites */}
                    <td className="px-4 py-3">
                      {guard.role === 'Supervisor' ? (
                        <span className="text-sm text-slate-700">22 sites</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {guard.sites.map((site) => (
                            <Badge key={site} variant="outline" className="bg-slate-50 text-slate-700">
                              {site}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSchedule(guard.name)}
                        className="text-teal-600 border-teal-200 hover:bg-teal-50"
                      >
                        Schedule
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-600">Showing {filteredGuards.length} of 64 guards</span>
          <div className="flex gap-6 text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-600"></div>
              <span className="text-green-600">{activeCount} active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-600"></div>
              <span className="text-amber-600">{onLeaveCount} on leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
              <span className="text-slate-600">{inactiveCount} inactive</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
