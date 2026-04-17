'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LogOut, ArrowLeft, Edit2, Users, Calendar, MapPin, AlertTriangle, PowerOff, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'
import { toast } from 'sonner'
import { useSiteData } from '@/app/manager/sites/hooks/useSiteData'
import { validateSiteForm, getErrorMessage } from '@/app/manager/sites/lib/site-validation'

interface DeactivationBlocker {
  futureShiftCount: number
  assignedGuardCount: number
  activeShiftDefCount: number
}

interface EditModalState {
  isOpen: boolean
  values: {
    siteCode: string
    name: string
    address: string
    supervisor: string
    latitude: string
    longitude: string
    radius: string
  }
  errors: Record<string, string | undefined>
  supervisorList: { id: string; name: string }[]
  saving: boolean
}

export default function SiteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const siteCode = (params.siteCode as string).toUpperCase()

  const { site, supervisor, shiftDefinitions, todayCoverage, assignedGuards, managerName, loading, error } = useSiteData(siteCode)

  const [dateStr, setDateStr] = useState('')
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    values: { siteCode: '', name: '', address: '', supervisor: 'unassigned', latitude: '', longitude: '', radius: '30' },
    errors: {},
    supervisorList: [],
    saving: false,
  })

  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false)
  const [deactivationBlocker, setDeactivationBlocker] = useState<DeactivationBlocker | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const handleSignOut = () => router.push('/')

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

  const fetchSupervisors = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('external_role', 'OPERATIONS EXECUTIVE')
      .eq('is_active', true)

    return data ? data.map(u => ({ id: u.id, name: u.full_name })) : []
  }

  const handleOpenEditModal = async () => {
    if (!site) return

    const supervisors = await fetchSupervisors()
    setEditModal(prev => ({
      ...prev,
      isOpen: true,
      values: {
        siteCode: site.site_code,
        name: site.name,
        address: site.address || '',
        supervisor: supervisor?.id || 'unassigned',
        latitude: site.latitude != null ? String(site.latitude) : '',
        longitude: site.longitude != null ? String(site.longitude) : '',
        radius: site.geofence_radius != null ? String(site.geofence_radius) : '30',
      },
      supervisorList: supervisors,
      errors: {},
    }))
  }

  const updateEditModalValue = <K extends keyof EditModalState['values']>(
    field: K,
    value: EditModalState['values'][K]
  ) => {
    setEditModal(prev => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      errors: { ...prev.errors, [field]: undefined },
    }))
  }

  const handleSaveEdit = async () => {
    if (!site) return

    // Validate form
    const errors = validateSiteForm({
      name: editModal.values.name,
      siteCode: editModal.values.siteCode,
      latitude: editModal.values.latitude,
      longitude: editModal.values.longitude,
      radius: editModal.values.radius,
    })

    if (Object.keys(errors).length > 0) {
      setEditModal(prev => ({ ...prev, errors }))
      return
    }

    setEditModal(prev => ({ ...prev, saving: true }))

    try {
      // Parse geofence values
      const hasGeo = editModal.values.latitude || editModal.values.longitude
      let geoValues: { lat: number; lon: number; radius: number } | null = null

      if (hasGeo) {
        geoValues = {
          lat: parseFloat(editModal.values.latitude),
          lon: parseFloat(editModal.values.longitude),
          radius: parseInt(editModal.values.radius),
        }
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        site_code: editModal.values.siteCode.toUpperCase(),
        name: editModal.values.name.trim(),
        address: editModal.values.address.trim() || null,
      }

      if (geoValues) {
        updatePayload.latitude = geoValues.lat
        updatePayload.longitude = geoValues.lon
        updatePayload.geofence_radius = geoValues.radius
        updatePayload.has_kiosk = true
      }

      // Update site
      const { error: updateError } = await supabase
        .from('sites')
        .update(updatePayload)
        .eq('id', site.id)

      if (updateError) {
        const message = getErrorMessage(updateError)
        toast.error(message)
        if (updateError.code === '23505') {
          setEditModal(prev => ({ ...prev, errors: { ...prev.errors, siteCode: message } }))
        }
        return
      }

      // Upsert geofence if provided
      if (geoValues) {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('geofence_config').upsert(
          {
            site_id: site.id,
            center_latitude: geoValues.lat,
            center_longitude: geoValues.lon,
            radius_meters: geoValues.radius,
            configured_by_user_id: user?.id,
            last_updated_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: 'site_id' }
        )
      }

      // Update supervisor
      const normalizedSupervisor = editModal.values.supervisor === 'unassigned' ? '' : editModal.values.supervisor
      await supabase.from('supervisor_sites').delete().eq('site_id', site.id)
      if (normalizedSupervisor) {
        await supabase.from('supervisor_sites').insert({
          supervisor_id: normalizedSupervisor,
          site_id: site.id,
        })
      }

      setEditModal(prev => ({ ...prev, isOpen: false }))
      toast.success('Site updated successfully')

      // If site code changed, navigate to new URL
      if (editModal.values.siteCode.toUpperCase() !== site.site_code) {
        router.push(`/manager/sites/${editModal.values.siteCode.toUpperCase()}`)
        return
      }

      // Otherwise refresh the page to show updates
      router.refresh()
    } catch (err) {
      console.error('[v0] Error saving site:', err)
      toast.error('Failed to save site')
    } finally {
      setEditModal(prev => ({ ...prev, saving: false }))
    }
  }

  const handleToggleSiteStatus = async () => {
    if (!site) return

    // Reactivation — no checks
    if (!site.is_active) {
      if (!confirm(`Reactivate ${site.site_code}?`)) return
      try {
        const { error } = await supabase.from('sites').update({ is_active: true }).eq('id', site.id)
        if (error) throw error
        toast.success('Site reactivated')
        router.refresh()
      } catch (err) {
        console.error('[v0] Error reactivating:', err)
        toast.error('Failed to reactivate site')
      }
      return
    }

    // Deactivation — check for blockers
    try {
      const today = getLocalDateString()

      const { data: futureSlotsData } = await supabase
        .from('roster_slots').select('id').eq('site_id', site.id).gte('shift_date', today)

      const futureSlotIds = futureSlotsData?.map(s => s.id) || []
      let assignedGuardCount = 0

      if (futureSlotIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('shift_assignments').select('id, guard_id')
          .in('roster_slot_id', futureSlotIds).eq('is_cancelled', false)
        assignedGuardCount = new Set(assignmentsData?.map(a => a.guard_id) || []).size
      }

      const { data: activeShiftDefs } = await supabase
        .from('shift_definitions').select('id').eq('site_id', site.id).eq('is_active', true)
      const activeShiftDefCount = activeShiftDefs?.length || 0

      // No blockers — simple confirm
      if (futureSlotIds.length === 0 && activeShiftDefCount === 0) {
        if (!confirm(`Deactivate ${site.site_code}? This will hide it from supervisors.`)) return
        await performDeactivation()
        return
      }

      // Blockers exist — show modal
      setDeactivationBlocker({
        futureShiftCount: futureSlotIds.length,
        assignedGuardCount,
        activeShiftDefCount,
      })
      setIsDeactivateModalOpen(true)
    } catch (err) {
      console.error('[v0] Error checking deactivation:', err)
      toast.error('Failed to check site status')
    }
  }

  const performDeactivation = async () => {
    if (!site) return
    try {
      const { error } = await supabase.from('sites').update({ is_active: false }).eq('id', site.id)
      if (error) throw error
      toast.success('Site deactivated')
      router.refresh()
    } catch (err) {
      console.error('[v0] Error deactivating:', err)
      toast.error('Failed to deactivate site')
    }
  }

  const handleForceDeactivate = async () => {
    if (!deactivationBlocker || !site) return
    setDeactivating(true)

    try {
      const today = getLocalDateString()
      const changes: Array<() => Promise<void>> = []

      // Step 1 — Cancel all future assignments
      const { data: futureSlots } = await supabase
        .from('roster_slots').select('id').eq('site_id', site.id).gte('shift_date', today)

      if (futureSlots && futureSlots.length > 0) {
        const slotIds = futureSlots.map(s => s.id)
        const { error } = await supabase.from('shift_assignments')
          .update({ is_cancelled: true }).in('roster_slot_id', slotIds).eq('is_cancelled', false)
        if (error) throw error
      }

      // Step 2 — Deactivate shifts
      const { error: shiftsError } = await supabase.from('shift_definitions')
        .update({ is_active: false }).eq('site_id', site.id).eq('is_active', true)
      if (shiftsError) throw shiftsError

      // Step 3 — Deactivate site
      await performDeactivation()

      setIsDeactivateModalOpen(false)
      setDeactivationBlocker(null)
      toast.success('Site deactivated — all future shifts cancelled')
    } catch (err) {
      console.error('[v0] Error force deactivating:', err)
      toast.error('Failed to deactivate site')
    } finally {
      setDeactivating(false)
    }
  }

  const fillRate = todayCoverage.total > 0
    ? Math.round((todayCoverage.filled / todayCoverage.total) * 100)
    : 100

  const getFillRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-600">Loading site details...</p>
      </div>
    )
  }

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-slate-600">{error || 'Site not found'}</p>
        <Button asChild variant="outline">
          <Link href="/manager/sites">Back to Sites</Link>
        </Button>
      </div>
    )
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
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-slate-600 hover:text-slate-900 mb-4"
          >
            <Link href="/manager/sites">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sites
            </Link>
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{site.name}</h1>
                <Badge variant="outline" className="font-mono">
                  {site.site_code}
                </Badge>
              </div>
              {site.address && (
                <p className="text-slate-600 mt-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {site.address}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild className="bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100">
                <Link href={`/manager/sites/${site.site_code}/schedule`}>
                  <CalendarDays className="w-4 h-4 mr-2" />
                  View Schedule
                </Link>
              </Button>
              <Button variant="outline" onClick={handleOpenEditModal}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={handleToggleSiteStatus}
                className={site.is_active ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
              >
                <PowerOff className="w-4 h-4 mr-2" />
                {site.is_active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Supervisor</p>
            <p className="text-lg font-semibold text-slate-900">
              {supervisor?.name || 'Unassigned'}
            </p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Active Shifts</p>
            <p className="text-lg font-semibold text-slate-900">
              {shiftDefinitions.filter(s => s.is_active).length}
            </p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Today&apos;s Coverage</p>
            <p className={`text-lg font-semibold ${getFillRateColor(fillRate)}`}>
              {todayCoverage.filled}/{todayCoverage.total} ({fillRate}%)
            </p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs text-slate-600 mb-1">Guards Today</p>
            <p className="text-lg font-semibold text-slate-900">{assignedGuards.length}</p>
          </Card>
        </div>

        <Card className="border-slate-200 mb-8">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Shift Definitions
            </h2>
          </div>
          {shiftDefinitions.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              No shift definitions configured for this site.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Shift Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Required Headcount
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shiftDefinitions.map(shift => (
                  <tr key={shift.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{shift.shift_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {shift.start_time} — {shift.end_time}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {shift.required_headcount}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge
                        className={shift.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}
                      >
                        {shift.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Guards Assigned Today
            </h2>
          </div>
          {assignedGuards.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              No guards assigned for today.
            </div>
          ) : (
            <div className="p-4">
              <ul className="space-y-2">
                {assignedGuards.map((guard, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    • {guard}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={editModal.isOpen} onOpenChange={(open) => setEditModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="editSiteCode">Site Code *</Label>
              <Input
                id="editSiteCode"
                type="text"
                maxLength={7}
                value={editModal.values.siteCode}
                onChange={(e) => updateEditModalValue('siteCode', e.target.value.toUpperCase())}
                placeholder="e.g. KLSNT01"
              />
              {editModal.errors.siteCode && (
                <p className="text-xs text-red-600 mt-1">{editModal.errors.siteCode}</p>
              )}
            </div>

            <div>
              <Label htmlFor="editName">Site Name *</Label>
              <Input
                id="editName"
                value={editModal.values.name}
                onChange={(e) => updateEditModalValue('name', e.target.value)}
              />
              {editModal.errors.name && (
                <p className="text-xs text-red-600 mt-1">{editModal.errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="editAddress">Address</Label>
              <textarea
                id="editAddress"
                value={editModal.values.address}
                onChange={(e) => updateEditModalValue('address', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <Label htmlFor="editSupervisor">Supervisor</Label>
              <Select value={editModal.values.supervisor} onValueChange={(v) => updateEditModalValue('supervisor', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {editModal.supervisorList.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Geofence (optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="editLat" className="text-xs text-slate-500">Latitude</Label>
                  <Input
                    id="editLat"
                    type="number"
                    step="any"
                    value={editModal.values.latitude}
                    onChange={(e) => updateEditModalValue('latitude', e.target.value)}
                    placeholder="e.g. 3.1478"
                    className="text-sm"
                  />
                  {editModal.errors.latitude && (
                    <p className="text-xs text-red-600 mt-1">{editModal.errors.latitude}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="editLon" className="text-xs text-slate-500">Longitude</Label>
                  <Input
                    id="editLon"
                    type="number"
                    step="any"
                    value={editModal.values.longitude}
                    onChange={(e) => updateEditModalValue('longitude', e.target.value)}
                    placeholder="e.g. 101.6953"
                    className="text-sm"
                  />
                  {editModal.errors.longitude && (
                    <p className="text-xs text-red-600 mt-1">{editModal.errors.longitude}</p>
                  )}
                </div>
              </div>
              <div className="mt-2">
                <Label htmlFor="editRadius" className="text-xs text-slate-500">Radius (metres, 10–500)</Label>
                <Input
                  id="editRadius"
                  type="number"
                  value={editModal.values.radius}
                  onChange={(e) => updateEditModalValue('radius', e.target.value)}
                  min="10"
                  max="500"
                  className="text-sm"
                />
                {editModal.errors.radius && (
                  <p className="text-xs text-red-600 mt-1">{editModal.errors.radius}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editModal.saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {editModal.saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Blocker Modal */}
      <Dialog open={isDeactivateModalOpen} onOpenChange={setIsDeactivateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Cannot Deactivate — Action Required
            </DialogTitle>
          </DialogHeader>
          {deactivationBlocker && (
            <div className="py-4 space-y-3">
              <p className="text-sm text-slate-700">
                Deactivating <strong>{site.site_code}</strong> will automatically:
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                {deactivationBlocker.futureShiftCount > 0 && (
                  <li>Cancel {deactivationBlocker.futureShiftCount} upcoming roster slot{deactivationBlocker.futureShiftCount !== 1 ? 's' : ''}</li>
                )}
                {deactivationBlocker.assignedGuardCount > 0 && (
                  <li>Unassign {deactivationBlocker.assignedGuardCount} guard{deactivationBlocker.assignedGuardCount !== 1 ? 's' : ''}</li>
                )}
                {deactivationBlocker.activeShiftDefCount > 0 && (
                  <li>Deactivate {deactivationBlocker.activeShiftDefCount} shift definition{deactivationBlocker.activeShiftDefCount !== 1 ? 's' : ''}</li>
                )}
                <li>Mark the site as inactive</li>
              </ul>
              <p className="text-sm text-slate-500">Do you want to proceed?</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsDeactivateModalOpen(false); setDeactivationBlocker(null) }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleForceDeactivate}
              disabled={deactivating}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deactivating ? 'Deactivating...' : 'Deactivate Anyway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
