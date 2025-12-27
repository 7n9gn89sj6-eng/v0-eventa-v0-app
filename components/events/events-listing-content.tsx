"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Calendar, MapPin, SlidersHorizontal, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
import ClientOnly from "@/components/ClientOnly"
import { useI18n } from "@/lib/i18n/context"
import { SmartInputBar } from "@/components/search/smart-input-bar"

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
  aiStatus: string
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
  initialCity?: string
  initialCountry?: string
  initialCategory?: string
  initialDateFrom?: string
  initialDateTo?: string
  userLat?: number
  userLng?: number
}

export function EventsListingContent({
  initialQuery,
  initialCity,
  initialCountry,
  initialCategory,
  initialDateFrom,
  initialDateTo,
  userLat,
  userLng,
}: EventsListingContentProps) {
  const [q, setQ] = useState(initialQuery || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Event[]>([])
  const [total, setTotal] = useState(0)

  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || "All")
  const [selectedPriceFilter, setSelectedPriceFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date-asc")
  const [cityFilter, setCityFilter] = useState(initialCity || "")
  const [countryFilter, setCountryFilter] = useState(initialCountry || "")

  const router = useRouter()
  const { t } = useI18n()

  async function runSearch() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set("query", q)
      // CRITICAL: Always include location from location picker (cityFilter/countryFilter)
      // Do NOT rely on URL params - location must come from UI state
      if (cityFilter) params.set("city", cityFilter)
      if (countryFilter) params.set("country", countryFilter)
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory.toLowerCase())
      if (initialDateFrom) params.set("date_from", initialDateFrom)
      if (initialDateTo) params.set("date_to", initialDateTo)

      console.log("[v0] Fetching /api/search/events with params:", params.toString())

      const r = await fetch(`/api/search/events?${params.toString()}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `Search failed (${r.status})`)

      console.log("[v0] Search API response:", {
        internalCount: data.internal?.length || 0,
        externalCount: data.external?.length || 0,
        eventsCount: data.events?.length || 0,
        count: data.count,
        total: data.total,
        emptyState: data.emptyState,
        includesWeb: data.includesWeb,
        isEventIntent: data.isEventIntent,
        sampleExternal: data.external?.[0],
      })

      // Filter external results by city if city filter is active
      // External web search can return results from anywhere, so we filter client-side
      const filteredExternal = (data.external || []).filter((ext: any) => {
        if (!cityFilter || cityFilter.trim() === "") return true // No filter = show all
        const extCity = (ext.location?.city || ext.city || "").toLowerCase().trim()
        const filterCity = cityFilter.toLowerCase().trim()
        // Match if city field contains the filter city or vice versa (handles "Melbourne, Australia" vs "Melbourne")
        return extCity.includes(filterCity) || filterCity.includes(extCity) || extCity === ""
      })

      // PRIORITY: Internal events (user-created, curated) ALWAYS come FIRST
      // External web results come AFTER and are clearly marked
      // This ensures user satisfaction with accurate, curated events
      const allEvents = [
        // Internal events first (user-created, curated, accurate)
        ...(data.internal || []).map((int: any) => ({
          ...int,
          source: int.source || "internal" as const,
          isEventaEvent: true, // Mark as Eventa event for UI
        })),
        // External web results second (informational, may need verification) - filtered by city
        ...filteredExternal.map((ext: any) => ({
          id: ext.id,
          title: ext.title,
          description: ext.description,
          startAt: ext.startAt,
          endAt: ext.endAt,
          city: ext.location?.city || ext.city || "",
          country: ext.location?.country || ext.country || "",
          address: ext.location?.address || ext.address || "",
          venueName: ext.location?.address || ext.venueName || "",
          categories: ext.categories || [],
          priceFree: ext.priceFree || false,
          imageUrls: ext.imageUrl ? [ext.imageUrl] : (ext.imageUrls || []),
          status: "PUBLISHED",
          aiStatus: "SAFE",
          source: ext.source || "web" as const,
          isWebResult: true, // Mark as web result for UI
          imageUrl: ext.imageUrl,
          externalUrl: ext.externalUrl || ext.url,
        })),
      ]

      console.log("[v0] Combined events:", {
        totalEvents: allEvents.length,
        internalEvents: data.internal?.length || 0,
        externalEventsBeforeFilter: data.external?.length || 0,
        externalEventsAfterFilter: filteredExternal.length,
        cityFilter: cityFilter || "none",
        firstEvent: allEvents[0],
      })

      setResults(allEvents)
      setTotal(data.count ?? allEvents.length)

      if (q.trim()) {
        router.push(`/discover?q=${encodeURIComponent(q)}`, { scroll: false })
      }
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Search failed")
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Sync state with props when they change (URL params updated)
  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== q) {
      setQ(initialQuery)
    }
  }, [initialQuery])

  useEffect(() => {
    if (initialCity !== undefined && initialCity !== cityFilter) {
      setCityFilter(initialCity)
    }
  }, [initialCity])

  useEffect(() => {
    if (initialCountry !== undefined && initialCountry !== countryFilter) {
      setCountryFilter(initialCountry)
    }
  }, [initialCountry])

  useEffect(() => {
    runSearch()
  }, [q, cityFilter, countryFilter, selectedCategory, initialDateFrom, initialDateTo])

  const handleSmartSearch = async (query: string) => {
    setQ(query)
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("query", query)
      if (cityFilter) params.set("city", cityFilter)
      if (countryFilter) params.set("country", countryFilter)

      const r = await fetch(`/api/search/events?${params.toString()}`, {
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
          aiStatus: "SAFE",
          source: ext.source,
          imageUrl: ext.imageUrl,
          externalUrl: ext.externalUrl,
        })),
      ]

      setResults(allEvents)
      setTotal(data.count ?? 0)

      router.push(`/discover?q=${encodeURIComponent(query)}`, { scroll: false })
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Search failed")
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

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
    setCityFilter("")
  }

  const hasActiveFilters =
    selectedCategory !== "All" ||
    selectedPriceFilter !== "all" ||
    q.trim() !== "" ||
    sortBy !== "date-asc" ||
    cityFilter !== ""

  const tEvents = t("events")
  const showingText = (tEvents("results.showing") || "Showing {filtered} of {total} events")
    .replace("{filtered}", filteredResults.length.toString())
    .replace("{total}", results.length.toString())

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <SmartInputBar
          onSearch={handleSmartSearch}
          initialQuery={initialQuery}
          alwaysShowSuggestions={true}
          onError={(error) => setError(error)}
        />
      </div>

      {(cityFilter || (selectedCategory && selectedCategory !== "All") || initialDateFrom) && (
        <div className="flex flex-wrap gap-2">
          {cityFilter && (
            <Badge variant="secondary" className="gap-1.5 pl-2 pr-1.5">
              <MapPin className="h-3 w-3" />
              <span>{cityFilter}</span>
              <button onClick={() => setCityFilter("")} className="ml-0.5 rounded-sm hover:bg-secondary-foreground/20">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {selectedCategory && selectedCategory !== "All" && (
            <Badge variant="secondary" className="gap-1.5 pl-2 pr-1.5">
              <span>{selectedCategory}</span>
              <button
                onClick={() => setSelectedCategory("All")}
                className="ml-0.5 rounded-sm hover:bg-secondary-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {initialDateFrom && (
            <Badge variant="secondary" className="gap-1.5 pl-2 pr-1.5">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(initialDateFrom).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </Badge>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              <CardTitle>{tEvents("filters.title")}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? tEvents("filters.hide") : tEvents("filters.show")}
            </Button>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="category">{tEvents("filters.category")}</Label>
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

              <div className="space-y-2">
                <Label htmlFor="price">{tEvents("filters.price")}</Label>
                <Select value={selectedPriceFilter} onValueChange={setSelectedPriceFilter}>
                  <SelectTrigger id="price">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tEvents("priceOptions.all")}</SelectItem>
                    <SelectItem value="free">{tEvents("priceOptions.free")}</SelectItem>
                    <SelectItem value="paid">{tEvents("priceOptions.paid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort">{tEvents("filters.sortBy")}</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-asc">{tEvents("sortOptions.dateAsc")}</SelectItem>
                    <SelectItem value="date-desc">{tEvents("sortOptions.dateDesc")}</SelectItem>
                    <SelectItem value="title-asc">{tEvents("sortOptions.titleAsc")}</SelectItem>
                    <SelectItem value="title-desc">{tEvents("sortOptions.titleDesc")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full sm:w-auto bg-transparent">
                <X className="h-4 w-4 mr-2" />
                {tEvents("filters.clearFilters")}
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{showingText}</p>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : filteredResults.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            {cityFilter ? (
              <>
                <p className="text-lg font-medium text-foreground">
                  No events found in {cityFilter}{countryFilter ? `, ${countryFilter}` : ""} right now
                </p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Try expanding your search area, changing dates, or searching another city.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg text-muted-foreground mb-2">{tEvents("results.noEvents")}</p>
                <p className="text-sm text-muted-foreground mb-4">{tEvents("results.noEventsHint")}</p>
              </>
            )}
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                {tEvents("filters.clearFilters")}
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
                        {tEvents("card.free")}
                      </Badge>
                    )}
                    {event.isEventaEvent && (
                      <Badge variant="default" className="text-xs bg-primary">
                        Eventa Event
                      </Badge>
                    )}
                    {event.isWebResult && (
                      <Badge variant="secondary" className="text-xs">
                        Web Result
                      </Badge>
                    )}
                    {event.source && !event.isEventaEvent && !event.isWebResult && (
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
                  {/* Location - date removed from listing cards per user request */}
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

                  {event.externalUrl ? (
                    <Button asChild className="w-full">
                      <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                        {tEvents("card.viewOn").replace("{source}", event.source || "External Site")}
                      </a>
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link href={`/events/${event.id}`}>{tEvents("card.viewDetails")}</Link>
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
