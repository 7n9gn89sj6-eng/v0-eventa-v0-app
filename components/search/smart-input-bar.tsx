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
import { getUserLocation, storeUserLocation, clearUserLocation, type UserLocation } from "@/lib/user-location"

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
    const [locationError, setLocationError] = useState<string | null>(null)

    // Detect if we're on localhost
    const isLocalhost = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || 
       window.location.hostname === "127.0.0.1" || 
       window.location.hostname.startsWith("192.168.") ||
       window.location.hostname.startsWith("10."))

    // Load stored location on mount
    useEffect(() => {
      const stored = getUserLocation()
      if (stored) {
        setUserLocation(stored)
        setLocationError(null) // Clear any errors if we have stored location
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

    const handleLocationRequest = async (retryCount = 0) => {
      // If location exists, clear it
      if (userLocation) {
        clearUserLocation()
        setUserLocation(null)
        setLocationError(null)
        return
      }

      setIsLoadingLocation(true)
      setError(null)
      setLocationError(null)

      if (!navigator.geolocation) {
        // Browser doesn't support geolocation - silently fail
        console.log("[v0] Geolocation API not available")
        setIsLoadingLocation(false)
        return
      }

      // Use longer timeout: 15 seconds (increased from 10)
      const timeoutMs = 15000
      
      console.log(`[v0] Requesting location (attempt ${retryCount + 1}, timeout: ${timeoutMs}ms, localhost: ${isLocalhost})`)
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          console.log(`[v0] Got coordinates (attempt ${retryCount + 1}):`, lat, lng)

          // Reverse geocode to get city name and country
          try {
            const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
            if (response.ok) {
              const data = await response.json()
              const city = data.city
              const country = data.country

              console.log("[v0] Reverse geocoded:", { city, country, lat, lng })

              if (city) {
                const location = { lat, lng, city, country, timestamp: Date.now() }
                storeUserLocation({ lat, lng, city, country })
                setUserLocation(location)
                setLocationError(null) // Clear any errors on success
                
                console.log("[v0] Stored location:", location)
                
                // Automatically navigate to search with location
                // Include a default query to ensure events are shown
                const params = new URLSearchParams()
                params.set("q", "events") // Default query to show events in this location
                params.set("city", city)
                params.set("lat", lat.toString())
                params.set("lng", lng.toString())
                if (country) {
                  params.set("country", country)
                }
                console.log(`[v0] Location detected: ${city}, navigating to search`)
                router.push(`/discover?${params.toString()}`)
              } else {
                // Fallback to coordinates without city name
                const location = { lat, lng, city: "Unknown location", timestamp: Date.now() }
                setUserLocation(location)
                setLocationError(null)
              }
            } else {
              // Fallback to old method if API fails
              const city = await reverseGeocodeDebounced(lat, lng)
              if (city) {
                const location = { lat, lng, city, timestamp: Date.now() }
                storeUserLocation({ lat, lng, city })
                setUserLocation(location)
                setLocationError(null)
                
                // Automatically navigate to search with location
                // Include a default query to ensure events are shown
                const params = new URLSearchParams()
                params.set("q", "events") // Default query to show events in this location
                params.set("city", city)
                params.set("lat", lat.toString())
                params.set("lng", lng.toString())
                console.log(`[v0] Location detected (fallback): ${city}, navigating to search`)
                router.push(`/discover?${params.toString()}`)
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
              setLocationError(null)
              
              // Automatically navigate to search with location
              // Include a default query to ensure events are shown
              const params = new URLSearchParams()
              params.set("q", "events") // Default query to show events in this location
              params.set("city", city)
              params.set("lat", lat.toString())
              params.set("lng", lng.toString())
              console.log(`[v0] Location detected (fallback 2): ${city}, navigating to search`)
              router.push(`/discover?${params.toString()}`)
            }
          }

          setIsLoadingLocation(false)
        },
        async (error) => {
          // Log detailed error information
          const errorDetails = {
            code: error.code,
            message: error.message,
            attempt: retryCount + 1,
            timeout: timeoutMs,
          }
          console.log("[v0] Geolocation error:", errorDetails)
          
          // Determine error type and handle accordingly
          if (error.code === error.TIMEOUT) {
            // Timeout: Check if we should retry (only retry once)
            if (retryCount === 0) {
              console.log("[v0] Timeout occurred, retrying once with longer timeout...")
              // Retry once with same timeout
              setTimeout(() => {
                handleLocationRequest(1)
              }, 500) // Small delay before retry
              return // Don't set loading to false yet, retry is happening
            }
            
            // Second attempt also timed out - check permission state
            try {
              const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
              if (permissionStatus.state === 'granted') {
                // Permission granted but timed out - network/positioning issue
                setLocationError("We couldn't determine your location right now. This can happen on some networks. You can still search by city.")
                console.log("[v0] Timeout with granted permission - likely network/positioning issue")
              } else {
                // Permission denied or prompt - different message
                setLocationError("Location permission was denied. You can still search by entering a city name.")
                console.log("[v0] Timeout with denied/prompt permission")
              }
            } catch (permError) {
              // Permissions API not supported - fallback to generic timeout message
              setLocationError("We couldn't determine your location right now. This can happen on some networks. You can still search by city.")
              console.log("[v0] Permissions API not supported, using generic timeout message")
            }
          } else if (error.code === error.PERMISSION_DENIED) {
            setLocationError("Location permission was denied. You can still search by entering a city name.")
            console.log("[v0] Permission denied by user")
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            // Check permission status - if granted, this might be temporary (GPS off, network issue)
            // Only show error if permission is actually denied
            try {
              const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
              if (permissionStatus.state === 'granted') {
                // Permission granted but position unavailable - likely temporary (GPS disabled, network issue)
                // Don't show error - just silently fail and let user search by city
                console.log("[v0] Position unavailable despite granted permission (GPS disabled or network issue) - silently failing")
                setLocationError(null)
              } else {
                // Permission not granted - show helpful message
                setLocationError("Location information is unavailable. You can still search by entering a city name.")
                console.log("[v0] Position unavailable and permission not granted")
              }
            } catch (permError) {
              // Permissions API not supported - show generic message but make it less alarming
              console.log("[v0] Position unavailable (Permissions API not supported) - silently failing")
              setLocationError(null)
            }
          } else {
            // Unknown error - silently fail
            setLocationError(null)
            console.log("[v0] Unknown geolocation error:", error)
          }
          
          setIsLoadingLocation(false)
        },
        {
          enableHighAccuracy: false,
          timeout: timeoutMs, // Increased timeout: 15 seconds
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

          // CRITICAL: Always add user location if available and no explicit city was extracted
          // This ensures location filtering works for queries like "jazz this weekend"
          // The intent API should extract city from userLocation, but if it doesn't, we add it here
          const cityParam = params.get("city")
          const hasCityParam = cityParam && cityParam.trim().length > 0 && cityParam !== "Unknown location"
          
          // If no city was extracted AND user has a detected location, use it
          // This is the fallback that ensures location filtering always works
          if (!hasCityParam && userLocation && userLocation.city && userLocation.city !== "Unknown location") {
            console.log(`[v0] Adding detected location to URL params (fallback): ${userLocation.city}`)
            params.set("city", userLocation.city)
            params.set("lat", userLocation.lat.toString())
            params.set("lng", userLocation.lng.toString())
            if (userLocation.country && !params.has("country")) {
              params.set("country", userLocation.country)
            }
          } else if (hasCityParam) {
            console.log(`[v0] Using extracted city from query/intent: ${cityParam}`)
          } else {
            console.log(`[v0] No city available - search will be broad (no location filter)`)
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

    // Trip-oriented examples that signal Eventa's trip discovery strengths
    // Plain-spoken, non-marketing tone that invites exploration
    const searchExamples = [
      // Trip / Holiday oriented (primary focus)
      tHome("chips.berlinThisWeek"),
      tHome("chips.romeWhileVisiting"),
      tHome("chips.athensFoodMusic"),
      tHome("chips.parisTripEvents"),
      tHome("chips.weekendNearMe"),
      // Local / everyday discovery
      tHome("chips.marketsNearby"),
      tHome("chips.liveMusicWeekend"),
      tHome("chips.familySaturday"),
      tHome("chips.artExhibitions"),
      // Community / grassroots
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
                userLocation ? "bg-primary/10 border-primary/20" : "bg-transparent"
              )}
              title={userLocation ? `Location: ${userLocation.city}. Click to clear.` : "Detect my current location"}
              aria-label={userLocation ? `Clear location: ${userLocation.city}` : "Detect my current location"}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              {isLoadingLocation ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="hidden sm:inline ml-2">Finding your location…</span>
                </>
              ) : userLocation ? (
                <>
                  <Check className="h-5 w-5 text-primary" />
                  <span className="hidden sm:inline ml-2">Near you</span>
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

        {/* Helper text - always visible */}
        <p className="text-xs text-muted-foreground">
          You can search by city name if location isn't available.
        </p>

        {/* Location error message (non-intrusive) */}
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
