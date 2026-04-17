'use client'

import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Something Went Wrong</h1>
        <p className="text-slate-600 mb-6">{error.message}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
          <Button onClick={() => reset()}>Try Again</Button>
        </div>
      </div>
    </div>
  )
}
