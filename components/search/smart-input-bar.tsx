"use client"

import type React from "react"

import { useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { Search, Loader2, AlertCircle, MapPin, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { intentToURLParams, parseDateExpression } from "@/lib/search/query-parser"
import { sanitizeQueryParam } from "@/lib/search/sanitize-query-param"
import { useRouter } from "next/navigation"
import { useLocation } from "@/lib/location-context"

interface SmartInputBarProps {
  onSearch?: (query: string) => Promise<void>
  onError?: (error: string) => void
  className?: string
  initialQuery?: string
  alwaysShowSuggestions?: boolean
}

export interface SmartInputBarRef {
  setQuery: (query: string) => void
}

function isReliableStructuredCity(city: string | null | undefined): boolean {
  if (!city?.trim()) return false
  const x = city.trim().toLowerCase()
  return x !== "unknown location" && x !== "current location"
}

/** Natural-language examples; a random subset is shown each mount (see TRY_THESE_VISIBLE_COUNT). */
const SEARCH_SUGGESTION_POOL = [
  "Paris HYROX",
  "Melbourne International Comedy Festival",
  "London theatre",
  "live music Sydney",
  "events in Melbourne",
  "things to do in Brisbane",
  "what's on in Sydney this weekend",
  "something fun in Melbourne tonight",
] as const

const TRY_THESE_VISIBLE_COUNT = 5

function pickRandomSuggestions(pool: readonly string[], count: number): string[] {
  const copy = [...pool]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, Math.min(count, pool.length))
}

export const SmartInputBar = forwardRef<SmartInputBarRef, SmartInputBarProps>(
  ({ onSearch, onError, className, initialQuery, alwaysShowSuggestions = false }, ref) => {
    const { t } = useI18n()
    const tHome = t("home")
    const router = useRouter()
    const { defaultLocation, isLoadingLocation, clearDefaultLocation, requestUserLocation } = useLocation()

    const [query, setQuery] = useState(initialQuery || "")
    const [isProcessing, setIsProcessing] = useState(false)
    const [showExamples, setShowExamples] = useState(!initialQuery || alwaysShowSuggestions)
    const [error, setError] = useState<string | null>(null)
    const [locationError, setLocationError] = useState<string | null>(null)
    const [manualLocationLoading, setManualLocationLoading] = useState(false)
    const [searchExamples] = useState(() =>
      pickRandomSuggestions(SEARCH_SUGGESTION_POOL, TRY_THESE_VISIBLE_COUNT),
    )

    useEffect(() => {
      if (initialQuery) {
        setQuery(initialQuery)
      }
    }, [initialQuery])

    useImperativeHandle(ref, () => ({
      setQuery: (newQuery: string) => {
        setQuery(newQuery)
      },
    }))

    const handleLocationRequest = async () => {
      if (defaultLocation) {
        clearDefaultLocation()
        setLocationError(null)
        return
      }
      setLocationError(null)
      setManualLocationLoading(true)
      try {
        await requestUserLocation({ maxRetries: 4 })
        setLocationError(null)
      } catch (err) {
        console.error("[SmartInputBar] requestUserLocation threw:", err)
      } finally {
        setManualLocationLoading(false)
      }
    }

    const handleInputChange = (value: string) => {
      setQuery(value)
      if (value.trim()) {
        setShowExamples(alwaysShowSuggestions)
      } else {
        setShowExamples(true)
      }
    }

    const handleSubmit = async (overrideQuery?: string) => {
      const effectiveQuery = String(overrideQuery ?? query).trim()
      if (!effectiveQuery) return

      if (overrideQuery !== undefined) {
        setQuery(effectiveQuery)
      }

      setError(null)
      setIsProcessing(true)
      setShowExamples(alwaysShowSuggestions)

      try {
        // CRITICAL: Always include defaultLocation in the request if available
        const requestBody: any = { query: effectiveQuery }
        if (defaultLocation && isReliableStructuredCity(defaultLocation.city)) {
          requestBody.userLocation = {
            lat: defaultLocation.lat,
            lng: defaultLocation.lng,
            city: defaultLocation.city,
            country: defaultLocation.country,
          }
          console.log(`[v0] Sending defaultLocation to intent API: ${defaultLocation.city}${defaultLocation.country ? `, ${defaultLocation.country}` : ""}`)
        }

        const intentResponse = await fetch("/api/search/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        if (intentResponse.ok) {
          const intent = await intentResponse.json()
          console.log("[v0] Intent extraction:", intent)

          const params = intentToURLParams(intent)
          if (effectiveQuery) {
            params.set("q", effectiveQuery)
          } else {
            const safe = sanitizeQueryParam(params.get("q"))
            if (safe) params.set("q", safe)
            else params.delete("q")
          }

          // CRITICAL: Always ensure defaultLocation is in URL params if available
          // Query place from intent will override this in the backend (effectiveLocation precedence)
          const cityParam = params.get("city")
          const hasCityParam = cityParam && isReliableStructuredCity(cityParam)
          
          // Check if the extracted city is different from detected location (user override)
          const isLocationOverride = hasCityParam && defaultLocation?.city && 
            cityParam.toLowerCase() !== defaultLocation.city.toLowerCase()
          
          // Add defaultLocation if available (backend will use query place if present, otherwise defaultLocation)
          if (defaultLocation && isReliableStructuredCity(defaultLocation.city)) {
            if (!hasCityParam) {
              // No city in query, use defaultLocation as default
              console.log(`[v0] No city in query - using defaultLocation: ${defaultLocation.city}${defaultLocation.country ? `, ${defaultLocation.country}` : ""}`)
              params.set("city", defaultLocation.city)
            } else if (isLocationOverride) {
              // User specified a different location - let it override (backend will handle this)
              console.log(`[v0] User specified different location (${cityParam}) - will override detected location (${defaultLocation.city})`)
            } else {
              // Same city or city from query matches detected location
              console.log(`[v0] Using extracted city from query/intent: ${cityParam}`)
            }
            // Always add country if available and not already set
            if (defaultLocation.country && !params.has("country")) {
              params.set("country", defaultLocation.country)
            }
          } else if (hasCityParam) {
            console.log(`[v0] Using extracted city from query/intent: ${cityParam}`)
          } else {
            console.log(`[v0] ⚠️ No structured city for /discover URL — search will be broad (coords not sent)`)
          }

          console.log("[v0] Navigating with params:", params.toString())
          router.push(`/discover?${params.toString()}`)
        } else {
          // Fallback: Intent API failed, but search can still work
          const errorData = await intentResponse.json().catch(() => ({}))
          console.warn("[v0] Intent API failed, using fallback:", errorData.error || "Unknown error")
          
          const fallbackParams = new URLSearchParams()
          fallbackParams.set("q", effectiveQuery)
          
          // Time intent should still narrow results, even if the intent API fails.
          const dateRange = parseDateExpression(effectiveQuery)
          if (dateRange.date_from) fallbackParams.set("date_from", dateRange.date_from)
          if (dateRange.date_to) fallbackParams.set("date_to", dateRange.date_to)
          
          // ALWAYS add defaultLocation if available (unless user specified a different location in query)
          // Check if query contains a city name that's different from detected location
          // Note: fallback is intentionally forgiving (case-insensitive, accepts lowercase).
          const cityMatch = effectiveQuery.match(/\b(in|at|near|around)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})\b/i)
          let extractedCity = cityMatch ? cityMatch[2].trim() : null
          if (extractedCity) {
            const extractedLower = extractedCity.toLowerCase()
            const invalidTokens = new Set([
              "me",
              "my",
              "here",
              "there",
              "near",
              "around",
              "in",
              "at",
              "to",
              "on",
              "tonight",
              "today",
              "tomorrow",
              "weekend",
              "week",
              "month",
              "year",
            ])
            if (invalidTokens.has(extractedLower) || extractedCity.length < 2) {
              extractedCity = null
            }
          }
          const isLocationOverride = extractedCity && defaultLocation?.city && 
            extractedCity.toLowerCase() !== defaultLocation.city.toLowerCase()
          
          if (defaultLocation && isReliableStructuredCity(defaultLocation.city)) {
            if (!isLocationOverride) {
              // No location override - use defaultLocation
              fallbackParams.set("city", defaultLocation.city)
              if (defaultLocation.country) {
                fallbackParams.set("country", defaultLocation.country)
              }
              console.log(`[v0] Adding defaultLocation to fallback params: ${defaultLocation.city}`)
            } else {
              // User specified different location - let query extraction handle it
              console.log(`[v0] User specified different location in query (${extractedCity}) - will override detected location`)
            }
          }
          router.push(`/discover?${fallbackParams.toString()}`)
        }

        await onSearch?.(effectiveQuery)
      } catch (error: any) {
        console.error("[v0] Smart input error:", error)
        const errorParams = new URLSearchParams()
        errorParams.set("q", effectiveQuery)
        if (defaultLocation && isReliableStructuredCity(defaultLocation.city)) {
          errorParams.set("city", defaultLocation.city)
          if (defaultLocation.country) {
            errorParams.set("country", defaultLocation.country)
          }
        }
        router.push(`/discover?${errorParams.toString()}`)

        const errorMessage = error?.message || "Something went wrong. Please try again."
        setError(errorMessage)
        onError?.(errorMessage)
      } finally {
        setIsProcessing(false)
      }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }

    const guidanceText = tHome("search.searchGuidance")

    return (
      <div className={cn("w-full space-y-3", className)}>
        <div className="relative flex flex-col gap-2 sm:flex-row">
          <div className="relative flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                inputMode="search"
                autoComplete="off"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={guidanceText}
                className="w-full rounded-lg border bg-background px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 min-h-[44px]"
                disabled={isProcessing}
                autoFocus
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => handleLocationRequest()}
              disabled={manualLocationLoading || isProcessing}
              className={cn(
                "shrink-0 min-h-[44px] active:scale-95",
                defaultLocation && isReliableStructuredCity(defaultLocation.city) 
                  ? "bg-primary/10 border-primary/20" 
                  : "bg-transparent"
              )}
              title={
                defaultLocation && isReliableStructuredCity(defaultLocation.city)
                  ? `Location: ${defaultLocation.city}${defaultLocation.country ? `, ${defaultLocation.country}` : ""}. Click to clear.`
                  : "Detect my current location"
              }
              aria-label={
                defaultLocation && isReliableStructuredCity(defaultLocation.city)
                  ? `Clear location: ${defaultLocation.city}`
                  : "Detect my current location"
              }
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              {manualLocationLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="hidden sm:inline ml-2">Finding your location…</span>
                </>
              ) : defaultLocation && isReliableStructuredCity(defaultLocation.city) ? (
                <>
                  <Check className="h-5 w-5 text-primary" />
                  <span className="hidden sm:inline ml-2">
                    {defaultLocation.city}{defaultLocation.country ? `, ${defaultLocation.country}` : ""}
                  </span>
                </>
              ) : (
                <MapPin className="h-5 w-5" />
              )}
            </Button>
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!query.trim() || isProcessing}
            size="lg"
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tHome("search.processing")}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                {tHome("search.go")}
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          You can search by city name if location isn't available.
        </p>

        {locationError && (
          <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              {locationError}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {showExamples && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{tHome("search.tryThese")}</p>
            <div className="flex flex-wrap gap-2">
              {searchExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    void handleSubmit(example)
                  }}
                  className="rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
)

SmartInputBar.displayName = "SmartInputBar"

