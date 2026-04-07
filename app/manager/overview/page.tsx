'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { LogOut, AlertCircle, PieChart, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'

interface SupervisorCard {
  id: string
  name: string
  sites: number
  guards: number
  fillRate: number
  gaps: number
}

interface SiteToAttend {
  code: string
  name: string
  supervisor: string
  fillRate: number
  openSlots: number
}

export default function ManagerOverviewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dateStr, setDateStr] = useState('')
  const [managerName, setManagerName] = useState('User')
  const [sitesWithGaps, setSitesWithGaps] = useState(0)
  const [unfilledSlots, setUnfilledSlots] = useState(0)
  const [guardsOnLeave, setGuardsOnLeave] = useState(0)
  const [guardsAbsent, setGuardsAbsent] = useState(0)
  const [orgFillRate, setOrgFillRate] = useState(0)
  const [supervisors, setSupervisors] = useState<SupervisorCard[]>([])
  const [sitesNeedingAttention, setSitesNeedingAttention] = useState<SiteToAttend[]>([])

  const handleSignOut = () => {
    router.push('/')
  }

  // Set date string on client-side only
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

  // Fetch overview data
  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        setLoading(true)

        // FETCH 1 — Get current manager name
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

        // FETCH 2 — Get all sites
        const { data: sites } = await supabase
          .from('sites')
          .select('id, site_code, name')

        if (!sites || sites.length === 0) {
          setLoading(false)
          return
        }

        const siteIds = sites.map(s => s.id)

        // FETCH 3 — Get today's coverage for all sites
        const today = getLocalDateString()
        const { data: coverage } = await supabase
          .from('roster_coverage')
          .select('site_id, assigned, required_headcount, is_fulfilled')
          .in('site_id', siteIds)
          .eq('shift_date', today)

        // FETCH 4 — Get all supervisors
        const { data: supervisorUsers } = await supabase
          .from('users')
          .select('id, full_name, external_employee_code')
          .eq('external_role', 'OPERATIONS EXECUTIVE')
          .eq('is_active', true)

        // FETCH 5 — Get supervisor site assignments
        const { data: supSites } = await supabase
          .from('supervisor_sites')
          .select('supervisor_id, site_id')

        // BUILD STATS
        const covData = coverage || []
        const totalRequired = covData.reduce((s, c) => s + c.required_headcount, 0)
        const totalAssigned = covData.reduce((s, c) => s + c.assigned, 0)

        const gapSites = siteIds.filter(id => {
          const siteCov = covData.filter(c => c.site_id === id)
          const req = siteCov.reduce((s, c) => s + c.required_headcount, 0)
          const asgn = siteCov.reduce((s, c) => s + c.assigned, 0)
          return req > asgn
        }).length

        const unfilledSlotsCount = totalRequired - totalAssigned
        const fillRate = totalRequired > 0
          ? Math.round((totalAssigned / totalRequired) * 100)
          : 0

        setSitesWithGaps(gapSites)
        setUnfilledSlots(unfilledSlotsCount)
        setOrgFillRate(fillRate)

        // BUILD SUPERVISOR CARDS
        const supCards: SupervisorCard[] = (supervisorUsers || []).map(sup => {
          const supSiteIds = (supSites || [])
            .filter(ss => ss.supervisor_id === sup.id)
            .map(ss => ss.site_id)

          const supCov = covData.filter(c => supSiteIds.includes(c.site_id))
          const supReq = supCov.reduce((s, c) => s + c.required_headcount, 0)
          const supAssign = supCov.reduce((s, c) => s + c.assigned, 0)
          const supFillRate = supReq > 0
            ? Math.round((supAssign / supReq) * 100)
            : 0
          const supGaps = supSiteIds.filter(id => {
            const siteCov = covData.filter(c => c.site_id === id)
            const req = siteCov.reduce((s, c) => s + c.required_headcount, 0)
            const asgn = siteCov.reduce((s, c) => s + c.assigned, 0)
            return req > asgn
          }).length

          return {
            id: sup.id,
            name: sup.full_name,
            sites: supSiteIds.length,
            guards: 0, // Would need additional query to count guards per supervisor
            fillRate: supFillRate,
            gaps: supGaps,
          }
        })

        setSupervisors(supCards)

        // BUILD SITES NEEDING ATTENTION (fill rate < 100%, sorted by lowest first)
        const sitesAttention = sites
          .map(site => {
            const siteCov = covData.filter(c => c.site_id === site.id)
            const req = siteCov.reduce((s, c) => s + c.required_headcount, 0)
            const asgn = siteCov.reduce((s, c) => s + c.assigned, 0)
            const fillPct = req > 0 ? Math.round((asgn / req) * 100) : 100
            const openSlots = req - asgn

            // Find supervisor for this site
            const supId = (supSites || []).find(ss => ss.site_id === site.id)?.supervisor_id
            const supervisor = supervisorUsers?.find(s => s.id === supId)?.full_name || 'Unassigned'

            return {
              code: site.site_code,
              name: site.name,
              supervisor,
              fillRate: fillPct,
              openSlots: Math.max(0, openSlots),
            }
          })
          .filter(s => s.fillRate < 100)
          .sort((a, b) => a.fillRate - b.fillRate)
          .slice(0, 5)

        setSitesNeedingAttention(sitesAttention)
      } catch (error) {
        console.error('[v0] Error fetching overview:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOverviewData()
  }, [router])

  const getFillRateColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-50 text-green-700 border-green-200'
    if (rate >= 50) return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-red-50 text-red-700 border-red-200'
  }

  const getFillRateBadgeColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-100 text-green-800'
    if (rate >= 50) return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

  // Stats array using real data
  const stats = [
    { label: 'Sites with gaps today', value: sitesWithGaps, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Unfilled slots', value: unfilledSlots, color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-600', icon: AlertCircle },
    { label: 'Guards on leave', value: guardsOnLeave, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-600', icon: Calendar },
    { label: 'Guards absent', value: guardsAbsent, color: 'bg-red-50 border-red-200', textColor: 'text-red-600', icon: AlertCircle },
    { label: 'Org fill rate', value: `${orgFillRate}%`, color: 'bg-green-50 border-green-200', textColor: 'text-green-600', icon: PieChart },
  ]

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
        {loading ? (
          <div className="text-center text-slate-600 py-12">Loading overview data...</div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-4 mb-8">
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

            {/* By Supervisor Section */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">By supervisor</h3>
              {supervisors.length === 0 ? (
                <Card className="border-slate-200 p-6 text-center text-slate-600">
                  No supervisors found
                </Card>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {supervisors.map((supervisor) => (
                    <Card key={supervisor.id} className="border-slate-200 p-6">
                      <h4 className="font-medium text-slate-900 mb-4">{supervisor.name}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Sites:</span>
                          <span className="font-medium text-slate-900">{supervisor.sites}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Fill rate:</span>
                          <Badge className={getFillRateBadgeColor(supervisor.fillRate)}>
                            {supervisor.fillRate}%
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Gaps:</span>
                          <span className="font-medium text-red-600">{supervisor.gaps}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Sites Needing Attention Table */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Sites needing attention</h3>
              <Card className="border-slate-200 overflow-hidden">
                {sitesNeedingAttention.length === 0 ? (
                  <div className="p-6 text-center text-slate-600">
                    All sites are fully covered today!
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200">
                        <TableHead className="text-slate-700 font-semibold">Site Code</TableHead>
                        <TableHead className="text-slate-700 font-semibold">Site Name</TableHead>
                        <TableHead className="text-slate-700 font-semibold">Supervisor</TableHead>
                        <TableHead className="text-slate-700 font-semibold">Fill Rate</TableHead>
                        <TableHead className="text-slate-700 font-semibold">Open Slots</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sitesNeedingAttention.map((site, idx) => (
                        <TableRow key={idx} className="border-slate-200 hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-900">{site.code}</TableCell>
                          <TableCell className="text-slate-900">{site.name}</TableCell>
                          <TableCell className="text-slate-700">{site.supervisor}</TableCell>
                          <TableCell>
                            <Badge className={getFillRateBadgeColor(site.fillRate)}>
                              {site.fillRate}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-red-600 font-medium">{site.openSlots}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </>
        )}
      </>
    )
  }
