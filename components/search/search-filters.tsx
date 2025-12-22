"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Filter, X } from "lucide-react"
import { format } from "date-fns"

export interface SearchFilters {
  dateFrom?: Date
  dateTo?: Date
  categories?: string[]
  priceType?: "all" | "free" | "paid"
}

interface SearchFiltersProps {
  onFiltersChange: (filters: SearchFilters) => void
}

const CATEGORIES = [
  "Music",
  "Arts",
  "Sports",
  "Food & Drink",
  "Community",
  "Business",
  "Tech",
  "Education",
  "Health",
  "Other",
]

export function SearchFiltersComponent({ onFiltersChange }: SearchFiltersProps) {
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [priceType, setPriceType] = useState<"all" | "free" | "paid">("all")
  const [showFilters, setShowFilters] = useState(false)

  const applyFilters = () => {
    onFiltersChange({
      dateFrom,
      dateTo,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      priceType: priceType !== "all" ? priceType : undefined,
    })
  }

  const clearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setSelectedCategories([])
    setPriceType("all")
    onFiltersChange({})
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    )
  }

  const hasActiveFilters = dateFrom || dateTo || selectedCategories.length > 0 || priceType !== "all"

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2 min-h-[44px] active:scale-95" style={{ touchAction: 'manipulation' }}>
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
              {(dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + selectedCategories.length + (priceType !== "all" ? 1 : 0)}
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 min-h-[44px] active:scale-95" style={{ touchAction: 'manipulation' }}>
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="mt-4 p-4 border rounded-lg bg-card space-y-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <div className="flex gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <CalendarIcon className="h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <CalendarIcon className="h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    disabled={(date) => (dateFrom ? date < dateFrom : false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategories.includes(category) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Price</label>
            <Select value={priceType} onValueChange={(value: any) => setPriceType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="free">Free only</SelectItem>
                <SelectItem value="paid">Paid only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={applyFilters} className="w-full">
            Apply Filters
          </Button>
        </div>
      )}
    </div>
  )
}
