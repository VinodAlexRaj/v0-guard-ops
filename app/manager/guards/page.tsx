'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'

interface GuardRow {
  id: string
  code: string
  name: string
  role: string
  phone: string
  siteId: string | null
  siteCode: string | null
  supervisorId: string | null
  supervisor: string | null
  status: string
  joined: string
}

interface SiteRow {
  id: string
  site_code: string
  name: string
}

interface SupervisorRow {
  id: string
  full_name: string
  external_role?: string
}

export default function ManagerGuardsPage() {
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const [editingGuard, setEditingGuard] = useState<GuardRow | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formValues, setFormValues] = useState<{ supervisor: string; isActive: boolean }>({
    supervisor: '',
    isActive: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dateStr, setDateStr] = useState('')
  const [managerName, setManagerName] = useState('User')

  const [allStaff, setAllStaff] = useState<GuardRow[]>([])
  const [supervisors, setSupervisors] = useState<string[]>(['All'])
  const [supervisorList, setSupervisorList] = useState<SupervisorRow[]>([])
  const [sites, setSites] = useState<SiteRow[]>([])

  const [totalGuards, setTotalGuards] = useState(0)
  const [activeGuards, setActiveGuards] = useState(0)
  const [onLeaveGuards, setOnLeaveGuards] = useState(0)
  const [inactiveGuards, setInactiveGuards] = useState(0)

  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([])
  const [bulkSupervisorId, setBulkSupervisorId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  const handleSignOut = () => {
    router.push('/')
  }

  useEffect(() => {
    const todayDate = new Date()
    const formatted = todayDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    setDateStr(formatted)
  }, [])

  const loadGuardData = async () => {
    try {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (userData?.full_name) setManagerName(userData.full_name)
      }

      const { data: guardRoleMap, error: guardRoleError } = await supabase
        .from('role_mapping')
        .select('external_role')
        .eq('internal_role', 'guard')

      if (guardRoleError) throw guardRoleError

      const { data: supervisorRoleMap, error: supervisorRoleError } = await supabase
        .from('role_mapping')
        .select('external_role')
        .eq('internal_role', 'supervisor')

      if (supervisorRoleError) throw supervisorRoleError

      const guardRoles = (guardRoleMap || []).map((r: any) => r.external_role)
      const supervisorRoles = (supervisorRoleMap || []).map((r: any) => r.external_role)

      const { data: staffData, error: staffError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          external_employee_code,
          external_role,
          phone,
          is_active,
          created_at
        `)
        .in('external_role', guardRoles)
        .order('full_name')

      if (staffError) throw staffError

      const { data: supUsers, error: supUsersError } = await supabase
        .from('users')
        .select('id, full_name, external_role')
        .in('external_role', supervisorRoles)
        .order('full_name')

      if (supUsersError) throw supUsersError
      setSupervisorList((supUsers || []) as SupervisorRow[])

      const { data: supSites, error: supSitesError } = await supabase
        .from('supervisor_sites')
        .select('supervisor_id, site_id, users!supervisor_sites_supervisor_id_fkey(full_name)')

      if (supSitesError) throw supSitesError

      const { data: guardAssignments, error: assignmentsError } = await supabase
        .from('shift_assignments')
        .select('guard_id, site_id, start_time, is_cancelled')
        .eq('is_cancelled', false)

      if (assignmentsError) throw assignmentsError

      const today = getLocalDateString()
      const { data: leavesData, error: leavesError } = await supabase
        .from('leaves')
        .select('user_id, leave_status')
        .eq('leave_date', today)
        .eq('leave_status', 'Approved')

      if (leavesError) throw leavesError

      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, site_code, name')
        .order('site_code')

      if (sitesError) throw sitesError
      setSites((sitesData || []) as SiteRow[])

      const { data: guardSupData, error: guardSupError } = await supabase
        .from('guard_supervisor')
        .select(`
          guard_id,
          supervisor_id,
          supervisor:users!guard_supervisor_supervisor_id_fkey(full_name)
        `)

      if (guardSupError) throw guardSupError

      const supSiteData = supSites || []
      const assignData = guardAssignments || []
      const leaveData = leavesData || []
      const siteRows = sitesData || []
      const guardSupRows = guardSupData || []

      const rows: GuardRow[] = (staffData || []).map((staff: any) => {
        const assignments = assignData
          .filter((a: any) => a.guard_id === staff.id)
          .sort(
            (a: any, b: any) =>
              new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
          )

        const latestSiteId = assignments[0]?.site_id || null
        const site = siteRows.find((s: any) => s.id === latestSiteId)

        const override = guardSupRows.find((g: any) => g.guard_id === staff.id)

        const overrideUsers = override?.supervisor as { full_name: string }[] | undefined
        let supervisor: string | null = overrideUsers?.[0]?.full_name || null
        const supervisorId: string | null = override?.supervisor_id || null

        if (!supervisor && latestSiteId) {
          const supAssignment = supSiteData.find((ss: any) => ss.site_id === latestSiteId)
          const supUsers = supAssignment?.users as { full_name: string }[] | undefined
          const supUser = supUsers?.[0]
          supervisor = supUser?.full_name || null
        }

        const isOnLeaveToday = leaveData.some((l: any) => l.user_id === staff.id)

        let status = 'Active'
        if (!staff.is_active) {
          status = 'Inactive'
        } else if (isOnLeaveToday) {
          status = 'On leave'
        }

        const joinedDate = new Date(staff.created_at)
        const joined = joinedDate.toLocaleDateString('en-MY', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })

        return {
          id: staff.id,
          code: staff.external_employee_code || 'N/A',
          name: staff.full_name,
          role: staff.external_role,
          phone: staff.phone || '—',
          siteId: latestSiteId,
          siteCode: site?.site_code || '—',
          supervisorId,
          supervisor,
          status,
          joined,
        }
      })

      setAllStaff(rows)

      setTotalGuards(rows.length)
      setActiveGuards(rows.filter((r) => r.status === 'Active').length)
      setOnLeaveGuards(rows.filter((r) => r.status === 'On leave').length)
      setInactiveGuards(rows.filter((r) => r.status === 'Inactive').length)

      const uniqueSupervisors = [
        'All',
        ...new Set(rows.filter((r) => r.supervisor).map((r) => r.supervisor as string)),
      ]
      setSupervisors(uniqueSupervisors)
    } catch (error) {
      console.error('[guards] Error fetching guard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGuardData()
  }, [])

  const filteredGuards = useMemo(() => {
    return allStaff.filter((guard) => {
      const matchesSearch =
        !searchQuery ||
        guard.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guard.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (guard.siteCode || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchesSupervisor =
        supervisorFilter === 'All' || guard.supervisor === supervisorFilter
      const matchesRole = roleFilter === 'All' || guard.role === roleFilter
      const matchesStatus = statusFilter === 'All' || guard.status === statusFilter

      return matchesSearch && matchesSupervisor && matchesRole && matchesStatus
    })
  }, [allStaff, searchQuery, supervisorFilter, roleFilter, statusFilter])

  const handleEditGuard = (guard: GuardRow) => {
    setEditingGuard(guard)
    setFormValues({
      supervisor: guard.supervisorId || '',
      isActive: guard.status === 'Active',
    })
    setIsModalOpen(true)
  }

  const handleSaveGuard = async () => {
    if (!editingGuard) return

    try {
      setSaving(true)

      const { error: userError } = await supabase
        .from('users')
        .update({ is_active: formValues.isActive })
        .eq('id', editingGuard.id)

      if (userError) throw userError

      if (!formValues.supervisor) {
        alert('Supervisor is required')
        setSaving(false)
        return
      }

      const { error: supervisorError } = await supabase
        .from('guard_supervisor')
        .upsert({
          guard_id: editingGuard.id,
          supervisor_id: formValues.supervisor,
        })

      if (supervisorError) throw supervisorError

      setIsModalOpen(false)
      setEditingGuard(null)
      await loadGuardData()
    } catch (error: any) {
      console.error('[guards] Save error:', error)
      alert(error?.message || 'Failed to save guard')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkAssignSupervisor = async () => {
    if (!bulkSupervisorId) {
      alert('Please select a supervisor')
      return
    }
    if (selectedGuardIds.length === 0) {
      alert('Please select at least one guard')
      return
    }

    try {
      setBulkAssigning(true)

      const rowsToUpsert = selectedGuardIds.map((guardId) => ({
        guard_id: guardId,
        supervisor_id: bulkSupervisorId,
      }))

      const { error } = await supabase
        .from('guard_supervisor')
        .upsert(rowsToUpsert)

      if (error) throw error

      setSelectedGuardIds([])
      setBulkSupervisorId('')
      await loadGuardData()
    } catch (error: any) {
      console.error('[guards] Bulk supervisor assign error:', error)
      alert(error?.message || 'Failed to bulk assign supervisor')
    } finally {
      setBulkAssigning(false)
    }
  }

  const getAvatarColor = (role: string) => {
    if (role === 'OPERATIONS EXECUTIVE') return 'bg-purple-600'
    if (role === 'NEPALESE SECURITY OFFICER') return 'bg-blue-600'
    return 'bg-teal-600'
  }

  const getStatusColor = (status: string) => {
    if (status === 'Active') return 'bg-green-100 text-green-700'
    if (status === 'On leave') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-200 text-slate-700'
  }

  const getRoleBadgeColor = (role: string) => {
    if (role === 'OPERATIONS EXECUTIVE') return 'bg-purple-100 text-purple-700'
    if (role === 'NEPALESE SECURITY OFFICER') return 'bg-blue-100 text-blue-700'
    return 'bg-teal-100 text-teal-700'
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{dateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{managerName}</p>
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

      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Guard Management</h3>
            <p className="text-sm text-slate-600">{totalGuards} guards across your sites</p>
          </div>
          <Input
            type="text"
            placeholder="Search name, code, site or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72"
          />
        </div>

        <Card className="p-4 border-slate-200 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assign selected guards to supervisor
              </label>
              <select
                value={bulkSupervisorId}
                onChange={(e) => setBulkSupervisorId(e.target.value)}
                className="w-64 px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900"
              >
                <option value="">Select supervisor</option>
                {supervisorList.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Button
                onClick={handleBulkAssignSupervisor}
                disabled={bulkAssigning || selectedGuardIds.length === 0}
                className="bg-slate-700 hover:bg-slate-800"
              >
                {bulkAssigning
                  ? 'Assigning...'
                  : `Bulk Assign Supervisor (${selectedGuardIds.length})`}
              </Button>
            </div>
          </div>
        </Card>

        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 min-w-max">Supervisor:</span>
            <div className="flex gap-2 flex-wrap">
              {supervisors.map((supervisor) => (
                <button
                  key={supervisor}
                  onClick={() => setSupervisorFilter(supervisor)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${supervisorFilter === supervisor
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                >
                  {supervisor}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 min-w-max">Role:</span>
            <div className="flex gap-2 flex-wrap">
              {['All', 'SECURITY OFFICER', 'NEPALESE SECURITY OFFICER'].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${roleFilter === role
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                >
                  {role === 'All' ? 'All' : role.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 min-w-max">Status:</span>
            <div className="flex gap-2 flex-wrap">
              {['All', 'Active', 'On leave', 'Inactive'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${statusFilter === status
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

        <Card className="border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-600">Loading guard data...</div>
          ) : filteredGuards.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              No guards found matching your filters.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Guard
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Employee Code
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Supervisor
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGuards.map((guard) => (
                  <tr key={guard.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedGuardIds.includes(guard.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGuardIds((prev) => [...prev, guard.id])
                          } else {
                            setSelectedGuardIds((prev) =>
                              prev.filter((id) => id !== guard.id)
                            )
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                    </td>

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
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{guard.code}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{guard.siteCode || '—'}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{guard.phone}</span>
                    </td>

                    <td className="px-4 py-3">
                      <Badge className={`border-0 ${getRoleBadgeColor(guard.role)}`}>
                        {guard.role.replace(/_/g, ' ')}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{guard.supervisor || '—'}</span>
                    </td>

                    <td className="px-4 py-3">
                      <Badge className={`border-0 ${getStatusColor(guard.status)}`}>
                        {guard.status}
                      </Badge>
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
          )}
        </Card>

        <div className="mt-4 text-sm text-slate-600">
          Showing {filteredGuards.length} of {totalGuards} guards
        </div>
      </div>

      {isModalOpen && editingGuard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Edit Guard</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Supervisor Assignment
                  </label>
                  <select
                    value={formValues.supervisor || ''}
                    onChange={(e) =>
                      setFormValues({ ...formValues, supervisor: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900"
                  >
                    <option value="">Select supervisor</option>
                    {supervisorList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formValues.isActive || false}
                    onChange={(e) =>
                      setFormValues({ ...formValues, isActive: e.target.checked })
                    }
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
                <Button
                  onClick={handleSaveGuard}
                  disabled={saving}
                  className="bg-slate-700 hover:bg-slate-800"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}