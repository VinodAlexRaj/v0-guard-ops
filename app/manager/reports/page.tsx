'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut } from 'lucide-react'

export default function ManagerReportsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'coverage' | 'attendance' | 'leave'>('coverage')

  const todayDate = new Date(2026, 3, 10)
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

  const handleSignOut = () => {
    router.push('/')
  }

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

      {/* Page Content */}
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Reports</h1>
          <p className="text-slate-600">Coverage, attendance and leave analytics</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('coverage')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'coverage'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Coverage
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'attendance'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'leave'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Leave
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'coverage' && (
            <p className="text-slate-600">Coverage content</p>
          )}
          {activeTab === 'attendance' && (
            <p className="text-slate-600">Attendance content</p>
          )}
          {activeTab === 'leave' && (
            <p className="text-slate-600">Leave content</p>
          )}
        </div>
      </div>
    </>
  )
}
