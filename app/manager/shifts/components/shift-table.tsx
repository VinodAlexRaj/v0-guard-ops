'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit2, AlertCircle } from 'lucide-react'
import { formatTime, formatDate, formatDays, getTypeBadgeColor, formatTypeLabel } from '../lib/shift-utils'
import type { Site, Shift } from '../hooks/useShiftsData'

interface ShiftTableProps {
  site: Site | null
  shifts: Shift[]
  onAddShift: () => void
  onEditShift: (shift: Shift) => void
}

export function ShiftTable({ site, shifts, onAddShift, onEditShift }: ShiftTableProps) {
  if (!site) return null

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{site.site_code}</h2>
            <p className="text-sm text-slate-600">{site.name}</p>
          </div>

          <Button className="bg-teal-600 hover:bg-teal-700" onClick={onAddShift}>
            + Add Shift
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Shifts</p>
            <p className="text-lg font-bold text-slate-900">{shifts.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Active</p>
            <p className="text-lg font-bold text-green-600">{shifts.filter((s) => s.is_active).length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Headcount</p>
            <p className="text-lg font-bold text-slate-900">{shifts.reduce((sum, s) => sum + s.required_headcount, 0)}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {shifts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No shifts defined</p>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Shift</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Headcount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{shift.shift_name}</p>
                        <p className="text-xs text-slate-500">{shift.shift_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{shift.required_headcount}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-600">{formatDays(shift.days_of_week)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getTypeBadgeColor(shift.type)}>
                        {formatTypeLabel(shift.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={shift.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}>
                        {shift.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditShift(shift)}
                        className="text-teal-600 hover:bg-teal-50"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
