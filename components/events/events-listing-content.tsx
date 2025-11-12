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
import ClientOnly from "@/components/ClientOnly"

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
  source?: string
  location?: {
    address?: string
    city?: string
    country?: string
  }
  imageUrl?: string
  externalUrl?: string
}

interface EventsListingContentProps {
  initialQuery?: string
}

export function EventsListingContent({ initialQuery }: EventsListingContentProps) {
  const [q, setQ] = useState(initialQuery || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Event[]>([])
  const [total, setTotal] = useState(0)

  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedPriceFilter, setSelectedPriceFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date-asc")

  async function runSearch() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/search/events?query=${encodeURIComponent(q)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `Search failed (${r.status})`)

      const allEvents = [
        ...(data.internal || []),
        ...(data.external || []).map((ext: any) => ({
          id: ext.id,
          title: ext.title,
          description: ext.description,
          startAt: ext.startAt,
          endAt: ext.endAt,
          city: ext.location?.city || "",
          country: ext.location?.country || "",
          address: ext.location?.address || "",
          venueName: ext.location?.address || "",
          categories: [],
          priceFree: false,
          imageUrls: ext.imageUrl ? [ext.imageUrl] : [],
          status: "PUBLISHED",
          source: ext.source,
          imageUrl: ext.imageUrl,
          externalUrl: ext.externalUrl,
        })),
      ]

      setResults(allEvents)
      setTotal(data.count ?? 0)
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Search failed")
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runSearch()
  }, [])

  const filteredResults = results
    .filter((event) => {
      if (selectedCategory !== "All" && !event.categories?.includes(selectedCategory)) {
        return false
      }
      if (selectedPriceFilter === "free" && !event.priceFree) {
        return false
      }
      if (selectedPriceFilter === "paid" && event.priceFree) {
        return false
      }
      return true
    })
    .sort((a, b) => {
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

  const clearFilters = () => {
    setSelectedCategory("All")
    setSelectedPriceFilter("all")
    setQ("")
    setSortBy("date-asc")
  }

  const hasActiveFilters =
    selectedCategory !== "All" || selectedPriceFilter !== "all" || q.trim() !== "" || sortBy !== "date-asc"

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              <CardTitle>Search & Filters</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search events, cities, venues..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch()
                    }}
                    className="pl-9"
                    aria-label="Search events"
                  />
                </div>
                <Button onClick={runSearch} disabled={loading}>
                  {loading ? "Processing…" : "Go"}
                </Button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!error && !loading && results.length === 0 && q.trim() && (
                <p className="text-sm opacity-70">No results found.</p>
              )}
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
          Showing {filteredResults.length} of {results.length} events
        </p>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : filteredResults.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground mb-2">No events found</p>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filters</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredResults.map((event) => {
            const eventCity = event.city || event.location?.city || ""
            const eventCountry = event.country || event.location?.country || ""
            const eventImageUrl = event.imageUrls?.[0] || event.imageUrl || "/placeholder.svg"

            return (
              <Card key={event.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={eventImageUrl || "/placeholder.svg"}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </div>

                <CardHeader className="flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {event.priceFree && (
                      <Badge variant="secondary" className="text-xs">
                        Free
                      </Badge>
                    )}
                    {event.source && (
                      <Badge variant="outline" className="text-xs">
                        {event.source}
                      </Badge>
                    )}
                    {event.categories?.slice(0, 2).map((cat) => (
                      <Badge key={cat} variant="outline" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>

                  <CardTitle className="line-clamp-2">
                    {event.externalUrl ? (
                      <a href={event.externalUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {event.title}
                      </a>
                    ) : (
                      <Link href={`/events/${event.id}`} className="hover:underline">
                        {event.title}
                      </Link>
                    )}
                  </CardTitle>

                  <CardDescription className="line-clamp-3">{event.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                      <ClientOnly
                        placeholder={
                          <div>
                            <p className="font-medium text-foreground">—</p>
                            <p className="text-xs">—</p>
                          </div>
                        }
                      >
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
                      </ClientOnly>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        {event.venueName && <p className="font-medium text-foreground">{event.venueName}</p>}
                        <p className="text-xs">
                          {eventCity}
                          {eventCity && eventCountry ? ", " : ""}
                          {eventCountry}
                        </p>
                      </div>
                    </div>
                  </div>

                  {event.externalUrl ? (
                    <Button asChild className="w-full">
                      <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                        View on {event.source || "External Site"}
                      </a>
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link href={`/events/${event.id}`}>View Details</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
