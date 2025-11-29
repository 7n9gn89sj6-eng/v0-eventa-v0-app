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

/**
 * Basic category list – kept simple and UI-focused.
 */
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

/**
 * Multilingual city synonyms map.
 * Key = canonical city name (what we send to API)
 * Value = array of possible spellings in different languages.
 */
const CITY_SYNONYMS: Record<string, string[]> = {
  Athens: ["athens", "athina", "athína", "αθήνα"],
  Thessaloniki: ["thessaloniki", "salonika", "σαλονίκη", "θεσσαλονίκη"],
  Patras: ["patras", "patra", "πάτρα"],
  Rome: ["rome", "roma"],
  Milan: ["milan", "milano"],
  Naples: ["naples", "napoli"],
  Florence: ["florence", "firenze"],
  Venice: ["venice", "venezia"],
  Paris: ["paris", "παρίσι"],
  Lyon: ["lyon"],
  Barcelona: ["barcelona", "barça", "barca"],
  Madrid: ["madrid"],
  Berlin: ["berlin", "berlín"],
  Munich: ["munich", "münchen"],
  London: ["london", "londres"],
  Dublin: ["dublin"],
  NewYork: ["new york", "nyc", "new york city"],
  Sydney: ["sydney"],
  Melbourne: ["melbourne"],
}

/**
 * Extract a canonical city name from free-text query (T2 behaviour).
 * Returns the detected city and the remaining text to use as keyword query.
 */
function extractCityFromQuery(query: string): { city?: string; remainingQuery: string } {
  const text = query.toLowerCase()
  let detectedCity: string | undefined
  let remaining = text

  for (const [canonical, forms] of Object.entries(CITY_SYNONYMS)) {
    for (const form of forms) {
      // match whole word or phrase
      const pattern = new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
      if (pattern.test(text)) {
        detectedCity = canonical
        remaining = text.replace(pattern, " ").replace(/\s+/g, " ").trim()
        break
      }
    }
    if (detectedCity) break
  }

  return {
    city: detectedCity,
    remainingQuery: remaining || query, // fall back to original if empty
  }
}

/**
 * Simple distance (km) using Haversine formula.
 */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

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
    lat?: number
    lng?: number
  }
  imageUrl?: string
  externalUrl?: string
  lat?: number
  lng?: number
}

interface EventsListingContentProps {
  initialQuery?: string
  initialCity?: string
  initialCategory?: string
  initialDateFrom?: string
  initialDateTo?: string
  userLat?: number
  userLng?: number
}

