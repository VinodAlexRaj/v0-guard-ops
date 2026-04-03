'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, MapPin, Calendar, Users } from 'lucide-react'

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    { label: 'Overview', href: '/supervisor/overview', icon: BarChart3 },
    { label: 'My Sites', href: '/supervisor/sites', icon: MapPin },
    { label: 'Schedule', href: '/supervisor/sites/KLSNT01/schedule', icon: Calendar },
    { label: 'Attendance', href: '/supervisor/sites/KLSNT01/attendance', icon: Users },
    { label: 'Guards', href: '/supervisor/guards', icon: Users },
    { label: 'Leaves', href: '/supervisor/leaves', icon: Calendar },
  ]

  const isActive = (href: string) => {
    if (href === '/supervisor/overview') {
      return pathname === '/supervisor/overview'
    }
    if (href === '/supervisor/sites') {
      return pathname.startsWith('/supervisor/sites')
    }
    if (href === '/supervisor/guards') {
      return pathname === '/supervisor/guards'
    }
    if (href === '/supervisor/leaves') {
      return pathname === '/supervisor/leaves'
    }
    if (href.includes('/schedule')) {
      return pathname.includes('/schedule')
    }
    if (href.includes('/attendance')) {
      return pathname.includes('/attendance')
    }
    return false
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-white p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Guard Ops</h2>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1">{children}</main>
    </div>
  )
}
