'use client'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Site, Shift } from '../hooks/useShiftsData'

interface SiteSidebarProps {
  sites: Site[]
  shifts: Shift[]
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedSiteCode: string
  onSiteSelect: (siteCode: string) => void
}

export function SiteSidebar({
  sites,
  shifts,
  searchQuery,
  onSearchChange,
  selectedSiteCode,
  onSiteSelect,
}: SiteSidebarProps) {
  const filteredSites = sites.filter(
    (site) =>
      site.site_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-[320px] border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Sites</h3>
        <Input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="space-y-1 p-2">
        {filteredSites.map((site) => {
          const siteShifts = shifts.filter((s) => s.site_id === site.id)
          const totalCount = siteShifts.length
          const activeCount = siteShifts.filter((s) => s.is_active).length

          return (
            <button
              type="button"
              key={site.id}
              onClick={() => onSiteSelect(site.site_code)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                selectedSiteCode === site.site_code
                  ? 'bg-teal-50 font-medium text-teal-900'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{site.site_code}</div>
                  <div className="text-xs text-slate-500">{site.name}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {activeCount} active / {totalCount} total
                  </div>
                </div>
                <Badge variant="secondary">
                  {activeCount}/{totalCount}
                </Badge>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