export function EventsListingContent({
  initialQuery,
  initialCity,
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

  const router = useRouter()
  const { t } = useI18n()
  const tEvents = t("events")

  // “Near me” mode = no explicit query/city, but coordinates are known
  const hasCoords = userLat !== undefined && userLat !== null && userLng !== undefined && userLng !== null
  const isLocalSearch = !q.trim() && !cityFilter && hasCoords

  /**
   * Build search params with smart city extraction (T2 hybrid).
   * - If user already picked a cityFilter, we respect it.
   * - If not, we try to detect a city from the query.
   */
  function buildSearchParams(rawQuery: string) {
    let effectiveQuery = rawQuery.trim()
    let effectiveCity = cityFilter

    if (!effectiveCity && effectiveQuery) {
      const { city, remainingQuery } = extractCityFromQuery(effectiveQuery)
      if (city) {
        effectiveCity = city
        effectiveQuery = remainingQuery
        setCityFilter(city) // update chip in UI
      }
    }

    const params = new URLSearchParams()
    if (effectiveQuery) params.set("query", effectiveQuery)
    if (effectiveCity) params.set("city", effectiveCity)

    if (selectedCategory && selectedCategory !== "All") {
      params.set("category", selectedCategory.toLowerCase())
    }
    if (initialDateFrom) params.set("date_from", initialDateFrom)
    if (initialDateTo) params.set("date_to", initialDateTo)

    if (hasCoords) {
      params.set("lat", String(userLat))
      params.set("lng", String(userLng))
    }

    return { params, effectiveQuery, effectiveCity }
  }

  async function runSearch() {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const { params } = buildSearchParams(q)
      console.log("[v0] Searching with params:", params.toString())

      const r = await fetch(`/api/search/events?${params.toString()}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `Search failed (${r.status})`)

      const internalEvents: Event[] = (data.internal || []) as Event[]
      const externalEvents: Event[] = (data.external || []).map((ext: any) => ({
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
        source: ext.source || "web",
        imageUrl: ext.imageUrl,
        externalUrl: ext.externalUrl,
        lat: ext.location?.lat,
        lng: ext.location?.lng,
      }))

      // COMMUNITY FIRST: internal events always before external ones
      const allEvents = [...internalEvents, ...externalEvents]

      setResults(allEvents)
      setTotal(data.total ?? data.count ?? allEvents.length)

      // Keep URL meaningful but uncluttered
      const urlParams = new URLSearchParams()
      if (q.trim()) urlParams.set("q", q.trim())
      if (cityFilter) urlParams.set("city", cityFilter)
      if (selectedCategory && selectedCategory !== "All") urlParams.set("category", selectedCategory.toLowerCase())
      if (initialDateFrom) urlParams.set("date_from", initialDateFrom)
      if (initialDateTo) urlParams.set("date_to", initialDateTo)
      if (hasCoords) {
        urlParams.set("lat", String(userLat))
        urlParams.set("lng", String(userLng))
      }

      router.push(`/discover?${urlParams.toString()}`, { scroll: false })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter, selectedCategory, initialDateFrom, initialDateTo])

  /**
   * SmartInputBar callback – we treat this as “user intent changed”.
   * We reuse the same buildSearchParams logic so behaviour is consistent.
   */
  const handleSmartSearch = async (query: string) => {
    setQ(query)
    setLoading(true)
    setError(null)

    try {
      const { params } = buildSearchParams(query)

      const r = await fetch(`/api/search/events?${params.toString()}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || `Search failed (${r.status})`)

      const internalEvents: Event[] = (data.internal || []) as Event[]
      const externalEvents: Event[] = (data.external || []).map((ext: any) => ({
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
        source: ext.source || "web",
        imageUrl: ext.imageUrl,
        externalUrl: ext.externalUrl,
        lat: ext.location?.lat,
        lng: ext.location?.lng,
      }))

      const allEvents = [...internalEvents, ...externalEvents]

      setResults(allEvents)
      setTotal(data.total ?? data.count ?? allEvents.length)

      const urlParams = new URLSearchParams()
      if (query.trim()) urlParams.set("q", query.trim())
      if (cityFilter) urlParams.set("city", cityFilter)
      if (hasCoords) {
        urlParams.set("lat", String(userLat))
        urlParams.set("lng", String(userLng))
      }

      router.push(`/discover?${urlParams.toString()}`, { scroll: false })
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Search failed")
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Apply filters + smart ordering on the client:
   * - community events first
   * - if local search and we have coordinates, sort by distance
   * - otherwise sort by chosen “sortBy”
   */
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
      // 1) Community vs external
      const isExternalA = !!a.source && a.source !== "internal"
      const isExternalB = !!b.source && b.source !== "internal"
      if (isExternalA !== isExternalB) {
        return isExternalA ? 1 : -1
      }

      // 2) If we’re in local search and both have coords, sort by distance
      if (isLocalSearch && hasCoords) {
        const lat1 = a.lat ?? a.location?.lat
        const lng1 = a.lng ?? a.location?.lng
        const lat2 = b.lat ?? b.location?.lat
        const lng2 = b.lng ?? b.location?.lng

        if (lat1 != null && lng1 != null && lat2 != null && lng2 != null) {
          const d1 = distanceKm(userLat!, userLng!, lat1, lng1)
          const d2 = distanceKm(userLat!, userLng!, lat2, lng2)
          if (d1 !== d2) return d1 - d2
        } else if (lat1 != null && lng1 != null) {
          // events with known distance come first
          return -1
        } else if (lat2 != null && lng2 != null) {
          return 1
        }
      }

      // 3) Fallback: sort by chosen field
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
        {isLocalSearch && (
          <p className="text-xs text-muted-foreground">
            Showing events near your current location (community events first).
          </p>
        )}
      </div>

      {loading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : filteredResults.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground mb-2">{tEvents("results.noEvents")}</p>
            <p className="text-sm text-muted-foreground mb-4">{tEvents("results.noEventsHint")}</p>
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
