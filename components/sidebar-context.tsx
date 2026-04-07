'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarContextValue {
  isCollapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  isCollapsed: false,
  toggle: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({
  children,
  storageKey,
}: {
  children: ReactNode
  storageKey: string
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem(storageKey)
    if (saved) setIsCollapsed(JSON.parse(saved))
  }, [storageKey])

  const toggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  if (!isMounted) return null

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}
