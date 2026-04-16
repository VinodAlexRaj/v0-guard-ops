import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { EMPTY_FORM } from '../lib/shift-constants'
import { normalizeTime, sameDays, sortDays, parseShiftSaveError } from '../lib/shift-utils'
import type { Shift } from './useShiftsData'

export type ShiftFormValues = {
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

export function useShiftForm() {
  const [formValues, setFormValues] = useState<ShiftFormValues>({
    shift_name: EMPTY_FORM.shift_name,
    shift_code: EMPTY_FORM.shift_code,
    start_time: EMPTY_FORM.start_time,
    end_time: EMPTY_FORM.end_time,
    required_headcount: EMPTY_FORM.required_headcount,
    start_date: EMPTY_FORM.start_date,
    end_date: EMPTY_FORM.end_date,
    days_of_week: [...EMPTY_FORM.days_of_week],
    is_chargeable: EMPTY_FORM.is_chargeable,
    type: EMPTY_FORM.type,
    is_active: EMPTY_FORM.is_active,
  })
  const [saving, setSaving] = useState(false)

  const handleFormChange = <K extends keyof ShiftFormValues>(
    field: K,
    value: ShiftFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleDayToggle = (dayValue: number) => {
    setFormValues((prev) => {
      const current = prev.days_of_week || []
      const updated = current.includes(dayValue)
        ? current.filter((d) => d !== dayValue)
        : [...current, dayValue].sort((a, b) => a - b)

      return {
        ...prev,
        days_of_week: updated,
      }
    })
  }

  const resetForm = () => {
    setFormValues({ ...(EMPTY_FORM as ShiftFormValues) })
  }

  const populateFormFromShift = (shift: Shift) => {
    setFormValues({
      shift_name: shift.shift_name || '',
      shift_code: shift.shift_code || '',
      start_time: normalizeTime(shift.start_time),
      end_time: normalizeTime(shift.end_time),
      required_headcount: shift.required_headcount || 1,
      start_date: shift.start_date || '',
      end_date: shift.end_date || '',
      days_of_week: shift.days_of_week || [1, 2, 3, 4, 5, 6, 7],
      is_chargeable: shift.is_chargeable ?? true,
      type: shift.type || 'contract',
      is_active: shift.is_active ?? true,
    })
  }

  const validateForm = () => {
    if (!formValues.shift_name.trim()) {
      alert('Shift name is required.')
      return false
    }
    if (!formValues.shift_code.trim()) {
      alert('Shift code is required.')
      return false
    }
    if (!formValues.start_time || !formValues.end_time) {
      alert('Start time and end time are required.')
      return false
    }
    if (!formValues.start_date || !formValues.end_date) {
      alert('Start date and end date are required.')
      return false
    }
    if (!formValues.required_headcount || formValues.required_headcount < 1) {
      alert('Required headcount must be at least 1.')
      return false
    }
    if (formValues.days_of_week.length === 0) {
      alert('Select at least one day.')
      return false
    }
    if (formValues.end_date < formValues.start_date) {
      alert('End date cannot be earlier than start date.')
      return false
    }
    return true
  }

  const hasDuplicateShiftTemplate = (
    selectedShifts: Shift[],
    isAddMode: boolean,
    editingShift: Shift | null
  ) => {
    return selectedShifts.some((shift) => {
      if (!isAddMode && editingShift && shift.id === editingShift.id) return false

      return (
        shift.shift_code?.trim().toLowerCase() === formValues.shift_code.trim().toLowerCase() &&
        normalizeTime(shift.start_time) === normalizeTime(formValues.start_time) &&
        normalizeTime(shift.end_time) === normalizeTime(formValues.end_time) &&
        (shift.start_date || '') === formValues.start_date &&
        (shift.end_date || '') === formValues.end_date &&
        sameDays(shift.days_of_week, formValues.days_of_week)
      )
    })
  }

  const hasStructuralChanges = (editingShift: Shift | null, siteId: string) => {
    if (!editingShift) return false

    return (
      editingShift.site_id !== siteId ||
      normalizeTime(editingShift.start_time) !== normalizeTime(formValues.start_time) ||
      normalizeTime(editingShift.end_time) !== normalizeTime(formValues.end_time) ||
      (editingShift.start_date || '') !== formValues.start_date ||
      (editingShift.end_date || '') !== formValues.end_date ||
      !sameDays(editingShift.days_of_week, formValues.days_of_week) ||
      (editingShift.is_active ?? true) !== formValues.is_active
    )
  }

  const isActivatingShift = (editingShift: Shift | null) => {
    if (!editingShift) return false
    return (editingShift.is_active ?? true) === false && formValues.is_active === true
  }

  const isDeactivatingShift = (editingShift: Shift | null) => {
    if (!editingShift) return false
    return (editingShift.is_active ?? true) === true && formValues.is_active === false
  }

  const runPreflightCheck = async (editingShift: Shift | null) => {
    if (!editingShift) return { ok: true }

    const structural = hasStructuralChanges(editingShift, editingShift.site_id)
    if (!structural) return { ok: true }

    const { data: slotRows, error: slotError } = await supabase
      .from('roster_slots')
      .select('id, shift_date')
      .eq('shift_definition_id', editingShift.id)

    if (slotError) {
      return {
        ok: false,
        message: 'Failed to check existing roster slots before saving.',
      }
    }

    const slotIds = (slotRows || []).map((row) => row.id)

    if (slotIds.length === 0) {
      return { ok: true }
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('shift_assignments')
      .select('id, roster_slot_id')
      .in('roster_slot_id', slotIds)
      .eq('is_cancelled', false)

    if (assignmentError) {
      return {
        ok: false,
        message: 'Failed to check active assignments before saving.',
      }
    }

    if ((assignmentRows || []).length === 0) {
      return { ok: true }
    }

    // Check if any assignments are AFTER the new end_date
    const assignmentsAfterNewEndDate = assignmentRows?.filter((assignment) => {
      const slotRow = slotRows?.find((slot) => slot.id === assignment.roster_slot_id)
      return slotRow && slotRow.shift_date > formValues.end_date
    })

    if ((assignmentsAfterNewEndDate || []).length > 0) {
      return {
        ok: false,
        message: `This change is blocked because ${assignmentsAfterNewEndDate?.length} assignment(s) exist after the new end date (${formValues.end_date}). Remove those assignments first.`,
      }
    }

    return { ok: true }
  }

  const buildConfirmationMessage = (editingShift: Shift | null, siteId: string) => {
    const messages: string[] = []

    if (isActivatingShift(editingShift)) {
      messages.push('Activating this shift will regenerate roster slots for its configured date range.')
    }

    if (isDeactivatingShift(editingShift)) {
      messages.push(
        'Deactivating this shift may remove future unassigned roster slots and stop future slot generation.'
      )
    }

    if (hasStructuralChanges(editingShift, siteId)) {
      messages.push('You are changing the live schedule structure. This affects generated roster slots.')
    }

    if (messages.length === 0) {
      messages.push('Confirm save?')
    }

    return messages.join(' ')
  }

  const saveShiftToDb = async (siteId: string, isAddMode: boolean, editingShift: Shift | null) => {
    try {
      setSaving(true)

      const payload = {
        site_id: siteId,
        shift_name: formValues.shift_name.trim(),
        shift_code: formValues.shift_code.trim(),
        start_time: normalizeTime(formValues.start_time),
        end_time: normalizeTime(formValues.end_time),
        required_headcount: Number(formValues.required_headcount),
        start_date: formValues.start_date,
        end_date: formValues.end_date,
        days_of_week: sortDays(formValues.days_of_week),
        is_chargeable: formValues.is_chargeable,
        type: formValues.type.toLowerCase(),
        is_active: formValues.is_active,
      }

      if (isAddMode) {
        const { error } = await supabase.from('shift_definitions').insert(payload)

        if (error) throw error
      } else {
        if (!editingShift) {
          alert('No shift selected for editing.')
          return false
        }

        const { error } = await supabase
          .from('shift_definitions')
          .update(payload)
          .eq('id', editingShift.id)

        if (error) throw error
      }

      return true
    } catch (error: any) {
      console.error('[shifts] Error saving shift:', error)
      alert(parseShiftSaveError(error?.message || 'Failed to save shift.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    formValues,
    saving,
    handleFormChange,
    handleDayToggle,
    resetForm,
    populateFormFromShift,
    validateForm,
    hasDuplicateShiftTemplate,
    hasStructuralChanges,
    isActivatingShift,
    isDeactivatingShift,
    runPreflightCheck,
    buildConfirmationMessage,
    saveShiftToDb,
  }
}