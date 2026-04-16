import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export type Site = {
  id: string
  site_code: string
  name: string
}

export type Shift = {
  id: string
  site_id: string
  shift_name: string
  shift_code: string | null
  start_time: string
  end_time: string
  required_headcount: number
  start_date: string | null
  end_date: string | null
  days_of_week: number[] | null
  is_chargeable: boolean | null
  type: string | null
  is_active: boolean | null
  created_at?: string
  updated_at?: string
}

export function useShiftsData() {
  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState<Site[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [managerName, setManagerName] = useState('Manager')

  const loadCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (!error && data?.full_name) {
      setManagerName(data.full_name)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)

      await loadCurrentUser()

      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, site_code, name')
        .order('site_code')

      if (sitesError) throw sitesError

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shift_definitions')
        .select(
          `
          id,
          site_id,
          shift_name,
          shift_code,
          start_time,
          end_time,
          required_headcount,
          start_date,
          end_date,
          days_of_week,
          is_chargeable,
          type,
          is_active,
          created_at,
          updated_at
        `
        )
        .order('site_id')
        .order('start_time')
        .order('shift_code')
        .order('shift_name')

      if (shiftsError) throw shiftsError

      const safeSites = (sitesData || []) as Site[]
      const safeShifts = (shiftsData || []) as Shift[]

      setSites(safeSites)
      setShifts(safeShifts)
    } catch (error) {
      console.error('[shifts] Error loading data:', error)
      alert('Failed to load shift setup data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return {
    loading,
    sites,
    shifts,
    managerName,
    reload: loadData,
  }
}
