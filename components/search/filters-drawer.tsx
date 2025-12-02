"use client"

import type { SearchFilters, EventCategory } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"

interface FiltersDrawerProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
}

const CATEGORIES: EventCategory[] = ["market", "food", "music", "festival", "culture", "art", "exhibition", "workshop"]

export function FiltersDrawer({ filters, onFiltersChange }: FiltersDrawerProps) {
  const toggleCategory = (category: EventCategory) => {
    const current = filters.categories || []
    const updated = current.includes(category) ? current.filter((c) => c !== category) : [...current, category]
    onFiltersChange({ ...filters, categories: updated })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range */}
        <div className="space-y-3">
          <Label>Date Range</Label>
          <RadioGroup
            value={filters.dateRange || "all"}
            onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value as any })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="today" id="today" />
              <Label htmlFor="today" className="font-normal cursor-pointer">
                Today
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekend" id="weekend" />
              <Label htmlFor="weekend" className="font-normal cursor-pointer">
                This Weekend
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="month" id="month" />
              <Label htmlFor="month" className="font-normal cursor-pointer">
                This Month
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="font-normal cursor-pointer">
                All Upcoming
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <Label>Categories</Label>
          <div className="space-y-2">
            {CATEGORIES.map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={category}
                  checked={filters.categories?.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                />
                <Label htmlFor={category} className="font-normal capitalize cursor-pointer">
                  {category}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Price */}
        <div className="space-y-3">
          <Label>Price</Label>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="free"
              checked={filters.free}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, free: checked as boolean })}
            />
            <Label htmlFor="free" className="font-normal cursor-pointer">
              Free events only
            </Label>
          </div>
        </div>

        {/* Distance */}
        <div className="space-y-3">
          <Label>Distance (km)</Label>
          <Slider
            value={[filters.radiusKm || 100]}
            onValueChange={([value]) => onFiltersChange({ ...filters, radiusKm: value })}
            min={5}
            max={200}
            step={5}
          />
          <p className="text-sm text-muted-foreground">{filters.radiusKm || 100} km</p>
        </div>
      </CardContent>
    </Card>
  )
}
