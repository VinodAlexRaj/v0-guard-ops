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
import { LogOut, ArrowLeft, Edit2, Users, Calendar, MapPin, AlertTriangle, PowerOff } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'
import { toast } from 'sonner'

interface SiteData {
  id: string
  site_code: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  geofence_radius: number | null
  is_active: boolean
}

interface DeactivationBlocker {
  futureShiftCount: number
  assignedGuardCount: number
  activeShiftDefCount: number
}

interface ShiftDefinition {
  id: string
  shift_name: string
  start_time: string
  end_time: string
  required_headcount: number
  is_active: boolean
}

export default function SiteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const siteCode = (params.siteCode as string).toUpperCase()

  const [loading, setLoading] = useState(true)
  const [dateStr, setDateStr] = useState('')
  const [managerName, setManagerName] = useState('User')
  const [site, setSite] = useState<SiteData | null>(null)
  const [supervisor, setSupervisor] = useState<{ id: string; name: string } | null>(null)
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([])
  const [todayCoverage, setTodayCoverage] = useState({ filled: 0, total: 0 })
  const [assignedGuards, setAssignedGuards] = useState<string[]>([])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editSupervisor, setEditSupervisor] = useState('unassigned')
  const [editSiteCode, setEditSiteCode] = useState('')
  const [editSiteCodeError, setEditSiteCodeError] = useState('')
  const [editLatitude, setEditLatitude] = useState('')
  const [editLongitude, setEditLongitude] = useState('')
  const [editRadius, setEditRadius] = useState('30')
  const [supervisorList, setSupervisorList] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)

  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false)
  const [deactivationBlocker, setDeactivationBlocker] = useState<DeactivationBlocker | null>(null)
  const [deactivating, setDeactivating] = useState(false)

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

  useEffect(() => {
    const fetchSiteData = async () => {
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

        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('id, site_code, name, address, latitude, longitude, geofence_radius, is_active')
          .eq('site_code', siteCode)
          .single()

        if (siteError || !siteData) {
          console.error('[v0] Site not found:', siteError)
          setLoading(false)
          return
        }

        setSite(siteData)

        const { data: supAssignment } = await supabase
          .from('supervisor_sites')
          .select('supervisor_id, users(id, full_name)')
          .eq('site_id', siteData.id)
          .single()

        if (supAssignment?.users && supAssignment.users.length > 0) {
          const user = supAssignment.users[0]

          setSupervisor({
            id: supAssignment.supervisor_id,
            name: user.full_name,
          })
        }

        const { data: shifts } = await supabase
          .from('shift_definitions')
          .select('id, shift_name, start_time, end_time, required_headcount, is_active')
          .eq('site_id', siteData.id)
          .order('start_time')

        setShiftDefinitions(shifts || [])

        const today = getLocalDateString()
        const { data: coverage } = await supabase
          .from('roster_coverage')
          .select('assigned, required_headcount')
          .eq('site_id', siteData.id)
          .eq('shift_date', today)

        const totalRequired = (coverage || []).reduce((sum, c) => sum + c.required_headcount, 0)
        const totalAssigned = (coverage || []).reduce((sum, c) => sum + c.assigned, 0)
        setTodayCoverage({ filled: totalAssigned, total: totalRequired })

        const { data: assignments } = await supabase
          .from('shift_assignments')
          .select('guard_id, users(full_name)')
          .eq('site_id', siteData.id)
          .eq('shift_date', today)
          .eq('is_cancelled', false)

        const guardNames = [
          ...new Set(
            (assignments || [])
              .map(a => a.users?.[0]?.full_name)
              .filter(Boolean)
          ),
        ] as string[]

        setAssignedGuards(guardNames)
      } catch (error) {
        console.error('[v0] Error fetching site data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSiteData()
  }, [siteCode])

  const fetchSupervisors = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('external_role', 'OPERATIONS EXECUTIVE')
      .eq('is_active', true)

    return data ? data.map(u => ({ id: u.id, name: u.full_name })) : []
  }

  const validateSiteCode = (code: string) => /^[A-Z]{5}[0-9]{2}$/.test(code)

  const handleOpenEditModal = () => {
    if (!site) return

    setEditSiteCode(site.site_code)
    setEditSiteCodeError('')
    setEditName(site.name)
    setEditAddress(site.address || '')
    setEditSupervisor(supervisor?.id || 'unassigned')
    setEditLatitude(site.latitude != null ? String(site.latitude) : '')
    setEditLongitude(site.longitude != null ? String(site.longitude) : '')
    setEditRadius(site.geofence_radius != null ? String(site.geofence_radius) : '30')
    setIsEditModalOpen(true)

    fetchSupervisors()
      .then((supervisors) => {
        setSupervisorList(supervisors)
      })
      .catch((err) => {
        console.error('[v0] Error fetching supervisors:', err)
      })
  }

  const handleSaveEdit = async () => {
    if (!site) return
    if (!editName.trim()) { alert('Site name is required'); return }
    if (!validateSiteCode(editSiteCode)) {
      setEditSiteCodeError('Format: 5 letters + 2 digits (e.g. KLSNT01)')
      return
    }

    // Validate geofence if provided
    let geoValues: { lat: number; lon: number; radius: number } | null = null
    if (editLatitude || editLongitude) {
      const lat = parseFloat(editLatitude)
      const lon = parseFloat(editLongitude)
      const radius = parseInt(editRadius)
      if (isNaN(lat) || isNaN(lon) || isNaN(radius) || radius < 10 || radius > 500) {
        alert('Enter valid coordinates and radius (10–500 m)')
        return
      }
      geoValues = { lat, lon, radius }
    }

    setSaving(true)
    try {
      const updatePayload: Record<string, unknown> = {
        site_code: editSiteCode.toUpperCase(),
        name: editName.trim(),
        address: editAddress.trim() || null,
      }
      if (geoValues) {
        updatePayload.latitude = geoValues.lat
        updatePayload.longitude = geoValues.lon
        updatePayload.geofence_radius = geoValues.radius
        updatePayload.has_kiosk = true
      }

      const { error: updateError } = await supabase
        .from('sites')
        .update(updatePayload)
        .eq('id', site.id)

      if (updateError) {
        if (updateError.code === '23505') {
          setEditSiteCodeError('Site code already exists')
        } else {
          alert('Error updating site: ' + updateError.message)
        }
        setSaving(false)
        return
      }

      // Upsert geofence_config if geo provided
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

      // Update supervisor assignment
      const normalizedSupervisor = editSupervisor === 'unassigned' ? '' : editSupervisor
      await supabase.from('supervisor_sites').delete().eq('site_id', site.id)
      if (normalizedSupervisor) {
        await supabase.from('supervisor_sites').insert({
          supervisor_id: normalizedSupervisor,
          site_id: site.id,
        })
      }

      setIsEditModalOpen(false)

      // If site code changed, redirect to new URL
      if (editSiteCode.toUpperCase() !== site.site_code) {
        router.push(`/manager/sites/${editSiteCode.toUpperCase()}`)
        return
      }

      // Otherwise update local state
      setSite(prev => prev ? {
        ...prev,
        site_code: editSiteCode.toUpperCase(),
        name: editName.trim(),
        address: editAddress.trim() || null,
        latitude: geoValues?.lat ?? prev.latitude,
        longitude: geoValues?.lon ?? prev.longitude,
        geofence_radius: geoValues?.radius ?? prev.geofence_radius,
      } : prev)

      if (editSupervisor === 'unassigned') {
        setSupervisor(null)
      } else {
        const selected = supervisorList.find(s => s.id === editSupervisor)
        if (selected) setSupervisor(selected)
      }
    } catch (error) {
      console.error('[v0] Error saving site:', error)
      alert('Error saving site')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSiteStatus = async () => {
    if (!site) return

    // Reactivation — no checks needed
    if (!site.is_active) {
      if (!confirm(`Reactivate ${site.site_code}?`)) return
      try {
        const { error } = await supabase.from('sites').update({ is_active: true }).eq('id', site.id)
        if (error) throw error
        setSite(prev => prev ? { ...prev, is_active: true } : prev)
        toast.success('Site reactivated')
      } catch (err) {
        console.error('[v0] Error reactivating site:', err)
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
      const futureShiftCount = futureSlotIds.length
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
      if (futureShiftCount === 0 && activeShiftDefCount === 0) {
        if (!confirm(`Deactivate ${site.site_code}? This will hide it from supervisors.`)) return
        await performDeactivation()
        return
      }

      // Blockers exist — show modal
      setDeactivationBlocker({ futureShiftCount, assignedGuardCount, activeShiftDefCount })
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
      setSite(prev => prev ? { ...prev, is_active: false } : prev)
      toast.success('Site deactivated')
    } catch (err) {
      console.error('[v0] Error deactivating site:', err)
      toast.error('Failed to deactivate site')
    }
  }

  const handleForceDeactivate = async () => {
    if (!deactivationBlocker || !site) return
    setDeactivating(true)
    try {
      const today = getLocalDateString()

      // Step 1 — Cancel all future shift assignments
      const { data: futureSlots } = await supabase
        .from('roster_slots').select('id').eq('site_id', site.id).gte('shift_date', today)

      if (futureSlots && futureSlots.length > 0) {
        const slotIds = futureSlots.map(s => s.id)
        await supabase.from('shift_assignments')
          .update({ is_cancelled: true }).in('roster_slot_id', slotIds).eq('is_cancelled', false)
      }

      // Step 2 — Deactivate all shift definitions
      await supabase.from('shift_definitions')
        .update({ is_active: false }).eq('site_id', site.id).eq('is_active', true)

      // Step 3 — Deactivate the site
      await performDeactivation()

      setIsDeactivateModalOpen(false)
      setDeactivationBlocker(null)
      toast.success('Site deactivated — all future shifts cancelled and shift definitions deactivated')
    } catch (err) {
      console.error('[v0] Error force deactivating site:', err)
      toast.error('Failed to deactivate site')
    } finally {
      setDeactivating(false)
    }
  }

  const fillRate =
    todayCoverage.total > 0
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
        <p className="text-slate-600">Site not found</p>
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
              <tbody>
                {shiftDefinitions.map((shift) => (
                  <tr key={shift.id} className="border-b border-slate-200">
                    <td className="px-4 py-3 text-sm text-slate-900">{shift.shift_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {shift.required_headcount}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          shift.is_active
                            ? 'bg-green-100 text-green-700 border-0'
                            : 'bg-slate-100 text-slate-600 border-0'
                        }
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
            <div className="p-4 flex flex-wrap gap-2">
              {assignedGuards.map((guard, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm py-1 px-3">
                  {guard}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editSiteCode">Site Code *</Label>
              <Input
                id="editSiteCode"
                type="text"
                maxLength={7}
                value={editSiteCode}
                onChange={(e) => {
                  setEditSiteCode(e.target.value.toUpperCase())
                  setEditSiteCodeError('')
                }}
                placeholder="e.g. KLSNT01"
              />
              {editSiteCodeError && (
                <p className="text-xs text-red-600">{editSiteCodeError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSiteName">Site Name *</Label>
              <Input
                id="editSiteName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSiteAddress">Address</Label>
              <textarea
                id="editSiteAddress"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSupervisor">Assign Supervisor</Label>
              <Select value={editSupervisor} onValueChange={setEditSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {supervisorList.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Geofence (optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="editLat" className="text-xs text-slate-500">Latitude</Label>
                  <Input
                    id="editLat"
                    type="number"
                    step="any"
                    value={editLatitude}
                    onChange={(e) => setEditLatitude(e.target.value)}
                    placeholder="e.g. 3.1478"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="editLon" className="text-xs text-slate-500">Longitude</Label>
                  <Input
                    id="editLon"
                    type="number"
                    step="any"
                    value={editLongitude}
                    onChange={(e) => setEditLongitude(e.target.value)}
                    placeholder="e.g. 101.6953"
                    className="text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editRadius" className="text-xs text-slate-500">Radius (metres, 10–500)</Label>
                <Input
                  id="editRadius"
                  type="number"
                  value={editRadius}
                  onChange={(e) => setEditRadius(e.target.value)}
                  min="10"
                  max="500"
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? 'Saving...' : 'Save Changes'}
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
                  <li>Unassign {deactivationBlocker.assignedGuardCount} guard{deactivationBlocker.assignedGuardCount !== 1 ? 's' : ''} from those shifts</li>
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
              className="text-slate-700 border-slate-300"
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
