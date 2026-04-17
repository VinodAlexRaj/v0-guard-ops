'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { LogOut, Users, Search, UserCheck, Clock, UserX, Edit2, CheckCircle2 } from 'lucide-react'
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

        const overrideSup = (override?.supervisor as any) as { full_name: string } | null
        let supervisor: string | null = overrideSup?.full_name || null
        const supervisorId: string | null = override?.supervisor_id || null

        if (!supervisor && latestSiteId) {
          const supAssignment = supSiteData.find((ss: any) => ss.site_id === latestSiteId)
          const supUser = (supAssignment?.users as any) as { full_name: string } | null
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
      isActive: guard.status !== 'Inactive',
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGuardIds(filteredGuards.map(g => g.id))
    } else {
      setSelectedGuardIds([])
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getAvatarColor = (role: string) => {
    if (role === 'OPERATIONS EXECUTIVE') return 'bg-purple-500'
    if (role === 'NEPALESE SECURITY OFFICER') return 'bg-blue-500'
    return 'bg-teal-500'
  }

  const getStatusBadge = (status: string) => {
    if (status === 'Active') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'On leave') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  const getRoleBadge = (role: string) => {
    if (role === 'OPERATIONS EXECUTIVE') return 'bg-purple-50 text-purple-700'
    if (role === 'NEPALESE SECURITY OFFICER') return 'bg-blue-50 text-blue-700'
    return 'bg-slate-100 text-slate-600'
  }

  const uniqueRoles = useMemo(() => {
    const roles = new Set(allStaff.map(g => g.role))
    return ['All', ...Array.from(roles)]
  }, [allStaff])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-600">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Guard Management</h1>
              <p className="text-xs text-slate-500">{dateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{managerName}</p>
              <Badge variant="secondary" className="text-xs">Manager</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-500 hover:text-slate-700">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 bg-white border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalGuards}</p>
                <p className="text-xs text-slate-500">Total Guards</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{activeGuards}</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{onLeaveGuards}</p>
                <p className="text-xs text-slate-500">On Leave Today</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100">
                <UserX className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{inactiveGuards}</p>
                <p className="text-xs text-slate-500">Inactive</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-4 bg-white border-0 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* Search and Bulk Action Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by name, code, site, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200"
                />
              </div>
              
              {/* Bulk Assignment */}
              <div className="flex items-center gap-3">
                <Select value={bulkSupervisorId} onValueChange={setBulkSupervisorId}>
                  <SelectTrigger className="w-48 bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisorList.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>{sup.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleBulkAssignSupervisor}
                  disabled={bulkAssigning || selectedGuardIds.length === 0}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {bulkAssigning ? 'Assigning...' : `Assign (${selectedGuardIds.length})`}
                </Button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Status:</span>
                <div className="flex gap-1">
                  {['All', 'Active', 'On leave', 'Inactive'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        statusFilter === status
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Role:</span>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueRoles.map((role) => (
                      <SelectItem key={role} value={role} className="text-xs">
                        {role === 'All' ? 'All Roles' : role.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Supervisor:</span>
                <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
                  <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup} value={sup} className="text-xs">
                        {sup === 'All' ? 'All Supervisors' : sup}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto text-xs text-slate-500">
                Showing {filteredGuards.length} of {totalGuards} guards
              </div>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="bg-white border-0 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-3 border-slate-200 border-t-teal-600 rounded-full animate-spin" />
              <p className="mt-3 text-sm text-slate-500">Loading guards...</p>
            </div>
          ) : filteredGuards.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No guards found matching your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-left w-12">
                      <Checkbox
                        checked={selectedGuardIds.length === filteredGuards.length && filteredGuards.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Guard</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Site</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Supervisor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGuards.map((guard) => (
                    <tr key={guard.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedGuardIds.includes(guard.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedGuardIds((prev) => [...prev, guard.id])
                            } else {
                              setSelectedGuardIds((prev) => prev.filter((id) => id !== guard.id))
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(guard.role)}`}>
                            {getInitials(guard.name)}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{guard.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600 font-mono">{guard.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        {guard.siteCode !== '—' ? (
                          <Badge variant="outline" className="text-xs font-mono">{guard.siteCode}</Badge>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{guard.phone}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border-0 ${getRoleBadge(guard.role)}`}>
                          {guard.role.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{guard.supervisor || <span className="text-slate-400">Unassigned</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${getStatusBadge(guard.status)}`}>
                          {guard.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">{guard.joined}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditGuard(guard)}
                          className="text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {/* Edit Guard Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {editingGuard && (
                <>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(editingGuard.role)}`}>
                    {getInitials(editingGuard.name)}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{editingGuard.name}</p>
                    <p className="text-sm text-slate-500 font-normal">{editingGuard.code}</p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supervisor Assignment</Label>
              <Select
                value={formValues.supervisor}
                onValueChange={(value) => setFormValues({ ...formValues, supervisor: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisorList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Checkbox
                id="is-active"
                checked={formValues.isActive}
                onCheckedChange={(checked) => setFormValues({ ...formValues, isActive: !!checked })}
              />
              <Label htmlFor="is-active" className="text-sm cursor-pointer">
                Guard is active and can be assigned to shifts
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGuard} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
