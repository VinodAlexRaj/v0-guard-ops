'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DAY_OPTIONS, SHIFT_TYPES } from '../lib/shift-constants'
import type { ShiftFormValues } from '../hooks/useShiftForm'

interface ShiftFormModalProps {
  open: boolean
  isAddMode: boolean
  formValues: ShiftFormValues
  isLoading?: boolean
  onFormChange: <K extends keyof ShiftFormValues>(field: K, value: ShiftFormValues[K]) => void
  onDayToggle: (dayValue: number) => void
  onSave: () => void
  onCancel: () => void
}

export function ShiftFormModal({
  open,
  isAddMode,
  formValues,
  isLoading = false,
  onFormChange,
  onDayToggle,
  onSave,
  onCancel,
}: ShiftFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(newOpen) => !newOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isAddMode ? 'Create Shift' : 'Edit Shift'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Basic Info</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shift Name *</label>
                <Input
                  type="text"
                  value={formValues.shift_name}
                  onChange={(e) => onFormChange('shift_name', e.target.value)}
                  placeholder="e.g. Morning"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shift Code *</label>
                <Input
                  type="text"
                  value={formValues.shift_code}
                  onChange={(e) => onFormChange('shift_code', e.target.value)}
                  placeholder="e.g. MRN-01"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={formValues.type}
                  onChange={(e) => onFormChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900"
                >
                  {SHIFT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Schedule</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                  <Input
                    type="time"
                    value={formValues.start_time}
                    onChange={(e) => onFormChange('start_time', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
                  <Input
                    type="time"
                    value={formValues.end_time}
                    onChange={(e) => onFormChange('end_time', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Days of Week</label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => onDayToggle(day.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        formValues.days_of_week.includes(day.value)
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <Input
                    type="date"
                    value={formValues.start_date}
                    onChange={(e) => onFormChange('start_date', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
                  <Input
                    type="date"
                    value={formValues.end_date}
                    onChange={(e) => onFormChange('end_date', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Staffing Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Staffing</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Required Headcount *</label>
                <Input
                  type="number"
                  value={formValues.required_headcount}
                  onChange={(e) => onFormChange('required_headcount', parseInt(e.target.value))}
                  min="1"
                  className="text-sm"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formValues.is_active}
                  onChange={(e) => onFormChange('is_active', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-700 border-slate-300"
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isLoading} className="bg-teal-600 hover:bg-teal-700">
            {isLoading ? 'Saving...' : isAddMode ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
