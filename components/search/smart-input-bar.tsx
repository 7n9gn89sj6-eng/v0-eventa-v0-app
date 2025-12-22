"use client"

import type React from "react"

import { useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { Search, Loader2, AlertCircle, MapPin, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { reverseGeocodeDebounced } from "@/lib/geocoding"
import { intentToURLParams } from "@/lib/search/query-parser"
import { useRouter } from "next/navigation"
import { getUserLocation, storeUserLocation, type UserLocation } from "@/lib/user-location"

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

    const [query, setQuery] = useState(initialQuery || "")
    const [isProcessing, setIsProcessing] = useState(false)
    const [showExamples, setShowExamples] = useState(!initialQuery || alwaysShowSuggestions)
    const [error, setError] = useState<string | null>(null)

    const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
    const [isLoadingLocation, setIsLoadingLocation] = useState(false)

    // Load stored location on mount
    useEffect(() => {
      const stored = getUserLocation()
      if (stored) {
        setUserLocation(stored)
      }
    }, [])

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
      setIsLoadingLocation(true)
      setError(null)

      if (!navigator.geolocation) {
        // Browser doesn't support geolocation - silently fail
        setIsLoadingLocation(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          console.log("[v0] Got coordinates:", lat, lng)

          // Reverse geocode to get city name and country
          try {
            const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
            if (response.ok) {
              const data = await response.json()
              const city = data.city
              const country = data.country

              console.log("[v0] Reverse geocoded:", { city, country })

              if (city) {
                const location = { lat, lng, city, country, timestamp: Date.now() }
                storeUserLocation({ lat, lng, city, country })
                setUserLocation(location)
              } else {
                // Fallback to coordinates without city name
                const location = { lat, lng, city: "Unknown location", timestamp: Date.now() }
                setUserLocation(location)
              }
            } else {
              // Fallback to old method if API fails
              const city = await reverseGeocodeDebounced(lat, lng)
              if (city) {
                const location = { lat, lng, city, timestamp: Date.now() }
                storeUserLocation({ lat, lng, city })
                setUserLocation(location)
              }
            }
          } catch (error) {
            console.error("[v0] Reverse geocoding error:", error)
            // Fallback to old method
            const city = await reverseGeocodeDebounced(lat, lng)
            if (city) {
              const location = { lat, lng, city, timestamp: Date.now() }
              storeUserLocation({ lat, lng, city })
              setUserLocation(location)
            }
          }

          setIsLoadingLocation(false)
        },
        (error) => {
          console.log("[v0] Geolocation error:", error.message)
          // User denied or error - silently fail
          setIsLoadingLocation(false)
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // Cache for 5 minutes
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
        // Include user location in the request so the API can use it as default
        const requestBody: any = { query }
        if (userLocation && userLocation.city !== "Unknown location") {
          requestBody.userLocation = {
            lat: userLocation.lat,
            lng: userLocation.lng,
            city: userLocation.city,
            country: userLocation.country,
          }
        }

        const intentResponse = await fetch("/api/search/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        if (intentResponse.ok) {
          const intent = await intentResponse.json()
          console.log("[v0] Intent extraction:", intent)

          // Convert to URL params
          const params = intentToURLParams(intent)

          // Always include the original query
          if (query && !params.has("q")) {
            params.set("q", query)
          }

          // Add location if available (but don't override extracted city)
          // This is a fallback in case the intent API didn't include the location
          const cityParam = params.get("city")
          const hasCityParam = cityParam && cityParam.trim().length > 0
          
          if (!hasCityParam && userLocation && userLocation.city !== "Unknown location") {
            console.log(`[v0] Adding detected location to URL params as fallback: ${userLocation.city}`)
            params.set("city", userLocation.city)
            params.set("lat", userLocation.lat.toString())
            params.set("lng", userLocation.lng.toString())
            if (userLocation.country && !params.has("country")) {
              params.set("country", userLocation.country)
            }
          }

          console.log("[v0] Navigating with params:", params.toString())

          // Navigate to discover with structured params
          router.push(`/discover?${params.toString()}`)
        } else {
          // Fallback to simple search if intent extraction fails
          console.log("[v0] Intent API failed, using fallback")
          router.push(`/discover?q=${encodeURIComponent(query)}`)
        }

        // Call parent onSearch if provided
        await onSearch?.(query)
      } catch (error: any) {
        console.error("[v0] Smart input error:", error)
        // Fallback to simple search on error
        router.push(`/discover?q=${encodeURIComponent(query)}`)

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
      tHome("chips.jazzWeekend"),
      tHome("chips.athensFood"),
      tHome("chips.kidsSaturday"),
      tHome("chips.communityMarkets"),
      tHome("chips.garageSale"),
      tHome("chips.celebrations"),
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
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={guidanceText}
                className="w-full rounded-lg border bg-background px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                disabled={isProcessing}
                autoFocus
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleLocationRequest}
              disabled={isLoadingLocation || isProcessing}
              className="shrink-0 bg-transparent"
              title="Use my location"
            >
              {isLoadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
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

        {userLocation && userLocation.city !== "Unknown location" && (
          <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-secondary-foreground" />
            <span className="text-secondary-foreground">Near {userLocation.city}</span>
            <button
              onClick={() => setUserLocation(null)}
              className="ml-auto text-secondary-foreground hover:text-foreground"
              title="Clear location"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
