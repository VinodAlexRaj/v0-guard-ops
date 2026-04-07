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
import { getLocalDateString } from '@/lib/utils'

interface SiteRow {
  code: string
  name: string
  id: string
  totalRequired: number
  totalAssigned: number
  fillRate: number
  openSlots: number
  shifts: ShiftStatus[]
}

interface ShiftStatus {
  name: string
  status: 'filled' | 'partial' | 'gap'
}

interface SiteData extends SiteRow {}

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
  const [sitesWithGaps, setSitesWithGaps] = useState(0)
  const [unfilledSlots, setUnfilledSlots] = useState(0)
  const [guardsAbsent, setGuardsAbsent] = useState(0)
  const [fillRate, setFillRate] = useState(0)
  const [dateStr, setDateStr] = useState('')
  const [sitesData, setSitesData] = useState<SiteData[]>([])
  const [absenceData, setAbsenceData] = useState<AbsentGuard[]>([])

  useEffect(() => {
    const todayDate = new Date()
    const formatted = todayDate.toLocaleDateString('en-MY', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
    setDateStr(formatted)
  }, [])

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

        // STEP 1 — Fetch supervisor's sites with names
        const { data: supervisorSites } = await supabase
          .from('supervisor_sites')
          .select('site_id, sites(id, site_code, name)')
          .eq('supervisor_id', user?.id)

        if (!supervisorSites || supervisorSites.length === 0) {
          setSitesData([])
          setAbsenceData([])
          setLoading(false)
          return
        }

        // Build a lookup map: site_id -> site info
        const siteMap: Record<string, { id: string; code: string; name: string }> = {}
        supervisorSites.forEach(ss => {
          siteMap[ss.site_id] = {
            id: ss.sites.id,
            code: ss.sites.site_code,
            name: ss.sites.name,
          }
        })

        // STEP 2 — Fetch today's coverage and shift definitions
        const siteIds = supervisorSites.map(ss => ss.site_id)
        const today = getLocalDateString()

        const { data: coverage } = await supabase
          .from('roster_coverage')
          .select('site_id, shift_definition_id, assigned, required_headcount, is_fulfilled')
          .in('site_id', siteIds)
          .eq('shift_date', today)

        const { data: shiftDefs } = await supabase
          .from('shift_definitions')
          .select('id, site_id, shift_name')
          .in('site_id', siteIds)
          .eq('is_active', true)

        // FETCH 3 — Get absent guards today
        const { data: absents } = await supabase
          .from('attendance')
          .select(`
            id,
            status,
            shift_assignments(
              id,
              site_id,
              users(full_name),
              roster_slots(shift_definition_id, sites(site_code))
            )
          `)
          .eq('status', 'absent')
          .in('shift_assignments.site_id', siteIds)

        // STEP 3 — BUILD SITE ROWS (coverage-based calculations only)
        const siteRows: SiteRow[] = Object.values(siteMap).map(site => {
          const siteCoverage = coverage?.filter(c => c.site_id === site.id) || []
          const totalRequired = siteCoverage.reduce((sum, c) => sum + c.required_headcount, 0)
          const totalAssigned = siteCoverage.reduce((sum, c) => sum + c.assigned, 0)
          const openSlots = totalRequired - totalAssigned
          const fillRate = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 0

          return {
            code: site.code,
            name: site.name,
            id: site.id,
            totalRequired,
            totalAssigned,
            fillRate,
            openSlots,
            shifts: [], // Placeholder - will be filled in STEP 4
          }
        })

        // STEP 4 — ADD SHIFT CHIPS (visual only - does NOT affect numeric calculations)
        siteRows.forEach(siteRow => {
          const siteCoverage = coverage?.filter(c => c.site_id === siteRow.id) || []
          const siteShiftDefs = shiftDefs?.filter(sd => sd.site_id === siteRow.id) || []
          
          siteRow.shifts = siteShiftDefs.map(shiftDef => {
            const covRow = siteCoverage.find(c => c.shift_definition_id === shiftDef.id)
            let status: 'filled' | 'partial' | 'gap' = 'gap'
            
            if (covRow) {
              if (covRow.assigned > 0 && covRow.is_fulfilled) {
                status = 'filled'
              } else if (covRow.assigned > 0) {
                status = 'partial'
              }
            }
            
            return {
              name: shiftDef.shift_name,
              status,
            }
          })
        })

        setSitesData(siteRows)

        // STEP 5 — Calculate stat cards from siteRows (after all numeric calculations are done)
        const calcSitesWithGaps = siteRows.filter(s => s.openSlots > 0).length
        const calcTotalUnfilled = siteRows.reduce((sum, s) => sum + s.openSlots, 0)
        const globalTotalRequired = siteRows.reduce((sum, s) => sum + s.totalRequired, 0)
        const globalTotalAssigned = siteRows.reduce((sum, s) => sum + s.totalAssigned, 0)
        const calcOverallFillRate = globalTotalRequired > 0 ? Math.round((globalTotalAssigned / globalTotalRequired) * 100) : 0

        setSitesWithGaps(calcSitesWithGaps)
        setUnfilledSlots(calcTotalUnfilled)
        setGuardsAbsent(absents?.length || 0)
        setFillRate(calcOverallFillRate)

        // BUILD ABSENCE GUARDS TABLE
        const absenceList: AbsentGuard[] = (absents || []).map(a => {
          const assignment = a.shift_assignments
          const guardName = assignment?.users?.full_name || 'Unknown'
          const siteCode = assignment?.roster_slots?.sites?.site_code || 'Unknown'
          // Get shift name from shift_definitions by ID
          const shiftDef = supervisorSites
            .find(ss => ss.site_id === assignment?.site_id)
            ?.sites?.site_code

          return {
            name: guardName,
            siteCode,
            shift: 'Shift', // Placeholder - would need shift_definitions join
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

  const getFillRateBadgeColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800'
    if (rate >= 50) return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

  const getShiftStatusColor = (status: ShiftStatus['status']) => {
    if (status === 'filled') return 'bg-green-100 text-green-700'
    if (status === 'partial') return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  const getShiftStatusSymbol = (status: ShiftStatus['status']) => {
    if (status === 'filled') return '✓'
    if (status === 'partial') return '~'
    return '✗'
  }

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
              {/* Sites with gaps today */}
              <Card className="bg-red-50 border-red-200 border p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Sites with gaps today</p>
                    <p className="text-3xl font-bold text-red-600">{sitesWithGaps}</p>
                  </div>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </Card>

              {/* Unfilled slots today */}
              <Card className="bg-amber-50 border-amber-200 border p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Unfilled slots today</p>
                    <p className="text-3xl font-bold text-amber-600">{unfilledSlots}</p>
                  </div>
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
              </Card>

              {/* Guards absent */}
              <Card className="bg-red-50 border-red-200 border p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Guards absent</p>
                    <p className="text-3xl font-bold text-red-600">{guardsAbsent}</p>
                  </div>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </Card>

              {/* Overall fill rate */}
              <Card className="bg-green-50 border-green-200 border p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-600 mb-2">Overall fill rate</p>
                    <p className="text-3xl font-bold text-green-600">{fillRate}%</p>
                  </div>
                  <PieChart className="w-5 h-5 text-green-600" />
                </div>
              </Card>
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
                        <TableCell className="text-slate-900">{site.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {site.shifts.map((shift, sidx) => (
                              <span
                                key={sidx}
                                className={`px-2 py-1 rounded text-xs font-medium ${getShiftStatusColor(shift.status)}`}
                              >
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
                            <span className="text-green-600 font-medium">Filled</span>
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
