"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { getUserLocation as getUserLocationUtil, storeUserLocation as storeUserLocationUtil, clearUserLocation as clearUserLocationUtil, type UserLocation } from "@/lib/user-location"

export interface DefaultLocation {
  city: string
  country?: string
  lat?: number
  lng?: number
  source: "device" | "stored" | "manual"
}

interface LocationContextType {
  defaultLocation: DefaultLocation | null
  isLocationReady: boolean
  isLoadingLocation: boolean
  setDefaultLocation: (location: DefaultLocation | null, source?: "device" | "stored" | "manual") => void
  clearDefaultLocation: () => void
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [defaultLocation, setDefaultLocationState] = useState<DefaultLocation | null>(null)
  const [isLocationReady, setIsLocationReady] = useState(false)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)

  const attemptGeolocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      console.log("[LocationContext] Geolocation not available")
      return
    }

    setIsLoadingLocation(true)
    console.log("[LocationContext] Attempting geolocation on app boot...")

    const timeoutMs = 15000 // 15 second timeout
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        console.log(`[LocationContext] Geolocation success: ${lat}, ${lng}`)

        try {
          // Reverse geocode to get city/country
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
              // Store location
              storeUserLocationUtil({ lat, lng, city, country: country || undefined })

              // Update context
              const location: DefaultLocation = {
                city,
                country: country || undefined,
                lat,
                lng,
                source: "device",
              }
              setDefaultLocationState(location)
              setIsLocationReady(true)
              console.log(`[LocationContext] ✅ Location established from device: ${city}${country ? `, ${country}` : ""}`)
            } else {
              console.warn("[LocationContext] Reverse geocoding returned no valid city")
            }
          } else {
            console.warn(`[LocationContext] Reverse geocoding failed: ${response.status}`)
          }
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.warn("[LocationContext] Reverse geocoding error:", error)
          }
          // Silently fail - user can still search by city
        } finally {
          setIsLoadingLocation(false)
        }
      },
      (error) => {
        // Silently fail - geolocation errors are expected (permission denied, timeout, etc.)
        console.log(`[LocationContext] Geolocation failed (non-blocking):`, error.code === error.PERMISSION_DENIED ? "permission denied" : "other")
        setIsLoadingLocation(false)
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 300000, // Cache for 5 minutes
      }
    )
  }, [])

  // Load stored location and attempt geolocation on mount
  useEffect(() => {
    // Step 1: Load stored location first (fast)
    const stored = getUserLocationUtil()
    if (stored && stored.city && stored.city !== "Unknown location") {
      setDefaultLocationState({
        city: stored.city,
        country: stored.country,
        lat: stored.lat,
        lng: stored.lng,
        source: "stored",
      })
      setIsLocationReady(true)
      console.log(`[LocationContext] Loaded stored location: ${stored.city}${stored.country ? `, ${stored.country}` : ""}`)
    } else {
      setIsLocationReady(true) // Still ready, just no location
    }

    // Step 2: Attempt geolocation in parallel (non-blocking)
    // Only attempt if we don't have a stored location OR if stored location is old
    if (!stored || !stored.city || stored.city === "Unknown location") {
      attemptGeolocation()
    }
  }, [attemptGeolocation])

  const setDefaultLocation = useCallback((location: DefaultLocation | null, source: "device" | "stored" | "manual" = "manual") => {
    if (location) {
      // Store to localStorage
      if (location.lat && location.lng) {
        storeUserLocationUtil({
          lat: location.lat,
          lng: location.lng,
          city: location.city,
          country: location.country,
        })
      }

      setDefaultLocationState({
        ...location,
        source,
      })
      setIsLocationReady(true)
      console.log(`[LocationContext] Location set: ${location.city}${location.country ? `, ${location.country}` : ""} (source=${source})`)
    } else {
      clearDefaultLocation()
    }
  }, [])

  const clearDefaultLocation = useCallback(() => {
    clearUserLocationUtil()
    setDefaultLocationState(null)
    setIsLocationReady(true)
    console.log("[LocationContext] Location cleared")
  }, [])

  return (
    <LocationContext.Provider
      value={{
        defaultLocation,
        isLocationReady,
        isLoadingLocation,
        setDefaultLocation,
        clearDefaultLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  const context = useContext(LocationContext)
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider")
  }
  return context
}

