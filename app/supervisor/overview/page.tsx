'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LogOut, AlertCircle, PieChart } from 'lucide-react'

interface SiteData {
  code: string
  id: string
  shifts: Array<{ name: string; status: 'gap' | 'partial' | 'filled' }>
  fillRate: number
  openSlots: number
}

interface AbsentGuard {
  name: string
  siteCode: string
  shift: string
  status: 'absent' | 'leave'
}

export default function SupervisorOverviewPage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [stats, setStats] = useState([
    { label: 'Sites with gaps today', value: 0, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Unfilled slots today', value: 0, color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-600', icon: AlertCircle },
    { label: 'Guards absent', value: 0, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Overall fill rate', value: '0%', color: 'bg-green-50 border-green-200', textColor: 'text-green-600', icon: PieChart },
  ])
  const [sitesData, setSitesData] = useState<SiteData[]>([])
  const [absenceData, setAbsenceData] = useState<AbsentGuard[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('id', user.id)
            .single()
          setCurrentUser(userData)
        }

        // FETCH 1 — Get supervisor's sites
        const { data: supervisorSites } = await supabase
          .from('supervisor_sites')
          .select('site_id, sites(id, site_code)')
          .eq('supervisor_id', user?.id)

        if (!supervisorSites || supervisorSites.length === 0) {
          setSitesData([])
          setAbsenceData([])
          setLoading(false)
          return
        }

        const siteIds = supervisorSites.map(ss => ss.site_id)
        const today = new Date().toISOString().split('T')[0]

        // FETCH 2 — Get today's roster coverage with shift details
        const { data: coverage } = await supabase
          .from('roster_coverage')
          .select('site_id, shift_definition_id, assigned, required_headcount, is_fulfilled, shift_date')
          .in('site_id', siteIds)
          .eq('shift_date', today)

        // FETCH 3 — Get shift definitions
        const { data: shiftDefs } = await supabase
          .from('shift_definitions')
          .select('id, site_id, shift_name, is_active')
          .in('site_id', siteIds)
          .eq('is_active', true)

        // FETCH 4 — Get absent guards today
        const { data: absents } = await supabase
          .from('attendance')
          .select(`
            id,
            status,
            shift_assignments(
              id,
              roster_slot_id,
              site_id,
              users(full_name),
              roster_slots(shift_definition_id)
            )
          `)
          .eq('status', 'absent')
          .in('shift_assignments.site_id', siteIds)

        // BUILD SITES TABLE
        const sitesMap = new Map<string, SiteData>()
        supervisorSites.forEach(ss => {
          const siteCode = ss.sites?.site_code || 'Unknown'
          sitesMap.set(siteCode, {
            code: siteCode,
            id: ss.site_id,
            shifts: [],
            fillRate: 0,
            openSlots: 0,
          })
        })

        // Add coverage data and calculate fill rates
        coverage?.forEach(cov => {
          const site = Array.from(sitesMap.values()).find(s => s.id === cov.site_id)
          if (site) {
            const shiftDef = shiftDefs?.find(sd => sd.id === cov.shift_definition_id)
            const status = cov.is_fulfilled ? 'filled' : cov.assigned > 0 ? 'partial' : 'gap'
            site.shifts.push({
              name: shiftDef?.shift_name || 'Unknown',
              status,
            })
            site.openSlots += Math.max(0, cov.required_headcount - cov.assigned)
          }
        })

        // Calculate fill rates
        coverage?.forEach(cov => {
          const site = Array.from(sitesMap.values()).find(s => s.id === cov.site_id)
          if (site) {
            const totalRequired = coverage
              .filter(c => c.site_id === cov.site_id)
              .reduce((sum, c) => sum + (c.required_headcount || 0), 0)
            const totalAssigned = coverage
              .filter(c => c.site_id === cov.site_id)
              .reduce((sum, c) => sum + (c.assigned || 0), 0)
            if (totalRequired > 0) {
              site.fillRate = Math.round((totalAssigned / totalRequired) * 100)
            }
          }
        })

        setSitesData(Array.from(sitesMap.values()))

        // BUILD STATS
        const sitesWithGaps = Array.from(sitesMap.values()).filter(s =>
          s.shifts.some(sh => sh.status === 'gap')
        ).length
        const totalUnfilled = Array.from(sitesMap.values()).reduce((sum, s) => sum + s.openSlots, 0)
        const totalRequired = coverage?.reduce((sum, c) => sum + (c.required_headcount || 0), 0) || 1
        const totalAssigned = coverage?.reduce((sum, c) => sum + (c.assigned || 0), 0) || 0
        const overallFillRate = Math.round((totalAssigned / totalRequired) * 100)

        setStats([
          { ...stats[0], value: sitesWithGaps },
          { ...stats[1], value: totalUnfilled },
          { ...stats[2], value: absents?.length || 0 },
          { ...stats[3], value: `${overallFillRate}%` },
        ])

        // BUILD ABSENT GUARDS TABLE
        const absenceList: AbsentGuard[] = (absents || []).map(a => {
          const assignment = a.shift_assignments
          const guardName = assignment?.users?.full_name || 'Unknown'
          const shiftDef = shiftDefs?.find(sd => sd.id === assignment?.roster_slots?.shift_definition_id)
          const shiftName = shiftDef?.shift_name || 'Unknown Shift'
          const siteCode = supervisorSites.find(ss => ss.site_id === assignment?.site_id)?.sites?.site_code || 'Unknown'

          return {
            name: guardName,
            siteCode,
            shift: shiftName,
            status: 'absent',
          }
        })

        setAbsenceData(absenceList)
      } catch (error) {
        console.error('[v0] Error fetching overview data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSignOut = () => {
    router.push('/')
  }

  const handleSchedule = (siteCode: string) => {
    router.push(`/supervisor/sites/${siteCode}/schedule`)
  }

  const getFilteredSites = () => {
    if (activeFilter === 'All') return sitesData
    if (activeFilter === 'Urgent') return sitesData.filter(s => s.fillRate < 50)
    if (activeFilter === 'Partial') return sitesData.filter(s => s.fillRate >= 50 && s.fillRate < 80)
    if (activeFilter === 'Filled') return sitesData.filter(s => s.fillRate >= 80)
    return sitesData
  }

  const getShiftStatusColor = (status: string) => {
    if (status === 'gap') return 'bg-red-100 text-red-700'
    if (status === 'partial') return 'bg-amber-100 text-amber-700'
    return 'bg-green-100 text-green-700'
  }

  const getShiftStatusSymbol = (status: string) => {
    if (status === 'gap') return '✕'
    if (status === 'partial') return '~'
    return '✓'
  }

  const getFillRateBadgeColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800'
    if (rate >= 50) return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

  const todayDate = new Date()
  const dateStr = todayDate.toLocaleDateString('en-MY', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })

  return (
    <>
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{dateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{currentUser?.full_name || 'User'}</p>
              <Badge variant="secondary" className="mt-1">
                Supervisor
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
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">Loading overview data...</p>
          </div>
        ) : sitesData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600">No sites assigned to you yet.</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {stats.map((stat, idx) => {
                const Icon = stat.icon
                return (
                  <Card
                    key={idx}
                    className={`${stat.color} border p-6`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-slate-600 mb-2">{stat.label}</p>
                        <p className={`text-3xl font-bold ${stat.textColor}`}>
                          {stat.value}
                        </p>
                      </div>
                      <Icon className={`w-5 h-5 ${stat.textColor}`} />
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Sites Needing Attention */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Sites needing attention today</h3>
              
              {/* Filter Pills */}
              <div className="flex gap-2 mb-4">
                {['All', 'Urgent', 'Partial', 'Filled'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                      activeFilter === filter
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Table */}
              <Card className="border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Site Code</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Site Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Shifts today</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Fill rate</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Open slots</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredSites().map((site, idx) => (
                      <TableRow key={idx} className="border-slate-200 hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">{site.code}</TableCell>
                        <TableCell className="text-slate-900">{site.code}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {site.shifts.map((shift, sidx) => (
                              <span key={sidx} className={`px-2 py-1 rounded text-xs font-medium ${getShiftStatusColor(shift.status)}`}>
                                {shift.name} {getShiftStatusSymbol(shift.status)}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getFillRateBadgeColor(site.fillRate)}>
                            {site.fillRate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {site.openSlots === 0 ? (
                            <span className="text-slate-500">Filled</span>
                          ) : (
                            <span className="text-red-600 font-medium">{site.openSlots} open</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSchedule(site.code)}
                            className="text-teal-600 border-teal-200 hover:bg-teal-50"
                          >
                            Schedule
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Guards Absent Today */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Guards absent today</h3>
              <Card className="border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Guard Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Site Code</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Shift</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absenceData.map((absence, idx) => (
                      <TableRow key={idx} className="border-slate-200 hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">{absence.name}</TableCell>
                        <TableCell className="text-slate-900">{absence.siteCode}</TableCell>
                        <TableCell className="text-slate-700">{absence.shift}</TableCell>
                        <TableCell>
                          {absence.status === 'leave' ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              on leave (AL)
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-teal-600 border-teal-200 hover:bg-teal-50"
                            >
                              Find Replacement
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
