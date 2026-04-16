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
import { LogOut, Eye, MapPin, Plus, Pencil, PowerOff } from 'lucide-react'
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

export default function ManagerSitesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [kioskFilter, setKioskFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [loading, setLoading] = useState(true)
  const [dateStr, setDateStr] = useState('')
  const [managerName, setManagerName] = useState('User')
  const [allSites, setAllSites] = useState<SiteData[]>([])

  // Add Site modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addSiteCode, setAddSiteCode] = useState('')
  const [addSiteName, setAddSiteName] = useState('')
  const [addSiteAddress, setAddSiteAddress] = useState('')
  const [addSiteCodeError, setAddSiteCodeError] = useState('')
  const [savingAddSite, setSavingAddSite] = useState(false)

  // Edit Site modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editSite, setEditSite] = useState<SiteData | null>(null)
  const [editSiteCode, setEditSiteCode] = useState('')
  const [editSiteName, setEditSiteName] = useState('')
  const [editSiteAddress, setEditSiteAddress] = useState('')
  const [editSiteCodeError, setEditSiteCodeError] = useState('')
  const [savingEditSite, setSavingEditSite] = useState(false)

  // Geofence modal state
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false)
  const [selectedSite, setSelectedSite] = useState<SiteData | null>(null)
  const [geofenceLat, setGeofenceLat] = useState('')
  const [geofenceLon, setGeofenceLon] = useState('')
  const [geofenceRadius, setGeofenceRadius] = useState('')
  const [savingGeofence, setSavingGeofence] = useState(false)

  // Summary stats
  const [totalSites, setTotalSites] = useState(0)
  const [sitesWithKiosk, setSitesWithKiosk] = useState(0)
  const [geofenceConfigured, setGeofenceConfigured] = useState(0)
  const [totalCheckinsToday, setTotalCheckinsToday] = useState(0)

  const handleSignOut = () => {
    router.push('/')
  }

  const handleViewSite = (siteCode: string) => {
    router.push(`/manager/sites/${siteCode}`)
  }

  const handleOpenGeofenceModal = (site: SiteData) => {
    setSelectedSite(site)
    setGeofenceLat(site.site.latitude?.toString() || '')
    setGeofenceLon(site.site.longitude?.toString() || '')
    setGeofenceRadius(site.site.geofence_radius?.toString() || '30')
    setIsGeofenceModalOpen(true)
  }

  const handleSaveGeofence = async () => {
    if (!selectedSite) return
    if (!geofenceLat || !geofenceLon || !geofenceRadius) {
      toast.error('All geofence fields are required')
      return
    }

    const lat = parseFloat(geofenceLat)
    const lon = parseFloat(geofenceLon)
    const radius = parseInt(geofenceRadius)

    if (isNaN(lat) || isNaN(lon) || isNaN(radius) || radius < 10 || radius > 500) {
      toast.error('Please enter valid coordinates and radius (10-500m)')
      return
    }

    setSavingGeofence(true)
    try {
      // Update sites table
      const { error: siteError } = await supabase
        .from('sites')
        .update({
          latitude: lat,
          longitude: lon,
          geofence_radius: radius,
          has_kiosk: true,
        })
        .eq('id', selectedSite.site.id)

      if (siteError) throw siteError

      // Upsert geofence_config
      const { data: { user } } = await supabase.auth.getUser()
      const { error: configError } = await supabase
        .from('geofence_config')
        .upsert({
          site_id: selectedSite.site.id,
          center_latitude: lat,
          center_longitude: lon,
          radius_meters: radius,
          configured_by_user_id: user!.id,
          last_updated_at: new Date().toISOString(),
          is_active: true,
        }, { onConflict: 'site_id' })

      if (configError) throw configError

      toast.success('Geofence configuration saved')
      setIsGeofenceModalOpen(false)
      fetchSites()
    } catch (error) {
      console.error('[v0] Error saving geofence:', error)
      toast.error('Failed to save geofence configuration')
    } finally {
      setSavingGeofence(false)
    }
  }

  // Validate site code format
  const validateSiteCode = (code: string): boolean => {
    return /^[A-Z]{5}[0-9]{2}$/.test(code)
  }

  // Handle Add Site
  const handleOpenAddModal = () => {
    setAddSiteCode('')
    setAddSiteName('')
    setAddSiteAddress('')
    setAddSiteCodeError('')
    setIsAddModalOpen(true)
  }

  const handleAddSite = async () => {
    if (!addSiteName.trim()) {
      toast.error('Site name is required')
      return
    }
    if (!validateSiteCode(addSiteCode)) {
      setAddSiteCodeError('Format: 5 letters + 2 digits (e.g. KLSNT01)')
      return
    }

    setSavingAddSite(true)
    try {
      const { error } = await supabase
        .from('sites')
        .insert({
          site_code: addSiteCode.toUpperCase(),
          name: addSiteName.trim(),
          address: addSiteAddress.trim() || null,
          is_active: true,
          has_kiosk: false,
          geofence_radius: 30,
        })

      if (error) {
        if (error.code === '23505') {
          toast.error('Site code already exists')
        } else {
          throw error
        }
        return
      }

      toast.success('Site created')
      setIsAddModalOpen(false)
      fetchSites()
    } catch (error) {
      console.error('[v0] Error adding site:', error)
      toast.error('Failed to create site')
    } finally {
      setSavingAddSite(false)
    }
  }

  // Handle Edit Site
  const handleOpenEditModal = (siteData: SiteData) => {
    setEditSite(siteData)
    setEditSiteCode(siteData.site.site_code)
    setEditSiteName(siteData.site.name)
    setEditSiteAddress(siteData.site.address || '')
    setEditSiteCodeError('')
    setIsEditModalOpen(true)
  }

  const handleEditSite = async () => {
    if (!editSite || !editSiteName.trim()) {
      toast.error('Site name is required')
      return
    }
    if (!validateSiteCode(editSiteCode)) {
      setEditSiteCodeError('Format: 5 letters + 2 digits (e.g. KLSNT01)')
      return
    }

    setSavingEditSite(true)
    try {
      const { error } = await supabase
        .from('sites')
        .update({
          site_code: editSiteCode.toUpperCase(),
          name: editSiteName.trim(),
          address: editSiteAddress.trim() || null,
        })
        .eq('id', editSite.site.id)

      if (error) {
        if (error.code === '23505') {
          toast.error('Site code already exists')
        } else {
          throw error
        }
        return
      }

      toast.success('Site updated')
      setIsEditModalOpen(false)
      fetchSites()
    } catch (error) {
      console.error('[v0] Error editing site:', error)
      toast.error('Failed to update site')
    } finally {
      setSavingEditSite(false)
    }
  }

  // Handle Deactivate/Activate Site
  const handleToggleSiteStatus = async (siteData: SiteData) => {
    const isActive = siteData.site.is_active
    const message = isActive ? `Deactivate ${siteData.site.site_code}? This will hide it from supervisors.` : `Reactivate ${siteData.site.site_code}?`
    
    if (!confirm(message)) return

    try {
      const { error } = await supabase
        .from('sites')
        .update({ is_active: !isActive })
        .eq('id', siteData.site.id)

      if (error) throw error
      toast.success(isActive ? 'Site deactivated' : 'Site reactivated')
      fetchSites()
    } catch (error) {
      console.error('[v0] Error toggling site status:', error)
      toast.error('Failed to update site status')
    }
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

  // Fetch all data
  const fetchSites = async () => {
    try {
      setLoading(true)

      // Get manager name
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

      // FETCH 1 — All sites with geofence data
      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, site_code, name, address, latitude, longitude, has_kiosk, geofence_radius, is_active')

      if (!sitesData || sitesData.length === 0) {
        setLoading(false)
        return
      }

      const siteIds = sitesData.map(s => s.id)
      const today = getLocalDateString()

      // FETCH 2 — Supervisors for each site
      const { data: supSites } = await supabase
        .from('supervisor_sites')
        .select('supervisor_id, site_id, users(full_name)')
        .in('site_id', siteIds)

      // FETCH 3 — Active shift definitions count
      const { data: shiftDefs } = await supabase
        .from('shift_definitions')
        .select('id, site_id')
        .in('site_id', siteIds)
        .eq('is_active', true)

      // FETCH 4 — Device management (kiosk status)
      const { data: devices } = await supabase
        .from('device_management')
        .select('site_id, device_id, online_status, is_enabled')
        .in('site_id', siteIds)

      // FETCH 5 — Today's check-ins
      const { data: checkins } = await supabase
        .from('attendance_check_ins')
        .select('site_id, id, created_at')
        .in('site_id', siteIds)
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', today + 'T23:59:59')

      // BUILD SITE DATA
      const siteDataList: SiteData[] = sitesData.map(site => {
        const sup = supSites?.find(s => s.site_id === site.id)
        const supervisorName = (sup?.users as { full_name: string } | null)?.full_name || null
        const supervisorId = sup?.supervisor_id || null

        const activeShifts = shiftDefs?.filter(sd => sd.site_id === site.id).length || 0

        const siteDevices = devices?.filter(d => d.site_id === site.id) || []
        const enabledDevices = siteDevices.filter(d => d.is_enabled)
        const onlineEnabled = enabledDevices.filter(d => d.online_status)

        let kioskStatus: 'active' | 'offline' | 'none' = 'none'
        if (site.has_kiosk) {
          kioskStatus = onlineEnabled.length > 0 ? 'active' : 'offline'
        }

        const todayCheckins = checkins?.filter(c => c.site_id === site.id).length || 0

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

      // Calculate summary stats - active sites only for most metrics
      const activeSites = siteDataList.filter(s => s.site.is_active)
      setTotalSites(siteDataList.length)
      setSitesWithKiosk(activeSites.filter(s => s.site.has_kiosk).length)
      setGeofenceConfigured(activeSites.filter(s => s.site.latitude !== null).length)
      setTotalCheckinsToday(activeSites.reduce((sum, s) => sum + s.checkInsToday, 0))
    } catch (error) {
      console.error('[v0] Error fetching sites:', error)
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSites()
  }, [])

  // Filter and search
  const filteredSites = useMemo(() => {
    return allSites.filter(siteData => {
      const matchesSearch =
        !searchQuery ||
        siteData.site.site_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        siteData.site.name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesKioskFilter =
        kioskFilter === 'All' ||
        (kioskFilter === 'Has Kiosk' && siteData.site.has_kiosk) ||
        (kioskFilter === 'No Kiosk' && !siteData.site.has_kiosk)

      const matchesStatusFilter =
        statusFilter === 'All Status' ||
        (statusFilter === 'Active' && siteData.site.is_active) ||
        (statusFilter === 'Inactive' && !siteData.site.is_active)

      return matchesSearch && matchesKioskFilter && matchesStatusFilter
    })
  }, [allSites, searchQuery, kioskFilter, statusFilter])

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
      <div className="p-8">
        {/* Page Title */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sites Management</h1>
            <p className="text-sm text-slate-600 mt-1">Monitor kiosk status, geofence configuration, and check-ins</p>
          </div>
          <Button onClick={handleOpenAddModal} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Sites</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{totalSites}</p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Sites with Kiosk</p>
            <p className="text-2xl font-bold text-teal-600 mt-2">{sitesWithKiosk}</p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Geofence Configured</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{geofenceConfigured}</p>
          </Card>
          <Card className="p-4 border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase">Check-ins Today</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{totalCheckinsToday}</p>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex items-center gap-4">
          <Input
            type="text"
            placeholder="Search site code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-md"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Kiosk:</span>
            <div className="flex gap-2">
              {['All', 'Has Kiosk', 'No Kiosk'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setKioskFilter(filter)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                    kioskFilter === filter
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Status:</span>
            <div className="flex gap-2">
              {['Active', 'Inactive', 'All Status'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                    statusFilter === filter
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <span className="text-sm text-slate-600">{filteredSites.length} sites</span>
        </div>

        {/* Sites Table */}
        <Card className="border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-600">Loading sites...</div>
          ) : filteredSites.length === 0 ? (
            <div className="p-8 text-center text-slate-600">No sites found matching your filters.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Site Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Site Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Supervisor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Kiosk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Geofence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Check-ins Today</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Active Shifts</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSites.map(siteData => (
                  <tr key={siteData.site.id} className={`hover:bg-slate-50 ${!siteData.site.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">
                        {siteData.site.site_code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{siteData.site.name}</p>
                        {!siteData.site.is_active && (
                          <Badge className="mt-1 bg-slate-200 text-slate-700">Inactive</Badge>
                        )}
                        {siteData.site.address && (
                          <p className="text-xs text-slate-500">{siteData.site.address}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">
                        {siteData.supervisor || <span className="italic text-slate-400">Unassigned</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {siteData.site.has_kiosk ? (
                        <Badge className={siteData.kioskStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {siteData.kioskStatus === 'active' ? 'Active' : 'Offline'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">No Kiosk</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">
                        {siteData.site.latitude !== null ? `${siteData.site.geofence_radius}m` : <span className="italic text-slate-400">Not configured</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {siteData.checkInsToday || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">{siteData.activeShifts}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSite(siteData.site.site_code)}
                          className="text-slate-600 hover:text-slate-900"
                          title="View site details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(siteData)}
                          className="text-slate-600 hover:text-slate-900"
                          title="Edit site"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenGeofenceModal(siteData)}
                          className="text-teal-600 hover:text-teal-900"
                          title="Configure geofence"
                        >
                          <MapPin className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSiteStatus(siteData)}
                          className={siteData.site.is_active ? 'text-slate-400 hover:text-red-600' : 'text-red-500 hover:text-green-600'}
                          title={siteData.site.is_active ? 'Deactivate site' : 'Reactivate site'}
                        >
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

      {/* Add Site Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="add-site-code">Site Code *</Label>
              <Input
                id="add-site-code"
                type="text"
                maxLength={7}
                value={addSiteCode}
                onChange={(e) => {
                  setAddSiteCode(e.target.value.toUpperCase())
                  setAddSiteCodeError('')
                }}
                placeholder="e.g. KLSNT01"
                className="text-sm"
              />
              {addSiteCodeError && (
                <p className="text-xs text-red-600 mt-1">{addSiteCodeError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="add-site-name">Site Name *</Label>
              <Input
                id="add-site-name"
                type="text"
                value={addSiteName}
                onChange={(e) => setAddSiteName(e.target.value)}
                placeholder="e.g. KL Sentral Tower"
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="add-site-address">Address</Label>
              <textarea
                id="add-site-address"
                value={addSiteAddress}
                onChange={(e) => setAddSiteAddress(e.target.value)}
                placeholder="e.g. Jalan Stesen Sentral, Kuala Lumpur"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
              className="text-slate-700 border-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSite}
              disabled={savingAddSite}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {savingAddSite ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Site Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
          </DialogHeader>
          {editSite && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-site-code">Site Code *</Label>
                <Input
                  id="edit-site-code"
                  type="text"
                  maxLength={7}
                  value={editSiteCode}
                  onChange={(e) => {
                    setEditSiteCode(e.target.value.toUpperCase())
                    setEditSiteCodeError('')
                  }}
                  placeholder="e.g. KLSNT01"
                  className="text-sm"
                />
                {editSiteCodeError && (
                  <p className="text-xs text-red-600 mt-1">{editSiteCodeError}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-site-name">Site Name *</Label>
                <Input
                  id="edit-site-name"
                  type="text"
                  value={editSiteName}
                  onChange={(e) => setEditSiteName(e.target.value)}
                  placeholder="e.g. KL Sentral Tower"
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="edit-site-address">Address</Label>
                <textarea
                  id="edit-site-address"
                  value={editSiteAddress}
                  onChange={(e) => setEditSiteAddress(e.target.value)}
                  placeholder="e.g. Jalan Stesen Sentral, Kuala Lumpur"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="text-slate-700 border-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSite}
              disabled={savingEditSite}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {savingEditSite ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isGeofenceModalOpen} onOpenChange={setIsGeofenceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Geofence</DialogTitle>
          </DialogHeader>
          {selectedSite && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-slate-600">
                Configure geofence for <span className="font-medium">{selectedSite.site.site_code} - {selectedSite.site.name}</span>
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.0001"
                    value={geofenceLat}
                    onChange={(e) => setGeofenceLat(e.target.value)}
                    placeholder="e.g. 3.1390"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.0001"
                    value={geofenceLon}
                    onChange={(e) => setGeofenceLon(e.target.value)}
                    placeholder="e.g. 101.6869"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="radius">Radius (meters, 10-500)</Label>
                  <Input
                    id="radius"
                    type="number"
                    min="10"
                    max="500"
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(e.target.value)}
                    placeholder="e.g. 30"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGeofenceModalOpen(false)}
              className="text-slate-700 border-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGeofence}
              disabled={savingGeofence}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {savingGeofence ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
