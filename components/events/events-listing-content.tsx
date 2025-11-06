"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, MapPin, Search, SlidersHorizontal, X } from "lucide-react"
import Link from "next/link"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"

const CATEGORIES = [
  "All",
  "Music",
  "Sports",
  "Arts",
  "Food",
  "Tech",
  "Business",
  "Health",
  "Education",
  "Community",
  "Other",
]

interface Event {
  id: string
  title: string
  description: string
  startAt: string
  endAt: string
  city: string
  country: string
  venueName?: string
  address?: string
  categories: string[]
  priceFree: boolean
  priceAmount?: number
  imageUrls: string[]
  status: string
}

export function EventsListingContent() {
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedPriceFilter, setSelectedPriceFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("date-asc")

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [events, selectedCategory, selectedPriceFilter, searchQuery, sortBy])

  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/events?status=PUBLISHED&limit=100")
      if (!response.ok) throw new Error("Failed to fetch events")
      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error("[v0] Error fetching events:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...events]

    // Category filter
    if (selectedCategory !== "All") {
      filtered = filtered.filter((event) => event.categories.includes(selectedCategory))
    }

    // Price filter
    if (selectedPriceFilter === "free") {
      filtered = filtered.filter((event) => event.priceFree)
    } else if (selectedPriceFilter === "paid") {
      filtered = filtered.filter((event) => !event.priceFree)
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.city.toLowerCase().includes(query) ||
          event.country.toLowerCase().includes(query) ||
          event.venueName?.toLowerCase().includes(query),
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        case "date-desc":
          return new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
        case "title-asc":
          return a.title.localeCompare(b.title)
        case "title-desc":
          return b.title.localeCompare(a.title)
        default:
          return 0
      }
    })

    setFilteredEvents(filtered)
  }

  const clearFilters = () => {
    setSelectedCategory("All")
    setSelectedPriceFilter("all")
    setSearchQuery("")
    setSortBy("date-asc")
  }

  const hasActiveFilters =
    selectedCategory !== "All" || selectedPriceFilter !== "all" || searchQuery.trim() !== "" || sortBy !== "date-asc"

  if (isLoading) {
    return <LoadingSpinner size="lg" className="py-12" />
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search events, cities, venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Category Filter */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price Filter */}
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Select value={selectedPriceFilter} onValueChange={setSelectedPriceFilter}>
                  <SelectTrigger id="price">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="free">Free Only</SelectItem>
                    <SelectItem value="paid">Paid Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="space-y-2">
                <Label htmlFor="sort">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-asc">Date (Earliest First)</SelectItem>
                    <SelectItem value="date-desc">Date (Latest First)</SelectItem>
                    <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                    <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full sm:w-auto bg-transparent">
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredEvents.length} of {events.length} events
        </p>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground mb-2">No events found</p>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or search query</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
              {event.imageUrls?.[0] && (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={event.imageUrls[0] || "/placeholder.svg"}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </div>
              )}

              <CardHeader className="flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  {event.priceFree && (
                    <Badge variant="secondary" className="text-xs">
                      Free
                    </Badge>
                  )}
                  {event.categories.slice(0, 2).map((cat) => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {cat}
                    </Badge>
                  ))}
                </div>

                <CardTitle className="line-clamp-2">
                  <Link href={`/events/${event.id}`} className="hover:underline">
                    {event.title}
                  </Link>
                </CardTitle>

                <CardDescription className="line-clamp-3">{event.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">
                        {new Date(event.startAt).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs">
                        {new Date(event.startAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      {event.venueName && <p className="font-medium text-foreground">{event.venueName}</p>}
                      <p className="text-xs">
                        {event.city}, {event.country}
                      </p>
                    </div>
                  </div>
                </div>

                <Button asChild className="w-full">
                  <Link href={`/events/${event.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
