'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, MapPin, CalendarDays, ClipboardList, ShieldCheck, CalendarOff, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SupervisorSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem('supervisor-sidebar-collapsed')
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [])

  // Save collapsed state to localStorage
  const handleToggle = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('supervisor-sidebar-collapsed', JSON.stringify(newState))
  }

  const navItems = [
    { label: 'Overview', href: '/supervisor/overview', icon: LayoutDashboard },
    { label: 'My Sites', href: '/supervisor/sites', icon: MapPin },
    { label: 'Schedule', href: '/supervisor/sites/KLSNT01/schedule', icon: CalendarDays },
    { label: 'Attendance', href: '/supervisor/sites/KLSNT01/attendance', icon: ClipboardList },
    { label: 'Guards', href: '/supervisor/guards', icon: ShieldCheck },
    { label: 'Leaves', href: '/supervisor/leaves', icon: CalendarOff },
  ]

  const isActive = (href: string) => {
    if (href === '/supervisor/overview') {
      return pathname === '/supervisor/overview'
    }
    if (href === '/supervisor/sites') {
      return pathname.startsWith('/supervisor/sites') && !pathname.includes('/schedule') && !pathname.includes('/attendance')
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
                  ? 'bg-teal-50 text-teal-700'
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
