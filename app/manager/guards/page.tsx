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

export default function ManagerGuardsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingGuard, setEditingGuard] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formValues, setFormValues] = useState<any>({})

  const handleSignOut = () => {
    router.push('/')
  }

  const guards = [
    { code: 'SO0001', name: 'Ahmad Razif', role: 'Security Officer', supervisor: 'Azri Hamdan', status: 'Active', joined: '01 Jan 2024' },
    { code: 'SO0002', name: 'Siti Norizan', role: 'Security Officer', supervisor: 'Azri Hamdan', status: 'Active', joined: '15 Mar 2024' },
    { code: 'SN0001', name: 'Rajan Muthu', role: 'Nepalese Security Officer', supervisor: 'Azri Hamdan', status: 'Active', joined: '20 Feb 2024' },
    { code: 'SO0003', name: 'Kamal Aizuddin', role: 'Security Officer', supervisor: 'Azri Hamdan', status: 'Active', joined: '10 Apr 2024' },
    { code: 'SO0004', name: 'Nora Baharom', role: 'Security Officer', supervisor: 'Azri Hamdan', status: 'On leave', joined: '05 Jun 2024' },
    { code: 'SO0005', name: 'Lim Chee Hoe', role: 'Security Officer', supervisor: 'Farah Izzati', status: 'Active', joined: '12 Jul 2024' },
    { code: 'SO0006', name: 'Hafiz Daud', role: 'Security Officer', supervisor: 'Azri Hamdan', status: 'Active', joined: '30 Aug 2024' },
    { code: 'SN0002', name: 'Mei Ling', role: 'Nepalese Security Officer', supervisor: 'Azri Hamdan', status: 'Active', joined: '18 Sep 2024' },
    { code: 'OE0001', name: 'Azri Hamdan', role: 'Operations Executive', supervisor: null, status: 'Active', joined: '01 Jan 2023' },
    { code: 'OE0002', name: 'Farah Izzati', role: 'Operations Executive', supervisor: null, status: 'Active', joined: '01 Jan 2023' },
  ]

  const supervisors = ['All', 'Azri Hamdan', 'Farah Izzati', 'Rajesh Kumar', 'Tan Wei Ling']
  const roles = ['All', 'Security Officer', 'Nepalese Security Officer', 'Operations Executive']
  const statuses = ['All', 'Active', 'On leave', 'Inactive']

  const filteredGuards = useMemo(() => {
    return guards.filter((guard) => {
      const matchesSearch =
        guard.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guard.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSupervisor = supervisorFilter === 'All' || guard.supervisor === supervisorFilter
      const matchesRole = roleFilter === 'All' || guard.role === roleFilter
      const matchesStatus = statusFilter === 'All' || guard.status === statusFilter
      return matchesSearch && matchesSupervisor && matchesRole && matchesStatus
    })
  }, [searchQuery, supervisorFilter, roleFilter, statusFilter])

  const handleEditGuard = (guard: any) => {
    setEditingGuard(guard)
    setFormValues({ fullName: guard.name, code: guard.code, role: guard.role, supervisor: guard.supervisor || '', isActive: guard.status === 'Active' })
    setIsModalOpen(true)
  }

  const handleSaveGuard = () => {
    setIsModalOpen(false)
    setEditingGuard(null)
  }

  const getAvatarColor = (role: string) => {
    if (role === 'Operations Executive') return 'bg-purple-600'
    if (role === 'Nepalese Security Officer') return 'bg-blue-600'
    return 'bg-teal-600'
  }

  const getStatusColor = (status: string) => {
    if (status === 'Active') return 'bg-green-100 text-green-700'
    if (status === 'On leave') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-200 text-slate-700'
  }

  const getRoleBadgeColor = (role: string) => {
    if (role === 'Operations Executive') return 'bg-purple-100 text-purple-700'
    if (role === 'Nepalese Security Officer') return 'bg-blue-100 text-blue-700'
    return 'bg-teal-100 text-teal-700'
  }

  const todayDate = new Date(2026, 3, 10)
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

  const totalGuards = 300
  const activeGuards = 285
  const onLeaveGuards = 12
  const inactiveGuards = 15

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
            <h3 className="text-lg font-bold text-slate-900 mb-1">Guard Management</h3>
            <p className="text-sm text-slate-600">300 guards across 80 sites</p>
          </div>
          <Input
            type="text"
            placeholder="Search name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>

        {/* Filter Pills */}
        <div className="mb-6 space-y-3">
          {/* Supervisor Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 min-w-max">Supervisor:</span>
            <div className="flex gap-2 flex-wrap">
              {supervisors.map((supervisor) => (
                <button
                  key={supervisor}
                  onClick={() => setSupervisorFilter(supervisor)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    supervisorFilter === supervisor
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {supervisor}
                </button>
              ))}
            </div>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 min-w-max">Role:</span>
            <div className="flex gap-2 flex-wrap">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    roleFilter === role
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 min-w-max">Status:</span>
            <div className="flex gap-2 flex-wrap">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    statusFilter === status
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Total guards</p>
            <p className="text-2xl font-bold text-blue-600">{totalGuards}</p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-600">{activeGuards}</p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">On leave today</p>
            <p className="text-2xl font-bold text-amber-600">{onLeaveGuards}</p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Inactive</p>
            <p className="text-2xl font-bold text-slate-400">{inactiveGuards}</p>
          </Card>
        </div>

        {/* Guards Table */}
        <Card className="border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Guard</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Supervisor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Joined</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuards.map((guard) => (
                <tr key={guard.code} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(
                          guard.role
                        )}`}
                      >
                        {guard.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{guard.name}</div>
                        <div className="text-xs text-slate-500">{guard.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`border-0 ${getRoleBadgeColor(guard.role)}`}>{guard.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{guard.supervisor || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`border-0 ${getStatusColor(guard.status)}`}>{guard.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{guard.joined}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditGuard(guard)}
                      className="text-slate-700 border-slate-300 hover:bg-slate-50"
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Footer */}
        <div className="mt-4 text-sm text-slate-600">Showing {filteredGuards.length} of {totalGuards} guards</div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingGuard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Edit Guard</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <Input
                    type="text"
                    value={formValues.fullName || ''}
                    onChange={(e) => setFormValues({ ...formValues, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Employee Code</label>
                  <Input type="text" value={formValues.code || ''} disabled className="bg-slate-100 cursor-not-allowed" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">External Role</label>
                  <select
                    value={formValues.role || ''}
                    onChange={(e) => setFormValues({ ...formValues, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900"
                  >
                    <option>Security Officer</option>
                    <option>Nepalese Security Officer</option>
                    <option>Operations Executive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Supervisor Assignment</label>
                  <select
                    value={formValues.supervisor || ''}
                    onChange={(e) => setFormValues({ ...formValues, supervisor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900"
                  >
                    <option value="">None</option>
                    <option>Azri Hamdan</option>
                    <option>Farah Izzati</option>
                    <option>Rajesh Kumar</option>
                    <option>Tan Wei Ling</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formValues.isActive || false}
                    onChange={(e) => setFormValues({ ...formValues, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">Is Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-700 border-slate-300"
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveGuard} className="bg-slate-700 hover:bg-slate-800">
                  Save
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
