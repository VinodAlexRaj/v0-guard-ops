'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type Guard = {
  id: string
  name: string
  code: string
  role: string
  phone: string
  isActive: boolean
  supervisorId: string | null
  supervisorName: string
  siteId: string | null
}

type Site = {
  id: string
  site_code: string
  name: string
}

export default function GuardsPage() {
  const [guards, setGuards] = useState<Guard[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [supervisors, setSupervisors] = useState<any[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')

  const [tab, setTab] = useState<'all' | 'site'>('all')

  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGuard, setEditingGuard] = useState<Guard | null>(null)

  const [formValues, setFormValues] = useState({
    supervisor: '',
    isActive: true,
  })

  // =========================
  // LOAD DATA
  // =========================

  const loadData = async () => {
    setLoading(true)

    // Sites
    const { data: siteData } = await supabase
      .from('sites')
      .select('id, site_code, name')

    setSites(siteData || [])

    // Supervisors
    const { data: supData } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        role_mapping!inner(internal_role)
      `)
      .eq('role_mapping.internal_role', 'supervisor')

    setSupervisors(supData || [])

    // Guards
    const { data } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        external_employee_code,
        external_role,
        phone,
        is_active,
        role_mapping!left(internal_role),
        guard_supervisor!left(
          supervisor_id,
          supervisor:users!guard_supervisor_supervisor_id_fkey(full_name)
        ),
        shift_assignments!left(site_id)
      `)

    const guards = (data || [])
      .filter((u: any) => u.role_mapping?.internal_role === 'guard')
      .map((u: any) => ({
        id: u.id,
        name: u.full_name,
        code: u.external_employee_code,
        role: u.external_role,
        phone: u.phone,
        isActive: u.is_active,
        supervisorId: u.guard_supervisor?.[0]?.supervisor_id || null,
        supervisorName:
          u.guard_supervisor?.[0]?.supervisor?.full_name || '—',
        siteId: u.shift_assignments?.[0]?.site_id || null,
      }))

    setGuards(guards)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // =========================
  // FILTER
  // =========================

  const displayedGuards = useMemo(() => {
    if (tab === 'all') return guards
    return guards.filter((g) => g.siteId === selectedSiteId)
  }, [guards, tab, selectedSiteId])

  // =========================
  // EDIT
  // =========================

  const handleEdit = (g: Guard) => {
    setEditingGuard(g)
    setFormValues({
      supervisor: g.supervisorId || '',
      isActive: g.isActive,
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!editingGuard) return

    setSaving(true)

    // update user
    await supabase
      .from('users')
      .update({ is_active: formValues.isActive })
      .eq('id', editingGuard.id)

    // upsert supervisor
    await supabase.from('guard_supervisor').upsert({
      guard_id: editingGuard.id,
      supervisor_id: formValues.supervisor,
    })

    await loadData()
    setIsModalOpen(false)
    setSaving(false)
  }

  // =========================
  // BULK ASSIGN
  // =========================

  const handleBulkAssign = async () => {
    if (!selectedSiteId || selectedGuardIds.length === 0) return

    setSaving(true)

    const payload = selectedGuardIds.map((id) => ({
      id: crypto.randomUUID(),
      site_id: selectedSiteId,
      guard_id: id,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      assignment_type: 'planned',
      is_cancelled: false,
    }))

    await supabase.from('shift_assignments').insert(payload)

    setSelectedGuardIds([])
    await loadData()
    setSaving(false)
  }

  // =========================
  // UI
  // =========================

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 space-y-6">

      {/* Tabs */}
      <div className="flex gap-2">
        <Button onClick={() => setTab('all')} variant={tab === 'all' ? 'default' : 'outline'}>
          All Guards
        </Button>
        <Button onClick={() => setTab('site')} variant={tab === 'site' ? 'default' : 'outline'}>
          By Site
        </Button>
      </div>

      {/* Site Selector */}
      {tab === 'site' && (
        <select
          className="border p-2 rounded"
          value={selectedSiteId}
          onChange={(e) => setSelectedSiteId(e.target.value)}
        >
          <option value="">Select Site</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.site_code}
            </option>
          ))}
        </select>
      )}

      {/* Bulk Assign */}
      {tab === 'site' && (
        <Button onClick={handleBulkAssign} disabled={saving}>
          Bulk Assign to Site
        </Button>
      )}

      {/* Table */}
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100 text-sm">
            {tab === 'site' && <th></th>}
            <th>Name</th>
            <th>Code</th>
            {tab === 'all' && <th>Site</th>}
            <th>Supervisor</th>
            <th>Role</th>
            <th>Status</th>
            <th>Phone</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {displayedGuards.map((g) => (
            <tr key={g.id} className="border-t text-sm">
              {tab === 'site' && (
                <td>
                  <input
                    type="checkbox"
                    checked={selectedGuardIds.includes(g.id)}
                    onChange={(e) => {
                      setSelectedGuardIds((prev) =>
                        e.target.checked
                          ? [...prev, g.id]
                          : prev.filter((id) => id !== g.id)
                      )
                    }}
                  />
                </td>
              )}
              <td>{g.name}</td>
              <td>{g.code}</td>
              {tab === 'all' && <td>{g.siteId || '-'}</td>}
              <td>{g.supervisorName}</td>
              <td>{g.role}</td>
              <td>
                <Badge>{g.isActive ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td>{g.phone}</td>
              <td>
                <Button size="sm" onClick={() => handleEdit(g)}>
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Guard</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {/* Supervisor */}
            <select
              value={formValues.supervisor}
              onChange={(e) =>
                setFormValues((p) => ({ ...p, supervisor: e.target.value }))
              }
              className="w-full border p-2"
            >
              <option value="">Select Supervisor</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>

            {/* Active */}
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(e) =>
                  setFormValues((p) => ({
                    ...p,
                    isActive: e.target.checked,
                  }))
                }
              />
              Active
            </label>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}