'use client'

import { useEffect, useState } from 'react'
import ManagerSidebar from '@/components/manager-sidebar'

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem('manager-sidebar-collapsed')
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [])

  if (!isMounted) return <div className="flex min-h-screen bg-slate-50" />

  return (
    <div className="flex min-h-screen bg-slate-50">
      <ManagerSidebar />
      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-14' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  )
}
