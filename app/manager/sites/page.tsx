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
import { LogOut, Eye, MapPin } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [dateStr, setDateStr] = useState('')
  const [managerName, setManagerName] = useState('User')
  const [allSites, setAllSites] = useState<SiteData[]>([])

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
      const { error } = await supabase
        .from('sites')
        .update({
          latitude: lat,
          longitude: lon,
          geofence_radius: radius,
          has_kiosk: true,
        })
        .eq('id', selectedSite.site.id)

      if (error) throw error

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
        .select('id, site_code, name, address, latitude, longitude, has_kiosk, geofence_radius')

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

      // Calculate summary stats
      setTotalSites(siteDataList.length)
      setSitesWithKiosk(siteDataList.filter(s => s.site.has_kiosk).length)
      setGeofenceConfigured(siteDataList.filter(s => s.site.latitude !== null).length)
      setTotalCheckinsToday(siteDataList.reduce((sum, s) => sum + s.checkInsToday, 0))
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

      return matchesSearch && matchesKioskFilter
    })
  }, [allSites, searchQuery, kioskFilter])

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Sites Management</h1>
          <p className="text-sm text-slate-600 mt-1">Monitor kiosk status, geofence configuration, and check-ins</p>
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
            <span className="text-sm font-medium text-slate-700">Filter:</span>
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
                  <tr key={siteData.site.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">
                        {siteData.site.site_code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{siteData.site.name}</p>
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
                          onClick={() => handleOpenGeofenceModal(siteData)}
                          className="text-teal-600 hover:text-teal-900"
                          title="Configure geofence"
                        >
                          <MapPin className="w-4 h-4" />
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

      {/* Geofence Config Modal */}
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
