'use client'

import { useEffect, useState } from 'react'
import SupervisorSidebar from '@/components/supervisor-sidebar'

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem('supervisor-sidebar-collapsed')
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [])

  if (!isMounted) return <div className="flex min-h-screen bg-slate-50" />

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SupervisorSidebar />
      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-14' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  )
}
