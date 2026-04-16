import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/utils'

export interface SiteData {
  id: string
  site_code: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  geofence_radius: number | null
  is_active: boolean
}

export interface ShiftDefinition {
  id: string
  shift_name: string
  start_time: string
  end_time: string
  required_headcount: number
  is_active: boolean
}

export interface SiteDataState {
  site: SiteData | null
  supervisor: { id: string; name: string } | null
  shiftDefinitions: ShiftDefinition[]
  todayCoverage: { filled: number; total: number }
  assignedGuards: string[]
  managerName: string
  loading: boolean
  error: string | null
}

export const useSiteData = (siteCode: string) => {
  const [state, setState] = useState<SiteDataState>({
    site: null,
    supervisor: null,
    shiftDefinitions: [],
    todayCoverage: { filled: 0, total: 0 },
    assignedGuards: [],
    managerName: 'User',
    loading: true,
    error: null,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        const userName = user?.user_metadata?.full_name || 'User'

        // Fetch site
        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('id, site_code, name, address, latitude, longitude, geofence_radius, is_active')
          .eq('site_code', siteCode)
          .single()

        if (siteError) throw siteError
        if (!siteData) {
          throw new Error('Site not found')
        }

        // Fetch supervisor
        const { data: supData } = await supabase
          .from('supervisor_sites')
          .select('supervisor_id, users!supervisor_sites_supervisor_id_fkey(full_name)')
          .eq('site_id', siteData.id)
          .single()

        const usersData = supData?.users as unknown
        let supervisorName: string | null = null
        let supervisorId: string | null = null
        if (usersData) {
          if (Array.isArray(usersData) && usersData.length > 0) {
            supervisorName = usersData[0].full_name
            supervisorId = supData?.supervisor_id
          } else if (typeof usersData === 'object' && 'full_name' in (usersData as object)) {
            supervisorName = (usersData as { full_name: string }).full_name
            supervisorId = supData?.supervisor_id
          }
        }

        // Fetch shift definitions
        const { data: shiftsData } = await supabase
          .from('shift_definitions')
          .select('id, shift_name, start_time, end_time, required_headcount, is_active')
          .eq('site_id', siteData.id)
          .order('start_time', { ascending: true })

        // Calculate coverage for today
        const today = getLocalDateString()
        const { data: slotsData } = await supabase
          .from('roster_slots')
          .select('id, shift_definition_id, shift_definitions(required_headcount)')
          .eq('site_id', siteData.id)
          .eq('shift_date', today)

        const { data: assignmentsData } = await supabase
          .from('shift_assignments')
          .select('roster_slot_id, guard_id')
          .in('roster_slot_id', (slotsData || []).map(s => s.id))
          .eq('is_cancelled', false)

        const assignedSet = new Set(assignmentsData?.map(a => a.guard_id) || [])
        const totalHeadcount = (slotsData || []).reduce(
          (sum, slot) => sum + ((slot.shift_definitions as any)?.[0]?.required_headcount || 0),
          0
        )

        setState(prev => ({
          ...prev,
          site: siteData,
          supervisor: supervisorName && supervisorId ? { id: supervisorId, name: supervisorName } : null,
          shiftDefinitions: shiftsData || [],
          todayCoverage: { filled: assignedSet.size, total: totalHeadcount },
          assignedGuards: Array.from(assignedSet),
          managerName: userName,
          loading: false,
        }))
      } catch (err) {
        console.error('[v0] Error fetching site data:', err)
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load site',
        }))
      }
    }

    if (siteCode) {
      fetchData()
    }
  }, [siteCode])

  return state
}
