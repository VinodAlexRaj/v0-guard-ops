'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useShiftsData } from './hooks/useShiftsData'
import { useShiftForm } from './hooks/useShiftForm'
import { ShiftFormModal } from './components/shift-form-modal'
import { SiteSidebar } from './components/site-sidebar'
import { ShiftTable } from './components/shift-table'
import { ConfirmDialog } from './components/confirm-dialog'

export default function ShiftsPage() {
  const router = useRouter()
  const { loading, sites, shifts, managerName, reload } = useShiftsData()
  const {
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
  } = useShiftForm()

  const [selectedSiteCode, setSelectedSiteCode] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddMode, setIsAddMode] = useState(false)
  const [editingShift, setEditingShift] = useState<ReturnType<typeof useShiftsData>['shifts'][0] | null>(null)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')

  const todayDate = new Date()
  const dateStr = todayDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

  // Auto-select first site on load
  useEffect(() => {
    if (!selectedSiteCode && sites.length > 0) {
      setSelectedSiteCode(sites[0].site_code)
    }
  }, [sites, selectedSiteCode])

  const selectedSite = useMemo(() => {
    return sites.find((s) => s.site_code === selectedSiteCode) || null
  }, [sites, selectedSiteCode])

  const selectedShifts = useMemo(() => {
    if (!selectedSite) return []
    return shifts.filter((shift) => shift.site_id === selectedSite.id)
  }, [shifts, selectedSite])

  const handleSignOut = () => {
    router.push('/')
  }

  const handleAddShift = () => {
    setIsAddMode(true)
    setEditingShift(null)
    resetForm()
    setIsEditModalOpen(true)
  }

  const handleEditShift = (shift: typeof shifts[0]) => {
    setIsAddMode(false)
    setEditingShift(shift)
    populateFormFromShift(shift)
    setIsEditModalOpen(true)
  }

  const closeModal = () => {
    setIsEditModalOpen(false)
    setIsAddMode(false)
    setEditingShift(null)
    resetForm()
    setIsConfirmDialogOpen(false)
    setConfirmMessage('')
  }

  const handleSaveShift = async () => {
    if (!selectedSite || !validateForm()) return

    if (hasDuplicateShiftTemplate(selectedShifts, isAddMode, editingShift)) {
      alert('A similar shift template already exists for this site.')
      return
    }

    const preflight = await runPreflightCheck(editingShift)
    if (!preflight.ok) {
      alert(preflight.message)
      return
    }

    if (!isAddMode && (hasStructuralChanges(editingShift, selectedSite.id) || isActivatingShift(editingShift) || isDeactivatingShift(editingShift))) {
      setConfirmMessage(buildConfirmationMessage(editingShift, selectedSite.id))
      setIsConfirmDialogOpen(true)
      return
    }

    await saveAndReload()
  }

  const saveAndReload = async () => {
    if (!selectedSite) return
    const success = await saveShiftToDb(selectedSite.id, isAddMode, editingShift)
    if (success) {
      await reload()
      closeModal()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading shifts...</p>
      </div>
    )
  }

  return (
    <>
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
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-73px)] bg-slate-50">
        <SiteSidebar
          sites={sites}
          shifts={shifts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedSiteCode={selectedSiteCode}
          onSiteSelect={setSelectedSiteCode}
        />

        <ShiftTable
          site={selectedSite}
          shifts={selectedShifts}
          onAddShift={handleAddShift}
          onEditShift={handleEditShift}
        />
      </div>

      <ShiftFormModal
        open={isEditModalOpen}
        isAddMode={isAddMode}
        formValues={formValues}
        isLoading={saving}
        onFormChange={handleFormChange}
        onDayToggle={handleDayToggle}
        onSave={handleSaveShift}
        onCancel={closeModal}
      />

      <ConfirmDialog
        open={isConfirmDialogOpen}
        message={confirmMessage}
        isLoading={saving}
        onConfirm={saveAndReload}
        onCancel={() => {
          setIsConfirmDialogOpen(false)
          setConfirmMessage('')
        }}
      />
    </>
  )
}
