'use client'

import { useState, useMemo, useEffect } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { LogOut, ArrowRight, Plus, UserCheck, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'

interface SiteRow {
  siteId: string
  code: string
  name: string
  supervisor: string
  supervisorId: string | null
  activeShifts: number
  fillRate: number
  openSlots: number
  status: string
}

interface SupervisorUser {
  id: string
  name: string
}

export default function ManagerSitesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [dateStr, setDateStr] = useState('')
  const [managerName, setManagerName] = useState('User')
  const [allSites, setAllSites] = useState<SiteRow[]>([])
  const [supervisors, setSupervisors] = useState<string[]>(['All'])
  const [totalSites, setTotalSites] = useState(0)
  const [sitesWithGaps, setSitesWithGaps] = useState(0)
  const [fullyFilled, setFullyFilled] = useState(0)

  const [showAddSite, setShowAddSite] = useState(false)
  const [newSiteCode, setNewSiteCode] = useState('')
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteAddress, setNewSiteAddress] = useState('')
  const [addSiteLoading, setAddSiteLoading] = useState(false)
  const [addSiteError, setAddSiteError] = useState('')

  const [supervisorUsers, setSupervisorUsers] = useState<SupervisorUser[]>([])
  const [showAssignSupervisor, setShowAssignSupervisor] = useState(false)
  const [assigningSite, setAssigningSite] = useState<SiteRow | null>(null)
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignError, setAssignError] = useState('')

  // Bulk selection
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set())
  const [bulkSupervisorId, setBulkSupervisorId] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const handleSignOut = () => {
    router.push('/')
  }

  const handleViewSite = (siteCode: string) => {
    router.push(`/manager/sites/${siteCode}`)
  }

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddSiteError('')
    setAddSiteLoading(true)

    const code = newSiteCode.trim().toUpperCase()
    const name = newSiteName.trim()
    const address = newSiteAddress.trim() || null

    if (!code || !name) {
      setAddSiteError('Site code and name are required.')
      setAddSiteLoading(false)
      return
    }

    const { error } = await supabase
      .from('sites')
      .insert({ site_code: code, name, address })

    if (error) {
      setAddSiteError(
        error.code === '23505'
          ? `Site code "${code}" already exists.`
          : error.message
      )
      setAddSiteLoading(false)
      return
    }

    // Reset form and close dialog
    setNewSiteCode('')
    setNewSiteName('')
    setNewSiteAddress('')
    setShowAddSite(false)
    setAddSiteLoading(false)

    // Re-fetch sites to include the new one
    setAllSites([])
    setLoading(true)
    fetchSites()
  }

  const handleOpenAssign = (site: SiteRow) => {
    setAssigningSite(site)
    setSelectedSupervisorId(site.supervisorId || '')
    setAssignError('')
    setShowAssignSupervisor(true)
  }

  const handleSaveAssignment = async () => {
    if (!assigningSite) return
    setAssignLoading(true)
    setAssignError('')

    // Remove all existing supervisor assignments for this site
    const { error: deleteError } = await supabase
      .from('supervisor_sites')
      .delete()
      .eq('site_id', assigningSite.siteId)

    if (deleteError) {
      setAssignError(deleteError.message)
      setAssignLoading(false)
      return
    }

    // Insert new assignment if a supervisor was selected (empty = unassign)
    if (selectedSupervisorId) {
      const { error: insertError } = await supabase
        .from('supervisor_sites')
        .insert({ supervisor_id: selectedSupervisorId, site_id: assigningSite.siteId })

      if (insertError) {
        setAssignError(insertError.message)
        setAssignLoading(false)
        return
      }
    }

    setShowAssignSupervisor(false)
    setAssignLoading(false)
    fetchSites()
  }

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds(prev => {
      const next = new Set(prev)
      next.has(siteId) ? next.delete(siteId) : next.add(siteId)
      return next
    })
  }

  const toggleAll = (filteredRows: SiteRow[]) => {
    const allSelected = filteredRows.every(s => selectedSiteIds.has(s.siteId))
    if (allSelected) {
      setSelectedSiteIds(new Set())
    } else {
      setSelectedSiteIds(new Set(filteredRows.map(s => s.siteId)))
    }
  }

  const handleBulkAssign = async () => {
    if (!bulkSupervisorId || selectedSiteIds.size === 0) return
    setBulkLoading(true)
    setBulkError('')

    const siteIdArray = Array.from(selectedSiteIds)

    // Delete all existing supervisor assignments for selected sites
    const { error: deleteError } = await supabase
      .from('supervisor_sites')
      .delete()
      .in('site_id', siteIdArray)

    if (deleteError) {
      setBulkError(deleteError.message)
      setBulkLoading(false)
      return
    }

    // Insert new assignment for each selected site
    const { error: insertError } = await supabase
      .from('supervisor_sites')
      .insert(siteIdArray.map(siteId => ({
        supervisor_id: bulkSupervisorId,
        site_id: siteId,
      })))

    if (insertError) {
      setBulkError(insertError.message)
      setBulkLoading(false)
      return
    }

    setSelectedSiteIds(new Set())
    setBulkSupervisorId('')
    setBulkLoading(false)
    fetchSites()
  }

  // Set date on mount
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

  // Fetch real data from Supabase
  const fetchSites = async () => {
    try {
      setLoading(true)

      // FETCH 1 — Get all sites
      const { data: sites } = await supabase
        .from('sites')
        .select('id, site_code, name, address')

      if (!sites || sites.length === 0) {
        setLoading(false)
        return
      }

      const siteIds = sites.map(s => s.id)

      // Get current manager name
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (userData?.full_name) setManagerName(userData.full_name)

      // FETCH 2 — Get today's coverage
      const today = getLocalDateString()
      const { data: coverage } = await supabase
        .from('roster_coverage')
        .select('site_id, assigned, required_headcount')
        .in('site_id', siteIds)
        .eq('shift_date', today)

      // FETCH 3 — Get shift definitions count per site
      const { data: shiftDefs } = await supabase
        .from('shift_definitions')
        .select('id, site_id')
        .in('site_id', siteIds)
        .eq('is_active', true)

      // FETCH 4 — Get supervisor assignments
      const { data: supSites } = await supabase
        .from('supervisor_sites')
        .select('supervisor_id, site_id, users(full_name)')

      // FETCH 5 — Get all supervisors for assign dialog (via users_with_role)
      const { data: supervisorRoles } = await supabase
        .from('users_with_role')
        .select('id')
        .eq('role', 'supervisor')

      const supervisorIds = (supervisorRoles || []).map(r => r.id)
      if (supervisorIds.length > 0) {
        const { data: supUsers } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', supervisorIds)
          .eq('is_active', true)
          .order('full_name')
        setSupervisorUsers((supUsers || []).map(u => ({ id: u.id, name: u.full_name })))
      }

      // BUILD TABLE ROWS
      const covData = coverage || []
      const shiftData = shiftDefs || []
      const supData = supSites || []

      const rows: SiteRow[] = sites.map(site => {
        const siteCov = covData.filter(c => c.site_id === site.id)
        const totalRequired = siteCov.reduce((sum, c) => sum + c.required_headcount, 0)
        const totalAssigned = siteCov.reduce((sum, c) => sum + c.assigned, 0)
        const fillRate = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100
        const openSlots = Math.max(0, totalRequired - totalAssigned)

        const activeShifts = shiftData.filter(sd => sd.site_id === site.id).length
        const supervisorAssignment = supData.find(ss => ss.site_id === site.id)
        const supervisor = supervisorAssignment?.users?.full_name || 'Unassigned'
        const supervisorId = supervisorAssignment?.supervisor_id || null

        return {
          siteId: site.id,
          code: site.site_code,
          name: site.name,
          supervisor,
          supervisorId,
          activeShifts: activeShifts || 0,
          fillRate,
          openSlots,
          status: 'Active',
        }
      })

      setAllSites(rows)

      // Calculate summary stats
      const gaps = rows.filter(r => r.openSlots > 0).length
      const filled = rows.filter(r => r.openSlots === 0).length

      setTotalSites(rows.length)
      setSitesWithGaps(gaps)
      setFullyFilled(filled)

      // Extract unique supervisor names for filter
      const uniqueSupervisors = ['All', ...new Set(rows.map(r => r.supervisor).filter(s => s !== 'Unassigned'))]
      setSupervisors(uniqueSupervisors)
    } catch (error) {
      console.error('[v0] Error fetching sites:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSites()
  }, [])

  // Filter and search
  const filteredSites = useMemo(() => {
    return allSites.filter((site) => {
      const matchesSearch =
        !searchQuery ||
        site.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesSupervisor = supervisorFilter === 'All' || site.supervisor === supervisorFilter
      const matchesStatus = statusFilter === 'All' || site.status === statusFilter

      return matchesSearch && matchesSupervisor && matchesStatus
    })
  }, [allSites, searchQuery, supervisorFilter, statusFilter])

  const allFilteredSelected =
    filteredSites.length > 0 && filteredSites.every(s => selectedSiteIds.has(s.siteId))
  const someFilteredSelected =
    filteredSites.some(s => selectedSiteIds.has(s.siteId)) && !allFilteredSelected
  const anySelected = selectedSiteIds.size > 0

  const getFillRateColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-700 border-0'
    if (rate >= 50) return 'bg-amber-100 text-amber-700 border-0'
    return 'bg-red-100 text-red-700 border-0'
  }

  return (
    <>
      {/* Top Navigation */}
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

      {/* Page Content */}
      <div className={`p-8 ${anySelected ? 'pb-28' : ''}`}>
        {/* Header with Search */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 mb-1">All Sites</h1>
            <p className="text-sm text-slate-600">{totalSites} sites across {supervisors.length - 1} supervisors</p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="Search site code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Button
              onClick={() => { setAddSiteError(''); setShowAddSite(true) }}
              className="bg-slate-900 hover:bg-slate-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Site
            </Button>
          </div>
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
            <div className="text-2xl font-bold text-blue-600">{totalSites}</div>
          </Card>
          <Card className="bg-red-50 border-red-200 p-4">
            <div className="text-sm text-slate-600">Sites with gaps today</div>
            <div className="text-2xl font-bold text-red-600">{sitesWithGaps}</div>
          </Card>
          <Card className="bg-green-50 border-green-200 p-4">
            <div className="text-sm text-slate-600">Fully filled</div>
            <div className="text-2xl font-bold text-green-600">{fullyFilled}</div>
          </Card>
        </div>

        {/* Sites Table */}
        <Card className="border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-600">Loading sites data...</div>
          ) : filteredSites.length === 0 ? (
            <div className="p-8 text-center text-slate-600">No sites found matching your filters.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={someFilteredSelected ? 'indeterminate' : allFilteredSelected}
                      onCheckedChange={() => toggleAll(filteredSites)}
                      aria-label="Select all"
                    />
                  </th>
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
                  <tr
                    key={idx}
                    className={`border-b border-slate-200 hover:bg-slate-50 ${
                      selectedSiteIds.has(site.siteId) ? 'bg-slate-100' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedSiteIds.has(site.siteId)}
                        onCheckedChange={() => toggleSite(site.siteId)}
                        aria-label={`Select ${site.name}`}
                      />
                    </td>
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
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAssign(site)}
                          className="text-slate-700 border-slate-300 hover:bg-slate-50"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                          {site.supervisor === 'Unassigned' ? 'Assign' : 'Reassign'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSite(site.code)}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          View
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Footer */}
        <div className="mt-4">
          <span className="text-sm text-slate-600">Showing {filteredSites.length} of {totalSites} sites</span>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {anySelected && (
        <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-8 py-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Users className="w-4 h-4 text-slate-500" />
              {selectedSiteIds.size} site{selectedSiteIds.size !== 1 ? 's' : ''} selected
            </div>
            <button
              onClick={() => { setSelectedSiteIds(new Set()); setBulkSupervisorId(''); setBulkError('') }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          <div className="flex items-center gap-3">
            {bulkError && (
              <p className="text-sm text-red-600">{bulkError}</p>
            )}
            <Select value={bulkSupervisorId} onValueChange={setBulkSupervisorId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select supervisor..." />
              </SelectTrigger>
              <SelectContent>
                {supervisorUsers.map(sup => (
                  <SelectItem key={sup.id} value={sup.id}>
                    {sup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleBulkAssign}
              disabled={!bulkSupervisorId || bulkLoading}
              className="bg-slate-900 hover:bg-slate-700 text-white disabled:opacity-50"
            >
              {bulkLoading
                ? 'Assigning...'
                : `Assign to ${selectedSiteIds.size} site${selectedSiteIds.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Add Site Dialog */}
      <Dialog open={showAddSite} onOpenChange={setShowAddSite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add new site</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSite}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="site-code">Site code</FieldLabel>
                <Input
                  id="site-code"
                  placeholder="e.g. KLSNT01"
                  value={newSiteCode}
                  onChange={(e) => setNewSiteCode(e.target.value.toUpperCase())}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="site-name">Site name</FieldLabel>
                <Input
                  id="site-name"
                  placeholder="e.g. Sentral Tower"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="site-address">Address <span className="text-slate-400 font-normal">(optional)</span></FieldLabel>
                <Input
                  id="site-address"
                  placeholder="e.g. Jalan Stesen Sentral 5, KL"
                  value={newSiteAddress}
                  onChange={(e) => setNewSiteAddress(e.target.value)}
                />
              </Field>
              {addSiteError && (
                <p className="text-sm text-red-600">{addSiteError}</p>
              )}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddSite(false)}
                disabled={addSiteLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addSiteLoading}
                className="bg-slate-900 hover:bg-slate-700 text-white"
              >
                {addSiteLoading ? 'Saving...' : 'Add site'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Assign Supervisor Dialog */}
      <Dialog open={showAssignSupervisor} onOpenChange={setShowAssignSupervisor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign supervisor</DialogTitle>
          </DialogHeader>

          {assigningSite && (
            <div className="space-y-4">
              {/* Site info */}
              <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-500 mb-0.5">Site</p>
                <p className="text-sm font-semibold text-slate-900">{assigningSite.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{assigningSite.code}</p>
              </div>

              {/* Current supervisor */}
              <div>
                <p className="text-xs text-slate-500 mb-1">Current supervisor</p>
                <p className="text-sm text-slate-700">
                  {assigningSite.supervisor === 'Unassigned'
                    ? <span className="text-slate-400 italic">Unassigned</span>
                    : assigningSite.supervisor}
                </p>
              </div>

              {/* Supervisor select */}
              <Field>
                <FieldLabel htmlFor="assign-supervisor">New supervisor</FieldLabel>
                <Select
                  value={selectedSupervisorId}
                  onValueChange={setSelectedSupervisorId}
                >
                  <SelectTrigger id="assign-supervisor" className="w-full">
                    <SelectValue placeholder="Select a supervisor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Unassign —</SelectItem>
                    {supervisorUsers.map(sup => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {assignError && (
                <p className="text-sm text-red-600">{assignError}</p>
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowAssignSupervisor(false)}
              disabled={assignLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAssignment}
              disabled={assignLoading}
              className="bg-slate-900 hover:bg-slate-700 text-white"
            >
              {assignLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
