'use client'

import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, BarChart3, MapPin, Users, Calendar } from 'lucide-react'

export default function SchedulePage() {
  const router = useRouter()
  const params = useParams()
  const siteId = params.siteId as string

  const handleSignOut = () => {
    router.push('/')
  }

  const siteNames: Record<string, string> = {
    'KLSNT01': 'Sentral Tower',
  }

  const siteName = siteNames[siteId] || 'Site'

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-white p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Guard Ops</h2>
        </div>
        <nav className="space-y-2">
          {[
            { label: 'Overview', icon: BarChart3, active: false },
            { label: 'My Sites', icon: MapPin, active: false },
            { label: 'Schedule', icon: Calendar, active: true },
            { label: 'Attendance', icon: Users, active: false },
            { label: 'Guards', icon: Users, active: false },
            { label: 'Leaves', icon: Calendar, active: false },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition ${
                item.active
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1">
        {/* Top Navigation */}
        <header className="border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Schedule Management</div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">Azri Hamdan</p>
                <Badge variant="secondary" className="mt-1">
                  Supervisor
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
          <Card className="border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{siteName}</h2>
            <p className="text-slate-600 mb-6">Site Code: {siteId}</p>
            <p className="text-slate-700">Schedule management page for {siteName}</p>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="mt-6"
            >
              Back
            </Button>
          </Card>
        </div>
      </main>
    </div>
  )
}
