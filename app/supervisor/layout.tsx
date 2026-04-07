'use client'

import SupervisorSidebar from '@/components/supervisor-sidebar'
import { SidebarProvider } from '@/components/sidebar-context'

export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider storageKey="supervisor-sidebar-collapsed">
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <SupervisorSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
