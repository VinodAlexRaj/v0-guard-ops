'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, MapPin, Users, Calendar } from 'lucide-react'

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    { label: 'Overview', icon: BarChart3, href: '/manager/overview' },
    { label: 'All Sites', icon: MapPin, href: '/manager/sites' },
    { label: 'Supervisors', icon: Users, href: '/manager/supervisors' },
    { label: 'Shift Setup', icon: Calendar, href: '/manager/shifts' },
    { label: 'Guard Management', icon: Users, href: '/manager/guards' },
    { label: 'Leave Management', icon: Calendar, href: '/manager/leaves' },
    { label: 'Reports', icon: BarChart3, href: '/manager/reports' },
  ]

  const isActive = (href: string) => pathname === href

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
                  active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
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
