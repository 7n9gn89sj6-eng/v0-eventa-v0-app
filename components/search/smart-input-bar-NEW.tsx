"use client"

import type React from "react"

import { useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { Search, Loader2, AlertCircle, MapPin, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { reverseGeocodeDebounced } from "@/lib/geocoding"
import { intentToURLParams } from "@/lib/search/query-parser"
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

export const SmartInputBar = forwardRef<SmartInputBarRef, SmartInputBarProps>(
  ({ onSearch, onError, className, initialQuery, alwaysShowSuggestions = false }, ref) => {
    const { t } = useI18n()
    const tHome = t("home")
    const router = useRouter()
    const { defaultLocation, isLoadingLocation, setDefaultLocation, clearDefaultLocation } = useLocation()

    const [query, setQuery] = useState(initialQuery || "")
    const [isProcessing, setIsProcessing] = useState(false)
    const [showExamples, setShowExamples] = useState(!initialQuery || alwaysShowSuggestions)
    const [error, setError] = useState<string | null>(null)
    const [locationError, setLocationError] = useState<string | null>(null)

    // Detect if we're on localhost
    const isLocalhost = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || 
       window.location.hostname === "127.0.0.1" || 
       window.location.hostname.startsWith("192.168.") ||
       window.location.hostname.startsWith("10."))

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

    const handleLocationRequest = async (retryCount = 0) => {
      // If location exists, clear it
      if (defaultLocation) {
        clearDefaultLocation()
        setLocationError(null)
        return
      }

      setLocationError(null)

      if (!navigator.geolocation) {
        console.log("[v0] Geolocation API not available")
        return
      }

      const timeoutMs = 20000
      
      console.log(`[v0] Requesting location (attempt ${retryCount + 1}, timeout: ${timeoutMs}ms)`)
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          console.log(`[v0] Got coordinates:`, lat, lng)

          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)
            
            const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, {
              signal: controller.signal,
            })
            
            clearTimeout(timeoutId)
            
            if (response.ok) {
              const data = await response.json()
              const city = data.city
              const country = data.country

              if (city && city !== "Unknown location") {
                setDefaultLocation({
                  city,
                  country: country || undefined,
                  lat,
                  lng,
                  source: "manual",
                }, "manual")
                setLocationError(null)
                console.log(`[v0] Location set: ${city}${country ? `, ${country}` : ""}`)
              } else {
                // Fallback
                const cityFallback = await reverseGeocodeDebounced(lat, lng)
                if (cityFallback && cityFallback !== "Unknown location") {
                  setDefaultLocation({
                    city: cityFallback,
                    lat,
                    lng,
                    source: "manual",
                  }, "manual")
                  setLocationError(null)
                }
              }
            }
          } catch (error: any) {
            console.warn("[v0] Reverse geocoding error:", error)
            try {
              const city = await reverseGeocodeDebounced(lat, lng)
              if (city && city !== "Unknown location") {
                setDefaultLocation({
                  city,
                  lat,
                  lng,
                  source: "manual",
                }, "manual")
                setLocationError(null)
              }
            } catch (fallbackError) {
              console.warn("[v0] Fallback geocoding failed:", fallbackError)
            }
          }
        },
        async (error) => {
          console.log("[v0] Geolocation error:", error.code)
          setLocationError(null) // Silently fail
        },
        {
          enableHighAccuracy: false,
          timeout: timeoutMs,
          maximumAge: 300000,
        },
      )
    }

    const handleInputChange = (value: string) => {
      setQuery(value)
      if (value.trim()) {
        setShowExamples(alwaysShowSuggestions)
      } else {
        setShowExamples(true)
      }
    }

    const handleSubmit = async () => {
      if (!query.trim()) return

      setError(null)
      setIsProcessing(true)
      setShowExamples(alwaysShowSuggestions)

      try {
        // CRITICAL: Always include defaultLocation in the request if available
        const requestBody: any = { query }
        if (defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location") {
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

          if (query && !params.has("q")) {
            params.set("q", query)
          }

          // CRITICAL: Always ensure defaultLocation is in URL params if available
          // Query place from intent will override this in the backend (effectiveLocation precedence)
          const cityParam = params.get("city")
          const hasCityParam = cityParam && cityParam.trim().length > 0 && cityParam !== "Unknown location"
          
          // Add defaultLocation if available (backend will use query place if present, otherwise defaultLocation)
          if (defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location") {
            if (!hasCityParam) {
              // No city in query, use defaultLocation
              console.log(`[v0] Adding defaultLocation to URL params: ${defaultLocation.city}${defaultLocation.country ? `, ${defaultLocation.country}` : ""}`)
              params.set("city", defaultLocation.city)
              if (defaultLocation.lat && defaultLocation.lng) {
                params.set("lat", defaultLocation.lat.toString())
                params.set("lng", defaultLocation.lng.toString())
              }
            }
            if (defaultLocation.country && !params.has("country")) {
              params.set("country", defaultLocation.country)
            }
          } else if (hasCityParam) {
            console.log(`[v0] Using extracted city from query/intent: ${cityParam}`)
          } else {
            console.log(`[v0] ⚠️ No city available - search will be broad`)
          }

          console.log("[v0] Navigating with params:", params.toString())
          router.push(`/discover?${params.toString()}`)
        } else {
          // Fallback
          console.log("[v0] Intent API failed, using fallback")
          const fallbackParams = new URLSearchParams()
          fallbackParams.set("q", query)
          if (defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location") {
            fallbackParams.set("city", defaultLocation.city)
            if (defaultLocation.lat && defaultLocation.lng) {
              fallbackParams.set("lat", defaultLocation.lat.toString())
              fallbackParams.set("lng", defaultLocation.lng.toString())
            }
            if (defaultLocation.country) {
              fallbackParams.set("country", defaultLocation.country)
            }
            console.log(`[v0] Adding defaultLocation to fallback params: ${defaultLocation.city}`)
          }
          router.push(`/discover?${fallbackParams.toString()}`)
        }

        await onSearch?.(query)
      } catch (error: any) {
        console.error("[v0] Smart input error:", error)
        const errorParams = new URLSearchParams()
        errorParams.set("q", query)
        if (defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location") {
          errorParams.set("city", defaultLocation.city)
          if (defaultLocation.lat && defaultLocation.lng) {
            errorParams.set("lat", defaultLocation.lat.toString())
            errorParams.set("lng", defaultLocation.lng.toString())
          }
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

    const searchExamples = [
      tHome("chips.berlinThisWeek"),
      tHome("chips.romeWhileVisiting"),
      tHome("chips.athensFoodMusic"),
      tHome("chips.parisTripEvents"),
      tHome("chips.weekendNearMe"),
      tHome("chips.marketsNearby"),
      tHome("chips.liveMusicWeekend"),
      tHome("chips.familySaturday"),
      tHome("chips.artExhibitions"),
      tHome("chips.localCelebrations"),
      tHome("chips.neighbourhoodEvents"),
      tHome("chips.garageSalesNearby"),
    ]

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
              onClick={() => handleLocationRequest(0)}
              disabled={isLoadingLocation || isProcessing}
              className={cn(
                "shrink-0 min-h-[44px] active:scale-95",
                defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location" 
                  ? "bg-primary/10 border-primary/20" 
                  : "bg-transparent"
              )}
              title={
                defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location"
                  ? `Location: ${defaultLocation.city}${defaultLocation.country ? `, ${defaultLocation.country}` : ""}. Click to clear.`
                  : "Detect my current location"
              }
              aria-label={
                defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location"
                  ? `Clear location: ${defaultLocation.city}`
                  : "Detect my current location"
              }
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              {isLoadingLocation ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="hidden sm:inline ml-2">Finding your location…</span>
                </>
              ) : defaultLocation && defaultLocation.city && defaultLocation.city !== "Unknown location" ? (
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
                    setQuery(example)
                    setShowExamples(alwaysShowSuggestions)
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

