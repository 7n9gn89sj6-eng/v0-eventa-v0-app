"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Calendar, MapPin, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
import ClientOnly from "@/components/ClientOnly"
import { useI18n } from "@/lib/i18n/context"
import { SmartInputBar } from "@/components/search/smart-input-bar"
import { PlaceAutocomplete } from "@/components/places/place-autocomplete"

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
}

type InterpretationSnapshot = {
  source: "query" | "ui" | "device"
  city: string | null
  country: string | null
}

function normalizeInterpretationSnapshot(data: {
  effectiveLocation?: {
    city?: string | null
    country?: string | null
    source?: string
  }
}): InterpretationSnapshot {
  const el = data?.effectiveLocation
  const src = el?.source
  const source: InterpretationSnapshot["source"] =
    src === "query" || src === "ui" || src === "device" ? src : "device"
  const city =
    typeof el?.city === "string" && el.city.trim() ? el.city.trim() : null
  const country =
    typeof el?.country === "string" && el.country.trim() ? el.country.trim() : null
  return { source, city, country }
}

type AiSuggestionFromApi = { displayLabel: string; confidence?: number }

function extractAiSuggestionFacet(data: unknown): AiSuggestionFromApi | null {
  const raw = (data as { phase1Interpretation?: unknown })?.phase1Interpretation
  if (!raw || typeof raw !== "object") return null
  const facets = (raw as { facets?: unknown }).facets
  if (!Array.isArray(facets)) return null
  const facet = facets.find(
    (f): f is { kind: string; displayLabel?: string; confidence?: number } =>
      Boolean(f && typeof f === "object" && (f as { kind?: string }).kind === "ai_suggestion"),
  )
  if (!facet || typeof facet.displayLabel !== "string") return null
  return {
    displayLabel: facet.displayLabel,
    confidence: typeof facet.confidence === "number" ? facet.confidence : undefined,
  }
}

