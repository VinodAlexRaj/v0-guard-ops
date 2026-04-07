'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Building2, Users, CalendarClock, ShieldCheck, CalendarOff, BarChart3, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ManagerSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem('manager-sidebar-collapsed')
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [])

  // Save collapsed state to localStorage
  const handleToggle = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('manager-sidebar-collapsed', JSON.stringify(newState))
  }

  const navItems = [
    { label: 'Overview', href: '/manager/overview', icon: LayoutDashboard },
    { label: 'All Sites', href: '/manager/sites', icon: Building2 },
    { label: 'Supervisors', href: '/manager/supervisors', icon: Users },
    { label: 'Shift Setup', href: '/manager/shifts', icon: CalendarClock },
    { label: 'Guard Management', href: '/manager/guards', icon: ShieldCheck },
    { label: 'Leave Management', href: '/manager/leaves', icon: CalendarOff },
    { label: 'Reports', href: '/manager/reports', icon: BarChart3 },
  ]

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  if (!isMounted) return null

  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <aside className={`fixed left-0 top-0 h-screen border-r border-slate-200 bg-white transition-all duration-300 ease-in-out ${
      isCollapsed ? 'w-14' : 'w-64'
    }`}>
      {/* Toggle Button */}
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="w-full flex justify-center"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <ToggleIcon className="w-5 h-5" />
        </Button>
      </div>

      {/* Logo */}
      {!isCollapsed && (
        <div className="px-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Guard Ops</h2>
        </div>
      )}

      {/* Navigation */}
      <nav className={`space-y-2 px-3 ${isCollapsed ? '' : 'px-6'}`}>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isCollapsed ? 'justify-center' : ''
              } ${
                active
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
