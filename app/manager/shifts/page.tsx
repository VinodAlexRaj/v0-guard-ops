'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, Plus, Edit2, AlertCircle, X } from 'lucide-react'

export default function ShiftsPage() {
  const router = useRouter()
  const [selectedSiteCode, setSelectedSiteCode] = useState('KLSNT01')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingShift, setEditingShift] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddMode, setIsAddMode] = useState(false)
  const [siteShifts, setSiteShifts] = useState<Record<string, any[]>>({})
  const [formValues, setFormValues] = useState<any>({})

  const handleSignOut = () => {
    router.push('/')
  }

  const sites = [
    { code: 'KLSNT01', name: 'Sentral Tower', shiftCount: 3 },
    { code: 'PJAYA02', name: 'Damansara Heights', shiftCount: 2 },
    { code: 'SUBNG05', name: 'Subang Parade', shiftCount: 2 },
    { code: 'SETIA08', name: 'Setia Alam', shiftCount: 0 },
    { code: 'AMPNG03', name: 'Ampang Point', shiftCount: 3 },
    { code: 'MONT11', name: 'Mont Kiara', shiftCount: 2 },
  ]

  const shifts: Record<string, any[]> = {
    KLSNT01: [
      {
        id: 1,
        name: 'Morning',
        code: 'MRN-01',
        startTime: '06:00',
        endTime: '14:00',
        headcount: 3,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: '01 Jan 2026',
        endDate: '31 Dec 2026',
        type: 'Contract',
        isActive: true,
      },
      {
        id: 2,
        name: 'Afternoon',
        code: 'AFT-01',
        startTime: '14:00',
        endTime: '22:00',
        headcount: 2,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: '01 Jan 2026',
        endDate: '31 Dec 2026',
        type: 'Contract',
        isActive: true,
      },
      {
        id: 3,
        name: 'Night',
        code: 'NGT-01',
        startTime: '22:00',
        endTime: '06:00',
        headcount: 2,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: '01 Jan 2026',
        endDate: '31 Dec 2026',
        type: 'Contract',
        isActive: true,
      },
    ],
    PJAYA02: [
      {
        id: 4,
        name: 'Morning',
        code: 'MRN-02',
        startTime: '07:00',
        endTime: '15:00',
        headcount: 2,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        startDate: '01 Jan 2026',
        endDate: '31 Dec 2026',
        type: 'Training',
        isActive: true,
      },
      {
        id: 5,
        name: 'Evening',
        code: 'EVN-02',
        startTime: '15:00',
        endTime: '23:00',
        headcount: 2,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: '01 Jan 2026',
        endDate: '31 Dec 2026',
        type: 'Contract',
        isActive: true,
      },
    ],
  }

  const filteredSites = sites.filter((site) =>
    site.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedSite = sites.find((s) => s.code === selectedSiteCode)
  const selectedShifts = [...(shifts[selectedSiteCode] || []), ...(siteShifts[selectedSiteCode] || [])]

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'Contract':
        return 'bg-green-100 text-green-700'
      case 'Training':
        return 'bg-blue-100 text-blue-700'
      case 'Temporary':
        return 'bg-amber-100 text-amber-700'
      case 'Replacement':
        return 'bg-rose-100 text-rose-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const emptyForm = {
    name: '', code: '', startTime: '', endTime: '',
    headcount: 1, days: [] as string[], startDate: '', endDate: '',
    type: 'Contract', isActive: true,
  }

  const handleEditShift = (shift: any) => {
    setIsAddMode(false)
    setEditingShift(shift)
    setFormValues({ ...shift })
    setIsEditModalOpen(true)
  }

  const handleAddShift = () => {
    setIsAddMode(true)
    setEditingShift(null)
    setFormValues({ ...emptyForm })
    setIsEditModalOpen(true)
  }

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleDayToggle = (day: string) => {
    setFormValues((prev: any) => {
      const days: string[] = prev.days || []
      return {
        ...prev,
        days: days.includes(day) ? days.filter((d: string) => d !== day) : [...days, day],
      }
    })
  }

  const handleSaveShift = () => {
    if (isAddMode) {
      const newShift = {
        ...formValues,
        id: Date.now(),
      }
      setSiteShifts((prev) => ({
        ...prev,
        [selectedSiteCode]: [...(prev[selectedSiteCode] || []), newShift],
      }))
    }
    setIsEditModalOpen(false)
    setEditingShift(null)
    setIsAddMode(false)
  }

  const todayDate = new Date(2026, 3, 10)
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

  return (
    <>
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{dateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">Vinod Alex Raj</p>
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

      {/* Two-Panel Layout - 30/70 split */}
      <div className="flex flex-1 bg-slate-50">
        {/* Left Panel - Site List (30%) - Lightweight */}
        <div className="w-3/10 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Sites</h3>
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1 p-2">
            {filteredSites.map((site) => (
              <button
                key={site.code}
                onClick={() => setSelectedSiteCode(site.code)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                  selectedSiteCode === site.code
                    ? 'bg-teal-50 text-teal-900 font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-medium text-sm">{site.code}</div>
                <div className="text-xs text-slate-500">{site.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Shift Management (70%) */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedSite && (
            <>
              {/* Site Summary Header */}
              <div className="border-b border-slate-200 p-6 bg-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedSite.code}</h2>
                    <p className="text-sm text-slate-600">{selectedSite.name}</p>
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddShift}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Shift
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold">Total Shifts</p>
                    <p className="text-lg font-bold text-slate-900">{selectedShifts.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold">Active</p>
                    <p className="text-lg font-bold text-green-600">{selectedShifts.filter(s => s.isActive).length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold">Total Headcount</p>
                    <p className="text-lg font-bold text-slate-900">{selectedShifts.reduce((sum, s) => sum + s.headcount, 0)}</p>
                  </div>
                </div>
              </div>

              {/* Shifts List - Table Style */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedShifts.length === 0 ? (
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
                        {selectedShifts.map((shift) => (
                          <tr key={shift.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-sm text-slate-900">{shift.name}</p>
                                <p className="text-xs text-slate-500">{shift.code}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-900">{shift.startTime}–{shift.endTime}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-900">{shift.headcount}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-600">{shift.days.join(', ')}</p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={getTypeBadgeColor(shift.type)}>
                                {shift.type}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={shift.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}>
                                {shift.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditShift(shift)}
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
            </>
          )}
        </div>
      </div>

      {/* Right-Side Drawer Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/30"
            onClick={() => { setIsEditModalOpen(false); setIsAddMode(false) }}
          />
          {/* Drawer */}
          <div className="w-96 bg-white shadow-lg overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-200 p-6 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                {isAddMode ? 'Create Shift' : 'Edit Shift'}
              </h2>
              <button
                onClick={() => { setIsEditModalOpen(false); setIsAddMode(false) }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info Section */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Basic Info</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Shift Name *</label>
                    <Input
                      type="text"
                      value={formValues.name || ''}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="e.g. Morning"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Shift Code *</label>
                    <Input
                      type="text"
                      value={formValues.code || ''}
                      onChange={(e) => handleFormChange('code', e.target.value)}
                      placeholder="e.g. MRN-01"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                    <select
                      value={formValues.type || 'Contract'}
                      onChange={(e) => handleFormChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900"
                    >
                      <option>Contract</option>
                      <option>Training</option>
                      <option>Temporary</option>
                      <option>Replacement</option>
                      <option>Internal</option>
                      <option>Other</option>
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
                        value={formValues.startTime || ''}
                        onChange={(e) => handleFormChange('startTime', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
                      <Input
                        type="time"
                        value={formValues.endTime || ''}
                        onChange={(e) => handleFormChange('endTime', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Days of Week</label>
                    <div className="flex gap-2 flex-wrap">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <button
                          key={day}
                          onClick={() => handleDayToggle(day)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                            (formValues.days || []).includes(day)
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                      <Input
                        type="date"
                        value={formValues.startDate || ''}
                        onChange={(e) => handleFormChange('startDate', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
                      <Input
                        type="date"
                        value={formValues.endDate || ''}
                        onChange={(e) => handleFormChange('endDate', e.target.value)}
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
                      value={formValues.headcount || 1}
                      onChange={(e) => handleFormChange('headcount', parseInt(e.target.value))}
                      min="1"
                      className="text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formValues.isActive || false}
                      onChange={(e) => handleFormChange('isActive', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Active</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-6 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => { setIsEditModalOpen(false); setIsAddMode(false) }}
                className="text-slate-700 border-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveShift}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isAddMode ? 'Create' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
