'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, MapPin, Calendar, Users } from 'lucide-react'

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    { label: 'Overview', href: '/manager/overview', icon: BarChart3 },
    { label: 'All Sites', href: '/manager/sites', icon: MapPin },
    { label: 'Supervisors', href: '/manager/supervisors', icon: Users },
    { label: 'Shift Setup', href: '/manager/shifts', icon: Calendar },
    { label: 'Guard Management', href: '/manager/guards', icon: Users },
    { label: 'Leave Management', href: '/manager/leaves', icon: Calendar },
    { label: 'Reports', href: '/manager/reports', icon: BarChart3 },
  ]

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
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
                    ? 'bg-slate-100 text-slate-900'
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
