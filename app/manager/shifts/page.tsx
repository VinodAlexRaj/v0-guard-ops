'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Edit2, LogOut, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

/* ================= TYPES ================= */

type Site = {
  id: string
  site_code: string
  name: string
}

type Shift = {
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
}

type ShiftFormValues = {
  shift_name: string
  shift_code: string
  start_time: string
  end_time: string
  required_headcount: number
  start_date: string
  end_date: string
  days_of_week: number[]
  is_chargeable: boolean
  type: string
  is_active: boolean
}

/* ================= HELPERS ================= */

const dayOptions = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
]

const emptyForm: ShiftFormValues = {
  shift_name: '',
  shift_code: '',
  start_time: '',
  end_time: '',
  required_headcount: 1,
  start_date: '',
  end_date: '',
  days_of_week: [1, 2, 3, 4, 5, 6, 7],
  is_chargeable: true,
  type: 'contract',
  is_active: true,
}

const normalizeTime = (t?: string | null) => t?.slice(0, 5) || ''

const toMinutes = (t?: string | null) => {
  if (!t) return null
  const [h, m] = normalizeTime(t).split(':').map(Number)
  return h * 60 + m
}

const isOvernight = (s?: string, e?: string) => {
  const sm = toMinutes(s)
  const em = toMinutes(e)
  if (sm == null || em == null) return false
  return em <= sm
}

const sortDays = (d: number[]) => [...d].sort((a, b) => a - b)

/* ================= PAGE ================= */

export default function Page() {
  const router = useRouter()

  const [sites, setSites] = useState<Site[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selectedSiteCode, setSelectedSiteCode] = useState('')
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [form, setForm] = useState<ShiftFormValues>({ ...emptyForm })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const selectedSite = useMemo(() => {
    return sites.find(s => s.site_code === selectedSiteCode) || null
  }, [sites, selectedSiteCode])

  const selectedShifts = useMemo(() => {
    if (!selectedSite) return []
    return shifts.filter(s => s.site_id === selectedSite.id)
  }, [selectedSite, shifts])

  /* ================= LOAD ================= */

  const load = async () => {
    setLoading(true)

    const { data: sitesData } = await supabase
      .from('sites')
      .select('*')

    const { data: shiftData } = await supabase
      .from('shift_definitions')
      .select('*')

    setSites(sitesData || [])
    setShifts(shiftData || [])

    if (!selectedSiteCode && sitesData?.length) {
      setSelectedSiteCode(sitesData[0].site_code)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  /* ================= LOGIC ================= */

  const hasStructuralChanges = () => {
    if (!editingShift) return false

    return (
      normalizeTime(editingShift.start_time) !== form.start_time ||
      normalizeTime(editingShift.end_time) !== form.end_time ||
      editingShift.start_date !== form.start_date ||
      editingShift.end_date !== form.end_date ||
      JSON.stringify(sortDays(editingShift.days_of_week || [])) !== JSON.stringify(sortDays(form.days_of_week)) ||
      editingShift.is_active !== form.is_active
    )
  }

  /* ================= PREFLIGHT ================= */

  const runPreflight = async () => {
    if (!editingShift) return true

    const { count, error } = await supabase
      .from('shift_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('is_cancelled', false)
      .in('roster_slot_id',
        (
          await supabase
            .from('roster_slots')
            .select('id')
            .eq('shift_definition_id', editingShift.id)
        ).data?.map(r => r.id) || []
      )

    if (error) return false

    if ((count || 0) > 0) {
      alert('Blocked: Active assignments exist.')
      return false
    }

    return true
  }

  /* ================= SAVE ================= */

  const handleSave = async () => {

    if (!selectedSite) return

    if (!(await runPreflight())) return

    if (hasStructuralChanges()) {
      setConfirmOpen(true)
      return
    }

    await doSave()
  }

  const doSave = async () => {
    setSaving(true)

    const payload = {
      site_id: selectedSite!.id,
      shift_name: form.shift_name,
      shift_code: form.shift_code,
      start_time: form.start_time,
      end_time: form.end_time,
      required_headcount: form.required_headcount,
      start_date: form.start_date,
      end_date: form.end_date,
      days_of_week: form.days_of_week,
      is_chargeable: form.is_chargeable,
      type: form.type,
      is_active: form.is_active
    }

    if (editingShift) {
      await supabase.from('shift_definitions').update(payload).eq('id', editingShift.id)
    } else {
      await supabase.from('shift_definitions').insert(payload)
    }

    await load()
    setOpen(false)
    setConfirmOpen(false)
    setSaving(false)
  }

  /* ================= UI ================= */

  if (loading) return <div>Loading...</div>

  return (
    <>
      <Button onClick={() => { setEditingShift(null); setForm(emptyForm); setOpen(true) }}>
        Add Shift
      </Button>

      <table>
        <tbody>
          {selectedShifts.map(s => (
            <tr key={s.id}>
              <td>{s.shift_name}</td>
              <td>{normalizeTime(s.start_time)}-{normalizeTime(s.end_time)}</td>
              <td>
                <Button onClick={() => {
                  setEditingShift(s)
                  setForm({
                    shift_name: s.shift_name,
                    shift_code: s.shift_code || '',
                    start_time: normalizeTime(s.start_time),
                    end_time: normalizeTime(s.end_time),
                    required_headcount: s.required_headcount,
                    start_date: s.start_date || '',
                    end_date: s.end_date || '',
                    days_of_week: s.days_of_week || [],
                    is_chargeable: s.is_chargeable ?? true,
                    type: s.type || 'contract',
                    is_active: s.is_active ?? true
                  })
                  setOpen(true)
                }}>
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MAIN MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>

          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit' : 'Add'} Shift</DialogTitle>
          </DialogHeader>

          {/* Activation warning */}
          {editingShift && editingShift.is_active !== form.is_active && (
            <div className="bg-amber-100 p-3 text-sm">
              {form.is_active
                ? 'Activating will regenerate roster slots.'
                : 'Deactivating may remove future slots.'}
            </div>
          )}

          <Input value={form.shift_name} onChange={e => setForm({ ...form, shift_name: e.target.value })} />
          <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />

          {isOvernight(form.start_time, form.end_time) && (
            <div className="text-amber-600">Overnight shift</div>
          )}

          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              Save
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* CONFIRM MODAL */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Change</DialogTitle>
          </DialogHeader>

          <p>This will modify live schedule slots. Continue?</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={doSave}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}