'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, MapPin, Users, Calendar } from 'lucide-react'

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    { label: 'Overview', icon: BarChart3, href: '/supervisor/overview' },
    { label: 'My Sites', icon: MapPin, href: '/supervisor/sites' },
    { label: 'Schedule', icon: Calendar, href: '/supervisor/sites/KLSNT01/schedule' },
    { label: 'Attendance', icon: Users, href: '/supervisor/sites/KLSNT01/attendance' },
    { label: 'Guards', icon: Users, href: '/supervisor/guards' },
    { label: 'Leaves', icon: Calendar, href: '/supervisor/leaves' },
  ]

  const isActive = (href: string) => {
    if (href === '/supervisor/overview') return pathname === '/supervisor/overview'
    return pathname.startsWith(href.split('/').slice(0, 3).join('/'))
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
                  active ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
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
