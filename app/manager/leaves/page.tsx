'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LogOut, Check, X, RefreshCw } from 'lucide-react'

export default function ManagerLeavesPage() {
  const router = useRouter()
  const todayDate = new Date(2026, 3, 10)
  const dateStr = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [leaveRecords, setLeaveRecords] = useState([
    { id: 1, name: 'Nora Baharom', code: 'SO0001', type: 'AL', startDate: '10 Apr', endDate: '11 Apr', status: 'Approved' },
    { id: 2, name: 'Kamal Aizuddin', code: 'SO0091', type: 'MC', startDate: '12 Apr', endDate: '12 Apr', status: 'Approved' },
    { id: 3, name: 'Hafiz Daud', code: 'SO0033', type: 'EL', startDate: '13 Apr', endDate: '13 Apr', status: 'Approved' },
    { id: 4, name: 'Ahmad Razif', code: 'SO0042', type: 'AL', startDate: '20 Apr', endDate: '22 Apr', status: 'Pending' },
    { id: 5, name: 'Siti Norizan', code: 'SO0055', type: 'AL', startDate: '25 Apr', endDate: '25 Apr', status: 'Pending' },
    { id: 6, name: 'Rajan Muthu', code: 'SN0078', type: 'AL', startDate: '01 May', endDate: '03 May', status: 'Pending' },
    { id: 7, name: 'Lim Chee Hoe', code: 'SO0020', type: 'UL', startDate: '05 May', endDate: '05 May', status: 'Pending' },
    { id: 8, name: 'Mei Ling', code: 'SO0015', type: 'MC', startDate: '28 Apr', endDate: '28 Apr', status: 'Rejected' },
  ])

  const handleSignOut = () => {
    router.push('/')
  }

  const handleApprove = (id: number) => {
    setLeaveRecords(leaveRecords.map(r => r.id === id ? { ...r, status: 'Approved' } : r))
  }

  const handleReject = (id: number) => {
    setLeaveRecords(leaveRecords.map(r => r.id === id ? { ...r, status: 'Rejected' } : r))
  }

  const filteredRecords = leaveRecords.filter(record => {
    const matchSearch = record.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       record.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'All' || record.status === statusFilter
    const matchType = typeFilter === 'All' || record.type === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'AL': return 'bg-purple-100 text-purple-700'
      case 'MC': return 'bg-red-100 text-red-700'
      case 'EL': return 'bg-amber-100 text-amber-700'
      case 'UL': return 'bg-blue-100 text-blue-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Approved': return 'bg-green-100 text-green-700'
      case 'Pending': return 'bg-amber-100 text-amber-700'
      case 'Rejected': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <>
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">{dateStr}</div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">Vinod Alex Raj</p>
              <Badge variant="secondary" className="mt-1">
                Manager
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-slate-600 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Leave Management</h1>
          <p className="text-slate-600">Review and manage all leave requests</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex gap-4 items-center">
          <Input
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Filter Pills */}
        <div className="mb-6 flex gap-6">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Status:</span>
            <div className="flex gap-2">
              {['All', 'Approved', 'Pending', 'Rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    statusFilter === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Type:</span>
            <div className="flex gap-2">
              {['All', 'AL', 'MC', 'EL', 'UL'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    typeFilter === type
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leave Requests Table */}
        <Card className="border-slate-200 overflow-hidden mb-6">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Guard</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{record.name}</div>
                    <div className="text-xs text-slate-600">{record.code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`${getTypeColor(record.type)} border-0`}>
                      {record.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-900">
                      {record.startDate === record.endDate ? record.startDate : `${record.startDate} - ${record.endDate}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`${getStatusColor(record.status)} border-0`}>
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {record.status === 'Pending' ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(record.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReject(record.id)}
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Sync Section */}
        <Card className="border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Sync with leave system</p>
            <p className="text-xs text-slate-600">Last synced: 2 hours ago</p>
          </div>
          <Button
            disabled
            className="bg-slate-400 text-white hover:bg-slate-400"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync now
          </Button>
        </Card>
      </div>
    </>
  )
}
