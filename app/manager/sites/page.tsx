'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { LogOut, Eye, Plus, Pencil, PowerOff, AlertTriangle, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'
import { toast } from 'sonner'

interface Site {
  id: string
  site_code: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  has_kiosk: boolean
  geofence_radius: number
  is_active: boolean
}

interface Supervisor {
  id: string
  full_name: string
}

interface SiteData {
  site: Site
  supervisor: string | null
  supervisorId: string | null
  activeShifts: number
  kioskStatus: 'active' | 'offline' | 'none'
  deviceCount: number
  onlineDevices: number
  checkInsToday: number
}

interface DeactivationBlocker {
  futureShiftCount: number
  assignedGuardCount: number
  activeShiftDefCount: number
  siteData: SiteData
}

export default function ManagerSitesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [kioskFilter, setKioskFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [loading, setLoading] = useState(true)
  const [dateStr, setDateStr] = useState('')
  const [managerName, setManagerName] = useState('User')
  const [managerId, setManagerId] = useState<string | null>(null)
  const [allSites, setAllSites] = useState<SiteData[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])

  // Add Site modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addSiteCode, setAddSiteCode] = useState('')
  const [addSiteName, setAddSiteName] = useState('')
  const [addSiteAddress, setAddSiteAddress] = useState('')
  const [addSupervisorId, setAddSupervisorId] = useState('')
  const [addLatitude, setAddLatitude] = useState('')
  const [addLongitude, setAddLongitude] = useState('')
  const [addRadius, setAddRadius] = useState('30')
  const [addSiteCodeError, setAddSiteCodeError] = useState('')
  const [savingAddSite, setSavingAddSite] = useState(false)

  // Edit Site modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editSite, setEditSite] = useState<SiteData | null>(null)
  const [editSiteCode, setEditSiteCode] = useState('')
  const [editSiteName, setEditSiteName] = useState('')
  const [editSiteAddress, setEditSiteAddress] = useState('')
  const [editSupervisorId, setEditSupervisorId] = useState('')
  const [editLatitude, setEditLatitude] = useState('')
  const [editLongitude, setEditLongitude] = useState('')
  const [editRadius, setEditRadius] = useState('30')
  const [editSiteCodeError, setEditSiteCodeError] = useState('')
  const [savingEditSite, setSavingEditSite] = useState(false)

  // Deactivation blocker modal state
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false)
  const [deactivationBlocker, setDeactivationBlocker] = useState<DeactivationBlocker | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Summary stats
  const [totalSites, setTotalSites] = useState(0)
  const [sitesWithKiosk, setSitesWithKiosk] = useState(0)
  const [geofenceConfigured, setGeofenceConfigured] = useState(0)
  const [totalCheckinsToday, setTotalCheckinsToday] = useState(0)

  const handleSignOut = () => router.push('/')
  const handleViewSite = (siteCode: string) => router.push(`/manager/sites/${siteCode}`)

  const validateSiteCode = (code: string) => /^[A-Z]{5}[0-9]{2}$/.test(code)

  // ─── GEOFENCE HELPERS ────────────────────────────────────────────────────────
  const saveGeofenceConfig = async (
    siteId: string,
    lat: number,
    lon: number,
    radius: number,
    userId: string
  ) => {
    const { error } = await supabase.from('geofence_config').upsert(
      {
        site_id: siteId,
        center_latitude: lat,
        center_longitude: lon,
        radius_meters: radius,
        configured_by_user_id: userId,
        last_updated_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: 'site_id' }
    )
    return error
  }

  const parseCoordsAndRadius = (latStr: string, lonStr: string, radiusStr: string) => {
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)
    const radius = parseInt(radiusStr)
    const valid =
      !isNaN(lat) && !isNaN(lon) && !isNaN(radius) && radius >= 10 && radius <= 500
    return { lat, lon, radius, valid }
  }

  // ─── SUPERVISOR ASSIGNMENT ───────────────────────────────────────────────────
  const upsertSupervisorSite = async (supervisorId: string, siteId: string) => {
    await supabase.from('supervisor_sites').delete().eq('site_id', siteId)
    if (supervisorId) {
      const { error } = await supabase
        .from('supervisor_sites')
        .insert({ supervisor_id: supervisorId, site_id: siteId })
      return error
    }
    return null
  }

  // ─── ADD SITE ────────────────────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    setAddSiteCode('')
    setAddSiteName('')
    setAddSiteAddress('')
    setAddSupervisorId('')
    setAddLatitude('')
    setAddLongitude('')
    setAddRadius('30')
    setAddSiteCodeError('')
    setIsAddModalOpen(true)
  }

  const handleAddSite = async () => {
    if (!addSiteName.trim()) { toast.error('Site name is required'); return }
    if (!validateSiteCode(addSiteCode)) {
      setAddSiteCodeError('Format: 5 letters + 2 digits (e.g. KLSNT01)')
      return
    }

    const hasGeo = addLatitude || addLongitude || addRadius !== '30'
    let geoValues: { lat: number; lon: number; radius: number } | null = null
    if (hasGeo) {
      const parsed = parseCoordsAndRadius(addLatitude, addLongitude, addRadius)
      if (!parsed.valid) {
        toast.error('Enter valid coordinates and radius (10–500 m)')
        return
      }
      geoValues = parsed
    }

    setSavingAddSite(true)
    try {
      const { data: newSite, error } = await supabase
        .from('sites')
        .insert({
          site_code: addSiteCode.toUpperCase(),
          name: addSiteName.trim(),
          address: addSiteAddress.trim() || null,
          is_active: true,
          has_kiosk: !!geoValues,
          latitude: geoValues?.lat ?? null,
          longitude: geoValues?.lon ?? null,
          geofence_radius: geoValues?.radius ?? 30,
        })
        .select('id')
        .single()

      if (error) {
        if (error.code === '23505') toast.error('Site code already exists')
        else throw error
        return
      }

      const siteId = newSite.id
      if (geoValues && managerId) {
        await saveGeofenceConfig(siteId, geoValues.lat, geoValues.lon, geoValues.radius, managerId)
      }
      if (addSupervisorId) {
        await upsertSupervisorSite(addSupervisorId, siteId)
      }

      toast.success('Site created')
      setIsAddModalOpen(false)
      fetchSites()
    } catch (err) {
      console.error('[v0] Error adding site:', err)
      toast.error('Failed to create site')
    } finally {
      setSavingAddSite(false)
    }
  }

  // ─── EDIT SITE ───────────────────────────────────────────────────────────────
  const handleOpenEditModal = (siteData: SiteData) => {
    setEditSite(siteData)
    setEditSiteCode(siteData.site.site_code)
    setEditSiteName(siteData.site.name)
    setEditSiteAddress(siteData.site.address || '')
    setEditSupervisorId(siteData.supervisorId || '')
    setEditLatitude(siteData.site.latitude?.toString() || '')
    setEditLongitude(siteData.site.longitude?.toString() || '')
    setEditRadius(siteData.site.geofence_radius?.toString() || '30')
    setEditSiteCodeError('')
    setIsEditModalOpen(true)
  }

  const handleEditSite = async () => {
    if (!editSite) return
    if (!editSiteName.trim()) { toast.error('Site name is required'); return }
    if (!validateSiteCode(editSiteCode)) {
      setEditSiteCodeError('Format: 5 letters + 2 digits (e.g. KLSNT01)')
      return
    }

    let geoValues: { lat: number; lon: number; radius: number } | null = null
    if (editLatitude || editLongitude) {
      const parsed = parseCoordsAndRadius(editLatitude, editLongitude, editRadius)
      if (!parsed.valid) {
        toast.error('Enter valid coordinates and radius (10–500 m)')
        return
      }
      geoValues = parsed
    }

    setSavingEditSite(true)
    try {
      const { error } = await supabase
        .from('sites')
        .update({
          site_code: editSiteCode.toUpperCase(),
          name: editSiteName.trim(),
          address: editSiteAddress.trim() || null,
          latitude: geoValues?.lat ?? null,
          longitude: geoValues?.lon ?? null,
          geofence_radius: geoValues?.radius ?? 30,
          has_kiosk: !!geoValues,
        })
        .eq('id', editSite.site.id)

      if (error) {
        if (error.code === '23505') toast.error('Site code already exists')
        else throw error
        return
      }

      if (geoValues && managerId) {
        await saveGeofenceConfig(
          editSite.site.id,
          geoValues.lat,
          geoValues.lon,
          geoValues.radius,
          managerId
        )
      }

      await upsertSupervisorSite(editSupervisorId, editSite.site.id)

      toast.success('Site updated')
      setIsEditModalOpen(false)
      fetchSites()
    } catch (err) {
      console.error('[v0] Error editing site:', err)
      toast.error('Failed to update site')
    } finally {
      setSavingEditSite(false)
    }
  }

  // ─── DEACTIVATION FLOW ───────────────────────────────────────────────────────
  const handleToggleSiteStatus = async (siteData: SiteData) => {
    // Reactivation — no checks needed
    if (!siteData.site.is_active) {
      if (!confirm(`Reactivate ${siteData.site.site_code}?`)) return
      try {
        const { error } = await supabase
          .from('sites').update({ is_active: true }).eq('id', siteData.site.id)
        if (error) throw error
        toast.success('Site reactivated')
        fetchSites()
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
        .from('roster_slots')
        .select('id')
        .eq('site_id', siteData.site.id)
        .gte('shift_date', today)

      const futureSlotIds = futureSlotsData?.map(s => s.id) || []
      const futureShiftCount = futureSlotIds.length
      let assignedGuardCount = 0

      if (futureSlotIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('shift_assignments')
          .select('id, guard_id')
          .in('roster_slot_id', futureSlotIds)
          .eq('is_cancelled', false)
        assignedGuardCount = new Set(assignmentsData?.map(a => a.guard_id) || []).size
      }

      const { data: activeShiftDefs } = await supabase
        .from('shift_definitions')
        .select('id')
        .eq('site_id', siteData.site.id)
        .eq('is_active', true)

      const activeShiftDefCount = activeShiftDefs?.length || 0

      // No blockers — simple confirm
      if (futureShiftCount === 0 && activeShiftDefCount === 0) {
        if (!confirm(`Deactivate ${siteData.site.site_code}? This will hide it from supervisors.`)) return
        await performDeactivation(siteData.site.id)
        return
      }

      // Blockers exist — show modal
      setDeactivationBlocker({ futureShiftCount, assignedGuardCount, activeShiftDefCount, siteData })
      setIsDeactivateModalOpen(true)
    } catch (err) {
      console.error('[v0] Error checking deactivation:', err)
      toast.error('Failed to check site status')
    }
  }

  const performDeactivation = async (siteId: string) => {
    try {
      const { error } = await supabase
        .from('sites').update({ is_active: false }).eq('id', siteId)
      if (error) throw error
      toast.success('Site deactivated')
      fetchSites()
    } catch (err) {
      console.error('[v0] Error deactivating site:', err)
      toast.error('Failed to deactivate site')
    }
  }

  const handleForceDeactivate = async () => {
    if (!deactivationBlocker) return
    setDeactivating(true)
    try {
      const siteId = deactivationBlocker.siteData.site.id
      const today = getLocalDateString()

      // Step 1 — Cancel all future shift assignments
      const { data: futureSlots } = await supabase
        .from('roster_slots')
        .select('id')
        .eq('site_id', siteId)
        .gte('shift_date', today)

      if (futureSlots && futureSlots.length > 0) {
        const slotIds = futureSlots.map(s => s.id)
        await supabase
          .from('shift_assignments')
          .update({ is_cancelled: true })
          .in('roster_slot_id', slotIds)
          .eq('is_cancelled', false)
      }

      // Step 2 — Deactivate all shift definitions
      await supabase
        .from('shift_definitions')
        .update({ is_active: false })
        .eq('site_id', siteId)
        .eq('is_active', true)

      // Step 3 — Deactivate the site
      await performDeactivation(siteId)

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

  // ─── DATE ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
      })
    )
  }, [])

  // ─── FETCH ───────────────────────────────────────────────────────────────────
  const fetchSites = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setManagerId(user.id)

      const { data: userData } = await supabase
        .from('users').select('full_name').eq('id', user.id).single()
      if (userData?.full_name) setManagerName(userData.full_name)

      const { data: supData } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('external_role', 'OPERATIONS EXECUTIVE')
        .eq('is_active', true)
        .order('full_name')
      setSupervisors(supData || [])

      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, site_code, name, address, latitude, longitude, has_kiosk, geofence_radius, is_active')
        .order('site_code')

      if (!sitesData || sitesData.length === 0) { setLoading(false); return }

      const siteIds = sitesData.map(s => s.id)
      const today = getLocalDateString()

      const [supSitesRes, shiftDefsRes, devicesRes, checkinsRes] = await Promise.all([
        supabase
          .from('supervisor_sites')
          .select('supervisor_id, site_id, users!supervisor_sites_supervisor_id_fkey(full_name)')
          .in('site_id', siteIds),
        supabase
          .from('shift_definitions')
          .select('id, site_id')
          .in('site_id', siteIds)
          .eq('is_active', true),
        supabase
          .from('device_management')
          .select('site_id, device_id, online_status, is_enabled')
          .in('site_id', siteIds),
        supabase
          .from('attendance_check_ins')
          .select('site_id, id, created_at')
          .in('site_id', siteIds)
          .gte('created_at', today + 'T00:00:00')
          .lt('created_at', today + 'T23:59:59'),
      ])

      const siteDataList: SiteData[] = sitesData.map(site => {
        const sup = supSitesRes.data?.find(s => s.site_id === site.id)
        // Supabase FK join returns object for single relation, array for multiple
        const usersData = sup?.users as unknown
        let supervisorName: string | null = null
        if (usersData) {
          if (Array.isArray(usersData) && usersData.length > 0) {
            supervisorName = usersData[0].full_name
          } else if (typeof usersData === 'object' && 'full_name' in (usersData as object)) {
            supervisorName = (usersData as { full_name: string }).full_name
          }
        }
        const supervisorId = sup?.supervisor_id ?? null

        const activeShifts = shiftDefsRes.data?.filter(sd => sd.site_id === site.id).length || 0
        const siteDevices = devicesRes.data?.filter(d => d.site_id === site.id) || []
        const enabledDevices = siteDevices.filter(d => d.is_enabled)
        const onlineEnabled = enabledDevices.filter(d => d.online_status)
        const kioskStatus: 'active' | 'offline' | 'none' = !site.has_kiosk
          ? 'none'
          : onlineEnabled.length > 0 ? 'active' : 'offline'
        const todayCheckins = checkinsRes.data?.filter(c => c.site_id === site.id).length || 0

        return {
          site,
          supervisor: supervisorName,
          supervisorId,
          activeShifts,
          kioskStatus,
          deviceCount: enabledDevices.length,
          onlineDevices: onlineEnabled.length,
          checkInsToday: todayCheckins,
        }
      })

      setAllSites(siteDataList)
      const activeSites = siteDataList.filter(s => s.site.is_active)
      setTotalSites(siteDataList.length)
      setSitesWithKiosk(activeSites.filter(s => s.site.has_kiosk).length)
      setGeofenceConfigured(activeSites.filter(s => s.site.latitude !== null).length)
      setTotalCheckinsToday(activeSites.reduce((sum, s) => sum + s.checkInsToday, 0))
    } catch (err) {
      console.error('[v0] Error fetching sites:', err)
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSites() }, [])

  // ─── FILTER ──────────────────────────────────────────────────────────────────
  const filteredSites = useMemo(() =>
    allSites.filter(sd => {
      const q = searchQuery.toLowerCase()
      const matchSearch = !q ||
        sd.site.site_code.toLowerCase().includes(q) ||
        sd.site.name.toLowerCase().includes(q)
      const matchKiosk =
        kioskFilter === 'All' ||
        (kioskFilter === 'Has Kiosk' && sd.site.has_kiosk) ||
        (kioskFilter === 'No Kiosk' && !sd.site.has_kiosk)
      const matchStatus =
        statusFilter === 'All Status' ||
        (statusFilter === 'Active' && sd.site.is_active) ||
        (statusFilter === 'Inactive' && !sd.site.is_active)
      return matchSearch && matchKiosk && matchStatus
    }),
    [allSites, searchQuery, kioskFilter, statusFilter]
  )

  // ─── SHARED FORM COMPONENTS ──────────────────────────────────────────────────
  const GeoFields = ({
    lat, setLat, lon, setLon, radius, setRadius,
  }: {
    lat: string; setLat: (v: string) => void
    lon: string; setLon: (v: string) => void
    radius: string; setRadius: (v: string) => void
  }) => (
    <div className="space-y-3 border border-slate-200 rounded-lg p-4 bg-slate-50">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Geofence Configuration
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Latitude</Label>
          <Input
            type="number"
            step="0.0001"
            value={lat}
            onChange={e => setLat(e.target.value)}
            placeholder="e.g. 3.1390"
            className="text-sm"
          />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input
            type="number"
            step="0.0001"
            value={lon}
            onChange={e => setLon(e.target.value)}
            placeholder="e.g. 101.6869"
            className="text-sm"
          />
        </div>
      </div>
      <div>
        <Label>Radius (meters, 10–500)</Label>
        <Input
          type="number"
          min="10"
          max="500"
          value={radius}
          onChange={e => setRadius(e.target.value)}
          placeholder="e.g. 30"
          className="text-sm"
        />
      </div>
      <p className="text-xs text-slate-500">
        Leave latitude &amp; longitude blank to skip geofence setup.
      </p>
    </div>
  )

  const SupervisorSelect = ({
    value, onChange,
  }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <Label>Assign Supervisor</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value="">— None —</option>
        {supervisors.map(s => (
          <option key={s.id} value={s.id}>{s.full_name}</option>
        ))}
      </select>
    </div>
  )

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{dateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{managerName}</p>
              <Badge variant="secondary" className="mt-1">Manager</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-600 hover:text-slate-900">
              <LogOut className="w-4 h-4 mr-2" />Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Title */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sites Management</h1>
            <p className="text-sm text-slate-600 mt-1">Monitor kiosk status, geofence configuration, and check-ins</p>
          </div>
          <Button onClick={handleOpenAddModal} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />Add Site
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Sites', value: totalSites, color: 'text-slate-900' },
            { label: 'Sites with Kiosk', value: sitesWithKiosk, color: 'text-teal-600' },
            { label: 'Geofence Configured', value: geofenceConfigured, color: 'text-blue-600' },
            { label: 'Check-ins Today', value: totalCheckinsToday, color: 'text-green-600' },
          ].map(card => (
            <Card key={card.label} className="p-4 border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase">{card.label}</p>
              <p className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Input
            type="text"
            placeholder="Search site code or name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Kiosk:</span>
            {['All', 'Has Kiosk', 'No Kiosk'].map(f => (
              <button key={f} onClick={() => setKioskFilter(f)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${kioskFilter === f ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Status:</span>
            {['Active', 'Inactive', 'All Status'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${statusFilter === f ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                {f}
              </button>
            ))}
          </div>
          <span className="text-sm text-slate-600">{filteredSites.length} sites</span>
        </div>

        {/* Table */}
        <Card className="border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-600">Loading sites...</div>
          ) : filteredSites.length === 0 ? (
            <div className="p-8 text-center text-slate-600">No sites found matching your filters.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Site Code', 'Site Name', 'Supervisor', 'Kiosk', 'Geofence', 'Check-ins Today', 'Active Shifts', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-700 uppercase ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSites.map(sd => (
                  <tr key={sd.site.id} className={`hover:bg-slate-50 ${!sd.site.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">{sd.site.site_code}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm text-slate-900">{sd.site.name}</p>
                      {!sd.site.is_active && (
                        <Badge className="mt-1 bg-slate-200 text-slate-600 text-xs">Inactive</Badge>
                      )}
                      {sd.site.address && (
                        <p className="text-xs text-slate-500 mt-0.5">{sd.site.address}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {sd.supervisor ?? <span className="italic text-slate-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      {sd.site.has_kiosk ? (
                        <Badge className={sd.kioskStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {sd.kioskStatus === 'active' ? 'Active' : 'Offline'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">No Kiosk</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sd.site.latitude !== null
                        ? <span className="text-slate-900">{sd.site.geofence_radius}m</span>
                        : <span className="italic text-slate-400">Not configured</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {sd.checkInsToday || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{sd.activeShifts}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" title="View site details"
                          onClick={() => handleViewSite(sd.site.site_code)}
                          className="text-slate-600 hover:text-slate-900">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="View schedule"
                          onClick={() => router.push(`/manager/sites/${sd.site.site_code}/schedule`)}
                          className="text-teal-600 hover:text-teal-800">
                          <CalendarDays className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Edit site"
                          onClick={() => handleOpenEditModal(sd)}
                          className="text-slate-600 hover:text-slate-900">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm"
                          title={sd.site.is_active ? 'Deactivate site' : 'Reactivate site'}
                          onClick={() => handleToggleSiteStatus(sd)}
                          className={sd.site.is_active ? 'text-slate-400 hover:text-red-600' : 'text-red-500 hover:text-green-600'}>
                          <PowerOff className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── ADD SITE MODAL ─────────────────────────────────────────────────────── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="add-code">Site Code *</Label>
              <Input
                id="add-code"
                maxLength={7}
                value={addSiteCode}
                onChange={e => { setAddSiteCode(e.target.value.toUpperCase()); setAddSiteCodeError('') }}
                placeholder="e.g. KLSNT01"
                className="text-sm font-mono"
              />
              {addSiteCodeError && <p className="text-xs text-red-600 mt-1">{addSiteCodeError}</p>}
              <p className="text-xs text-slate-500 mt-1">5 uppercase letters + 2 digits</p>
            </div>
            <div>
              <Label htmlFor="add-name">Site Name *</Label>
              <Input
                id="add-name"
                value={addSiteName}
                onChange={e => setAddSiteName(e.target.value)}
                placeholder="e.g. KL Sentral Tower"
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="add-address">Address</Label>
              <textarea
                id="add-address"
                value={addSiteAddress}
                onChange={e => setAddSiteAddress(e.target.value)}
                placeholder="e.g. Jalan Stesen Sentral 5, KL Sentral, 50470 KL"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows={2}
              />
            </div>
            <SupervisorSelect value={addSupervisorId} onChange={setAddSupervisorId} />
            <GeoFields
              lat={addLatitude} setLat={setAddLatitude}
              lon={addLongitude} setLon={setAddLongitude}
              radius={addRadius} setRadius={setAddRadius}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="text-slate-700 border-slate-300">Cancel</Button>
            <Button onClick={handleAddSite} disabled={savingAddSite} className="bg-teal-600 hover:bg-teal-700 text-white">
              {savingAddSite ? 'Creating...' : 'Create Site'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT SITE MODAL ────────────────────────────────────────────────────── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
          </DialogHeader>
          {editSite && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-code">Site Code *</Label>
                <Input
                  id="edit-code"
                  maxLength={7}
                  value={editSiteCode}
                  onChange={e => { setEditSiteCode(e.target.value.toUpperCase()); setEditSiteCodeError('') }}
                  placeholder="e.g. KLSNT01"
                  className="text-sm font-mono"
                />
                {editSiteCodeError && <p className="text-xs text-red-600 mt-1">{editSiteCodeError}</p>}
                <p className="text-xs text-slate-500 mt-1">5 uppercase letters + 2 digits</p>
              </div>
              <div>
                <Label htmlFor="edit-name">Site Name *</Label>
                <Input
                  id="edit-name"
                  value={editSiteName}
                  onChange={e => setEditSiteName(e.target.value)}
                  placeholder="e.g. KL Sentral Tower"
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Address</Label>
                <textarea
                  id="edit-address"
                  value={editSiteAddress}
                  onChange={e => setEditSiteAddress(e.target.value)}
                  placeholder="e.g. Jalan Stesen Sentral 5, KL Sentral, 50470 KL"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={2}
                />
              </div>
              <SupervisorSelect value={editSupervisorId} onChange={setEditSupervisorId} />
              <GeoFields
                lat={editLatitude} setLat={setEditLatitude}
                lon={editLongitude} setLon={setEditLongitude}
                radius={editRadius} setRadius={setEditRadius}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="text-slate-700 border-slate-300">Cancel</Button>
            <Button onClick={handleEditSite} disabled={savingEditSite} className="bg-teal-600 hover:bg-teal-700 text-white">
              {savingEditSite ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DEACTIVATION BLOCKER MODAL ─────────────────────────────────────────── */}
      <Dialog open={isDeactivateModalOpen} onOpenChange={setIsDeactivateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Cannot Deactivate — Action Required
            </DialogTitle>
          </DialogHeader>
          {deactivationBlocker && (
            <div className="py-4 space-y-4">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{deactivationBlocker.siteData.site.site_code}</span> has active conflicts that must be resolved before deactivation:
              </p>
              <div className="space-y-2">
                {deactivationBlocker.futureShiftCount > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        {deactivationBlocker.futureShiftCount} future roster slot{deactivationBlocker.futureShiftCount !== 1 ? 's' : ''}
                      </p>
                      {deactivationBlocker.assignedGuardCount > 0 && (
                        <p className="text-xs text-amber-700 mt-0.5">
                          {deactivationBlocker.assignedGuardCount} guard{deactivationBlocker.assignedGuardCount !== 1 ? 's' : ''} currently assigned to future shifts
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {deactivationBlocker.activeShiftDefCount > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        {deactivationBlocker.activeShiftDefCount} active shift definition{deactivationBlocker.activeShiftDefCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        These will be deactivated automatically
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-800">Proceeding will:</p>
                <ul className="text-xs text-slate-600 mt-1 space-y-1 list-disc list-inside">
                  {deactivationBlocker.futureShiftCount > 0 && (
                    <li>Cancel all future shift assignments for this site</li>
                  )}
                  {deactivationBlocker.assignedGuardCount > 0 && (
                    <li>Unassign {deactivationBlocker.assignedGuardCount} guard{deactivationBlocker.assignedGuardCount !== 1 ? 's' : ''} from those shifts</li>
                  )}
                  {deactivationBlocker.activeShiftDefCount > 0 && (
                    <li>Deactivate {deactivationBlocker.activeShiftDefCount} shift definition{deactivationBlocker.activeShiftDefCount !== 1 ? 's' : ''}</li>
                  )}
                  <li>Mark the site as inactive</li>
                </ul>
              </div>
              <p className="text-xs text-slate-500">
                This cannot be undone automatically. You will need to manually re-assign guards if you reactivate this site.
              </p>
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
