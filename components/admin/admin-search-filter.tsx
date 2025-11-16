'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface AdminSearchFilterProps {
  initialSearch: string
}

export function AdminSearchFilter({ initialSearch }: AdminSearchFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(initialSearch)

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      
      if (searchValue) {
        params.set('search', searchValue)
      } else {
        params.delete('search')
      }
      
      // Reset to page 1 when searching
      params.delete('page')
      
      // Preserve tab
      const newUrl = params.toString() ? `?${params.toString()}` : ''
      router.push(`/admin/events${newUrl}`)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue, router, searchParams])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search events…"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="pl-9 max-w-sm"
      />
    </div>
  )
}
