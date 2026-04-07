'use client'

import ManagerSidebar from '@/components/manager-sidebar'
import { SidebarProvider } from '@/components/sidebar-context'

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider storageKey="manager-sidebar-collapsed">
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <ManagerSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