export function EventsListingContent({
  initialQuery,
  initialCity,
  initialCountry,
  initialCategory,
  initialDateFrom,
  initialDateTo,
}: EventsListingContentProps) {
  const router = useRouter()
  const { t } = useI18n()
  const didInitUrlSync = useRef(false)
  const searchBarWrapRef = useRef<HTMLDivElement>(null)
  const placeFieldWrapRef = useRef<HTMLDivElement>(null)

  const [q, setQ] = useState(initialQuery || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interpretationSnapshot, setInterpretationSnapshot] = useState<InterpretationSnapshot | null>(null)
  const [aiSuggestionChip, setAiSuggestionChip] = useState<AiSuggestionFromApi | null>(null)
  const [results, setResults] = useState<Event[]>([])
  const [total, setTotal] = useState(0)

  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || "All")
  const [selectedPriceFilter, setSelectedPriceFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date-asc")
  // Discover location SSOT: URL only (synced via cityFilter / countryFilter).
  const [cityFilter, setCityFilter] = useState(() => initialCity ?? "")
  const [countryFilter, setCountryFilter] = useState(() => initialCountry ?? "")

  async function runSearch() {
    if (loading) return
    setLoading(true)
    setError(null)
    setAiSuggestionChip(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set("query", q)
      if (cityFilter.trim()) params.set("city", cityFilter.trim())
      if (countryFilter.trim()) params.set("country", countryFilter.trim())

      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory.toLowerCase())
      if (initialDateFrom) params.set("date_from", initialDateFrom)
      if (initialDateTo) params.set("date_to", initialDateTo)

      // Locality Contract A: Always send full context (q/city/country/date_from/date_to/category)
      if (process.env.NODE_ENV !== "production") {
        console.log("[v0] Search API params:", {
          q: params.get("query") || params.get("q"),
          city: params.get("city"),
          country: params.get("country"),
          date_from: params.get("date_from"),
          date_to: params.get("date_to"),
          category: params.get("category"),
        })
      }
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

      // Prefer API execution city (includes ambient suburb→metro widening). Fall back to UI picker when absent.
      const apiExecutionCity = data?.effectiveLocation?.city?.trim() || ""
      const externalCityFilter = apiExecutionCity || cityFilter

      // Filter external results by city if city filter is active (non-web only).
      // Web rows are locality-gated on the server; per-row city is not authoritative for CSE hits.
      const filteredExternal = (data.external || []).filter((ext: any) => {
        if (!externalCityFilter || externalCityFilter.trim() === "") return true
        const isWeb = ext.source === "web" || ext.isWebResult
        if (isWeb) return true
        const extCity = (ext.location?.city || ext.city || "").toLowerCase().trim()
        const filterCity = externalCityFilter.toLowerCase().trim()
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
      setInterpretationSnapshot(normalizeInterpretationSnapshot(data))
      setAiSuggestionChip(extractAiSuggestionFacet(data))
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Search failed")
      setResults([])
      setTotal(0)
      setInterpretationSnapshot(null)
      setAiSuggestionChip(null)
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
    setSelectedCategory(initialCategory || "All")
  }, [initialCategory])

  useEffect(() => {
    setCityFilter(initialCity ?? "")
  }, [initialCity])

  useEffect(() => {
    setCountryFilter(initialCountry ?? "")
  }, [initialCountry])

  useEffect(() => {
    setSelectedPriceFilter("all")
  }, [initialQuery])

  useEffect(() => {
    setSelectedPriceFilter("all")
  }, [selectedCategory])

  useEffect(() => {
    runSearch()
  }, [q, cityFilter, countryFilter, selectedCategory, initialDateFrom, initialDateTo])

  // Mobile + desktop consistency: keep `q`, `city`, and `category` synchronized with the URL.
  useEffect(() => {
    if (typeof window === "undefined") return

    // Skip the very first run to avoid fighting the initial server-rendered URL.
    if (!didInitUrlSync.current) {
      didInitUrlSync.current = true
      return
    }

    const params = new URLSearchParams()
    const trimmedQuery = q.trim()
    if (trimmedQuery) params.set("q", trimmedQuery)

    if (cityFilter.trim()) params.set("city", cityFilter.trim())
    if (countryFilter.trim()) params.set("country", countryFilter.trim())

    if (selectedCategory && selectedCategory !== "All") {
      params.set("category", selectedCategory.toLowerCase())
    }

    if (initialDateFrom) params.set("date_from", initialDateFrom)
    if (initialDateTo) params.set("date_to", initialDateTo)

    const nextSearch = params.toString()
    const currentSearch = window.location.search.replace(/^\?/, "")
    if (currentSearch !== nextSearch) {
      router.replace(`/discover?${nextSearch}`, { scroll: false })
    }
  }, [
    q,
    cityFilter,
    countryFilter,
    selectedCategory,
    initialDateFrom,
    initialDateTo,
    router,
  ])

  const handleSmartSearch = (query: string) => {
    setError(null)
    setQ(query)
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
      // Always rank internal Eventa events before external/web results
      const aPriority = a.isEventaEvent ? 0 : 1
      const bPriority = b.isEventaEvent ? 0 : 1
      if (aPriority !== bPriority) return aPriority - bPriority

      // Then apply existing sortBy logic
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
    setCountryFilter("")
  }

  const hasActiveFilters =
    selectedCategory !== "All" ||
    selectedPriceFilter !== "all" ||
    q.trim() !== "" ||
    sortBy !== "date-asc" ||
    cityFilter !== "" ||
    countryFilter !== ""

  const tEvents = t("events")
  const tStrip = (key: string, vars?: Record<string, string | number>) =>
    tEvents(`interpretationStrip.${key}`, vars ?? {})

  const focusDiscoverSearchInput = useCallback(() => {
    const input = searchBarWrapRef.current?.querySelector<HTMLInputElement>("input")
    input?.focus()
    if (input && typeof input.setSelectionRange === "function") {
      const len = input.value.length
      input.setSelectionRange(len, len)
    }
    searchBarWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [])

  const openDiscoverPlaceField = useCallback(() => {
    setShowFilters(true)
    requestAnimationFrame(() => {
      placeFieldWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      const input = placeFieldWrapRef.current?.querySelector<HTMLInputElement>("input")
      input?.focus()
    })
  }, [])

  const hasIntentChip = q.trim().length > 0
  const showInterpretationLocationLine =
    interpretationSnapshot !== null && !loading && !error
  const showInterpretationStrip = hasIntentChip || showInterpretationLocationLine

  const interpretationPlaceLabel = (() => {
    if (!interpretationSnapshot || !showInterpretationLocationLine) return null
    const { source, city, country } = interpretationSnapshot
    const place = [city, country].filter(Boolean).join(", ")
    if (!place) {
      return {
        line: tStrip("noActivePlace"),
        hasPlace: false as const,
      }
    }
    if (source === "query") {
      return { line: tStrip("placeFromSearch", { place }), hasPlace: true as const }
    }
    if (source === "ui") {
      return { line: tStrip("selectedPlace", { place }), hasPlace: true as const }
    }
    return { line: tStrip("currentArea", { place }), hasPlace: true as const }
  })()

  const showingText = tEvents("results.showing", {
    filtered: filteredResults.length,
    total: results.length,
  })

  const emptyStateConstraintSummary = (() => {
    const parts: string[] = []
    if (q.trim()) parts.push(`“${q.trim()}”`)
    if (cityFilter.trim() || countryFilter.trim()) {
      parts.push([cityFilter.trim(), countryFilter.trim()].filter(Boolean).join(", "))
    }
    if (selectedCategory && selectedCategory !== "All") parts.push(selectedCategory)
    if (initialDateFrom?.trim()) {
      const d1 = new Date(initialDateFrom)
      if (!Number.isNaN(d1.getTime())) {
        const s1 = d1.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        if (initialDateTo?.trim()) {
          const d2 = new Date(initialDateTo)
          parts.push(
            !Number.isNaN(d2.getTime())
              ? `${s1}–${d2.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : s1,
          )
        } else {
          parts.push(s1)
        }
      }
    }
    return parts.length > 0 ? parts.join(" · ") : ""
  })()

  const aiSuggestionA11y =
    aiSuggestionChip && !loading && !error
      ? (() => {
          const baseTooltip = tStrip("aiSuggestionTooltip", {
            suggestion: aiSuggestionChip.displayLabel,
          })
          const baseAria = tStrip("aiSuggestionAria", {
            suggestion: aiSuggestionChip.displayLabel,
          })
          const low =
            aiSuggestionChip.confidence !== undefined &&
            aiSuggestionChip.confidence < 0.7
          const suffix = low ? ` ${tStrip("aiSuggestionLowConfidence")}` : ""
          return { title: `${baseTooltip}${suffix}`, ariaLabel: `${baseAria}${suffix}` }
        })()
      : null

  return (
    <div className="space-y-6">
      <div className="mb-8 space-y-3">
        <div ref={searchBarWrapRef}>
          <SmartInputBar
            onSearch={handleSmartSearch}
            initialQuery={initialQuery}
            alwaysShowSuggestions={true}
            onError={(error) => setError(error)}
          />
        </div>

        {showInterpretationStrip ? (
          <div
            className={cn(
              "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2",
            )}
            aria-live="polite"
          >
            {hasIntentChip ? (
              <Badge
                variant="secondary"
                data-testid="discover-interpretation-intent-chip"
                className="h-auto min-h-[44px] w-full max-w-full shrink-0 gap-1.5 py-1.5 pl-2 pr-1 sm:w-auto sm:max-w-[min(280px,55vw)]"
              >
                <button
                  type="button"
                  title={q.trim()}
                  onClick={focusDiscoverSearchInput}
                  className="min-h-[44px] min-w-0 flex-1 truncate text-left text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {q.trim()}
                </button>
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm hover:bg-secondary-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={tStrip("clearIntentQuery")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ) : null}

            {showInterpretationLocationLine && interpretationPlaceLabel ? (
              <p className="text-sm text-muted-foreground min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0">{interpretationPlaceLabel.line}</span>
                <button
                  type="button"
                  onClick={openDiscoverPlaceField}
                  className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline min-h-[44px] sm:min-h-0 py-2 sm:py-0"
                >
                  {interpretationPlaceLabel.hasPlace ? tStrip("change") : tStrip("setPlace")}
                </button>
              </p>
            ) : null}
          </div>
        ) : null}

        {aiSuggestionChip && aiSuggestionA11y ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              role="note"
              data-testid="discover-interpretation-ai-suggestion-chip"
              className="h-auto min-h-[44px] max-w-full shrink-0 py-1.5 px-2.5 text-xs font-normal sm:max-w-[min(420px,90vw)]"
              title={aiSuggestionA11y.title}
              aria-label={aiSuggestionA11y.ariaLabel}
            >
              {aiSuggestionChip.displayLabel}
            </Badge>
          </div>
        ) : null}
      </div>

      {(cityFilter || (selectedCategory && selectedCategory !== "All") || initialDateFrom) && (
        <div className="flex flex-wrap gap-2">
          {(cityFilter || countryFilter) && (
            <Badge variant="secondary" className="gap-1.5 pl-2 pr-1.5">
              <MapPin className="h-3 w-3" />
              <span>
                {cityFilter}
                {countryFilter ? `, ${countryFilter}` : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCityFilter("")
                  setCountryFilter("")
                }}
                className="ml-0.5 rounded-sm hover:bg-secondary-foreground/20"
              >
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div ref={placeFieldWrapRef} className="space-y-2 sm:col-span-2">
                <PlaceAutocomplete
                  testId="discover-place-autocomplete"
                  label="City / place"
                  description="Pick a place to set city and country on the URL (Discover source of truth)."
                  initialQuery={
                    [initialCity, initialCountry]
                      .map((s) => s?.trim())
                      .filter((s): s is string => Boolean(s))
                      .join(", ") || ""
                  }
                  onResolved={(place) => {
                    setCityFilter(place.city)
                    setCountryFilter(place.country || "")
                  }}
                  onClear={() => {
                    setCityFilter("")
                    setCountryFilter("")
                  }}
                />
              </div>

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
                {emptyStateConstraintSummary ? (
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Active scope: {emptyStateConstraintSummary}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Try expanding your search area, changing dates, or searching another city.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg text-muted-foreground mb-2">{tEvents("results.noEvents")}</p>
                {emptyStateConstraintSummary ? (
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-2">
                    Active scope: {emptyStateConstraintSummary}
                  </p>
                ) : null}
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
            const isWebWithoutVerifiedPlace =
              Boolean(event.isWebResult) && !eventCity.trim() && !eventCountry.trim()
            const locationPlaceLine = isWebWithoutVerifiedPlace
              ? tEvents("card.locationNotVerified")
              : [eventCity, eventCountry].filter(Boolean).join(", ")
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
                      <p
                        className={
                          isWebWithoutVerifiedPlace ? "text-xs text-muted-foreground" : "text-xs"
                        }
                      >
                        {locationPlaceLine}
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
