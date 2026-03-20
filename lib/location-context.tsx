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

/** Error codes returned by requestUserLocation for UI messaging and logging */
export type GeolocationErrorCode =
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "NOT_SUPPORTED"
  | "HTTPS_REQUIRED"
  | "REVERSE_GEOCODE_FAILURE"
  | null

export interface RequestUserLocationResult {
  success: boolean
  errorCode: GeolocationErrorCode
  errorMessage?: string
}

/** Structured log for geolocation (permission_denied | timeout | position_unavailable | reverse_geocode_failure) */
function logGeolocation(
  type: "permission_denied" | "timeout" | "position_unavailable" | "reverse_geocode_failure",
  details: { code?: number; message?: string; attempt?: number; maxRetries?: number; status?: number }
) {
  console.warn("[Geolocation]", { type, ...details })
}

/** Maps GeolocationPositionError.code to a stable label for logs. */
function geolocationErrorName(code: number): string {
  if (code === 1) return "PERMISSION_DENIED"
  if (code === 2) return "POSITION_UNAVAILABLE"
  if (code === 3) return "TIMEOUT"
  return `UNKNOWN(${code})`
}

interface LocationContextType {
  defaultLocation: DefaultLocation | null
  isLocationReady: boolean
  isLoadingLocation: boolean
  /** Single source for location error message; only header should render it (avoids duplicate banners). */
  lastLocationError: string | null
  setLastLocationError: (message: string | null) => void
  setDefaultLocation: (location: DefaultLocation | null, source?: "device" | "stored" | "manual") => void
  clearDefaultLocation: () => void
  /** User-triggered location with retries and reverse geocode. Use for header and search bar buttons. */
  requestUserLocation: (options?: { maxRetries?: number }) => Promise<RequestUserLocationResult>
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

const DEBUG = typeof window !== "undefined" && (window as any).__EVENTA_GEOLOCATION_DEBUG__ === true

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [defaultLocation, setDefaultLocationState] = useState<DefaultLocation | null>(null)
  const [isLocationReady, setIsLocationReady] = useState(false)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [lastLocationError, setLastLocationError] = useState<string | null>(null)

  // Boot-time only: runs once on mount if no stored location. Failure is silent (log only); never sets lastLocationError.
  const attemptGeolocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      console.log("[LocationContext] Geolocation not available")
      return
    }

    setIsLoadingLocation(true)
    if (DEBUG) console.log("[LocationContext] Attempting geolocation on app boot...")

    const timeoutMs = 15000 // 15 second timeout
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        console.log(`[LocationContext] Geolocation success: ${lat}, ${lng}`)

        try {
          // Reverse geocode to get city/country (align boot fallback with tryReverseGeocode)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)

          const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, {
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            const data = await response.json()
            const rawCity = data.city
            const countryRaw = data.country

            if (rawCity && rawCity !== "Unknown location") {
              storeUserLocationUtil({ lat, lng, city: rawCity, country: countryRaw || undefined })
              const location: DefaultLocation = {
                city: rawCity,
                country: countryRaw || undefined,
                lat,
                lng,
                source: "device",
              }
              setDefaultLocationState(location)
              setIsLocationReady(true)
              console.log(`[LocationContext] ✅ Location established from device: ${rawCity}${countryRaw ? `, ${countryRaw}` : ""}`)
            } else {
              const country = countryRaw || undefined
              storeUserLocationUtil({ lat, lng, city: "Current location", country })
              setDefaultLocationState({ city: "Current location", country, lat, lng, source: "manual" })
              setIsLocationReady(true)
              console.warn("[LocationContext] Boot: reverse returned no usable city; using Current location fallback", {
                lat,
                lng,
              })
            }
          } else {
            logGeolocation("reverse_geocode_failure", { status: response.status, message: response.statusText })
            const fallback: DefaultLocation = { city: "Current location", lat, lng, source: "manual" }
            storeUserLocationUtil({ lat, lng, city: fallback.city, country: undefined })
            setDefaultLocationState(fallback)
            setIsLocationReady(true)
            console.warn(`[LocationContext] Boot: reverse HTTP ${response.status}; using Current location fallback`)
          }
        } catch (error: any) {
          if (error?.name === "AbortError") {
            logGeolocation("reverse_geocode_failure", { message: "reverse request aborted (timeout)" })
          } else {
            logGeolocation("reverse_geocode_failure", { message: String(error?.message || error) })
            console.warn("[LocationContext] Reverse geocoding error:", error)
          }
          const fallback: DefaultLocation = { city: "Current location", lat, lng, source: "manual" }
          storeUserLocationUtil({ lat, lng, city: fallback.city, country: undefined })
          setDefaultLocationState(fallback)
          setIsLocationReady(true)
          console.warn("[LocationContext] Boot: reverse geocode error; using Current location fallback")
        } finally {
          setIsLoadingLocation(false)
        }
      },
      (error) => {
        // Boot attempt only: do not set lastLocationError; the visible banner is only for user-initiated requestUserLocation.
        console.warn("[Geolocation] Boot getCurrentPosition failed", {
          code: error.code,
          name: geolocationErrorName(error.code),
          message: error.message || undefined,
        })
        if (DEBUG) {
          const type = error.code === error.PERMISSION_DENIED ? "permission_denied" : error.code === error.TIMEOUT ? "timeout" : "position_unavailable"
          console.log("[LocationContext] Boot geolocation failed (silent, no user banner):", { type, code: error.code, message: error.message || undefined })
        }
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

  const requestUserLocation = useCallback(
    (options?: { maxRetries?: number }): Promise<RequestUserLocationResult> => {
      console.log("[LocationContext] User initiated location request")
      const maxRetries = Math.max(1, Math.min(5, options?.maxRetries ?? 3))

      return new Promise((resolve) => {
        if (typeof window === "undefined" || !navigator.geolocation) {
          const msg = "Location detection is not supported in your browser."
          setLastLocationError(msg)
          resolve({ success: false, errorCode: "NOT_SUPPORTED", errorMessage: msg })
          return
        }
        const isLocalhost =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname.startsWith("192.168.") ||
          window.location.hostname.startsWith("10.")
        if (!isLocalhost && window.location.protocol !== "https:") {
          const msg = "Location detection requires a secure connection (HTTPS). You can still search by city name."
          setLastLocationError(msg)
          resolve({ success: false, errorCode: "HTTPS_REQUIRED", errorMessage: msg })
          return
        }

        setLastLocationError(null)
        let attempt = 0

        const attemptOptions: Array<{ enableHighAccuracy: boolean; timeout: number; maximumAge: number }> = [
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 },
          { enableHighAccuracy: false, timeout: 25000, maximumAge: 0 },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
        ]

        const tryReverseGeocode = (lat: number, lng: number) => {
          if (DEBUG) console.log("[Geolocation DEBUG] reverse geocode request start", { lat, lng })
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)
          fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, { signal: controller.signal })
            .then((response) => {
              clearTimeout(timeoutId)
              if (!response.ok) {
                if (DEBUG) console.log("[Geolocation DEBUG] reverse geocode failure", { status: response.status, statusText: response.statusText })
                logGeolocation("reverse_geocode_failure", { status: response.status, message: response.statusText })
                const fallback: DefaultLocation = { city: "Current location", lat, lng, source: "manual" }
                storeUserLocationUtil({ lat, lng, city: fallback.city, country: undefined })
                setDefaultLocationState({ ...fallback, source: "manual" })
                setLastLocationError(null)
                if (DEBUG) console.log("[Geolocation DEBUG] final state", { success: true, note: "location set as Current location (reverse geocode failed)" })
                return resolve({ success: true, errorCode: null })
              }
              return response.json().then((data: { city?: string; country?: string }) => {
                const city = data?.city && data.city !== "Unknown location" ? data.city : "Current location"
                const country = data?.country || undefined
                if (DEBUG) console.log("[Geolocation DEBUG] reverse geocode success", { city, country })
                storeUserLocationUtil({ lat, lng, city, country })
                setDefaultLocationState({ city, country, lat, lng, source: "manual" })
                setLastLocationError(null)
                if (DEBUG) console.log("[Geolocation DEBUG] final state", { success: true, city, country })
                resolve({ success: true, errorCode: null })
              })
            })
            .catch((err) => {
              clearTimeout(timeoutId)
              if (err?.name === "AbortError") return
              if (DEBUG) console.log("[Geolocation DEBUG] reverse geocode failure", { message: String(err?.message || err) })
              logGeolocation("reverse_geocode_failure", { message: String(err?.message || err) })
              const fallback: DefaultLocation = { city: "Current location", lat, lng, source: "manual" }
              storeUserLocationUtil({ lat, lng, city: fallback.city, country: undefined })
              setDefaultLocationState({ ...fallback, source: "manual" })
              setLastLocationError(null)
              if (DEBUG) console.log("[Geolocation DEBUG] final state", { success: true, note: "location set as Current location (fetch error)" })
              resolve({ success: true, errorCode: null })
            })
        }

        const tryGetPosition = () => {
          attempt += 1
          const opts = attemptOptions[Math.min(attempt - 1, attemptOptions.length - 1)]
          console.log("[Geolocation] Attempt", attempt, "/", maxRetries, "options:", JSON.stringify(opts))

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const lat = position.coords.latitude
              const lng = position.coords.longitude
              if (DEBUG) console.log("[Geolocation DEBUG] raw geolocation success", { lat, lng })
              tryReverseGeocode(lat, lng)
            },
            (error: GeolocationPositionError) => {
              console.warn("[Geolocation] getCurrentPosition failed", {
                code: error.code,
                name: geolocationErrorName(error.code),
                message: error.message || undefined,
                attempt,
                maxRetries,
              })
              if (DEBUG) console.log("[Geolocation DEBUG] raw geolocation error", { code: error.code, message: error.message || undefined })
              if (error.code === error.PERMISSION_DENIED) {
                logGeolocation("permission_denied", { code: error.code, message: error.message || undefined })
                const errorMessage = "Location permission was denied. You can still search by entering a city name."
                setLastLocationError(errorMessage)
                if (DEBUG) console.log("[Geolocation DEBUG] final state", { success: false, errorCode: "PERMISSION_DENIED", errorMessage })
                resolve({
                  success: false,
                  errorCode: "PERMISSION_DENIED",
                  errorMessage,
                })
                return
              }
              if (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT) {
                const type = error.code === error.TIMEOUT ? "timeout" : "position_unavailable"
                logGeolocation(type, { code: error.code, message: error.message || undefined, attempt, maxRetries })
                if (attempt < maxRetries) {
                  setTimeout(() => tryGetPosition(), 1500)
                  return
                }
                const errorMessage =
                  error.code === error.TIMEOUT
                    ? "Location request timed out. You can still search by city name."
                    : "We couldn't determine your location right now (e.g. GPS off or weak signal). You can still search by city name."
                setLastLocationError(errorMessage)
                if (DEBUG) console.log("[Geolocation DEBUG] final state", { success: false, errorCode: error.code === error.TIMEOUT ? "TIMEOUT" : "POSITION_UNAVAILABLE", errorMessage })
                resolve({
                  success: false,
                  errorCode: error.code === error.TIMEOUT ? "TIMEOUT" : "POSITION_UNAVAILABLE",
                  errorMessage,
                })
                return
              }
              logGeolocation("position_unavailable", { code: error.code, message: error.message || undefined, attempt })
              const errorMessage = "We couldn't determine your location. You can still search by city name."
              setLastLocationError(errorMessage)
              if (DEBUG) console.log("[Geolocation DEBUG] final state", { success: false, errorCode: "POSITION_UNAVAILABLE", errorMessage })
              resolve({
                success: false,
                errorCode: "POSITION_UNAVAILABLE",
                errorMessage,
              })
            },
            opts
          )
        }

        tryGetPosition()
      })
    },
    []
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    ;(window as any).__EVENTA_GEOLOCATION_TEST__ = function () {
      if (!navigator.geolocation) {
        console.log("[Diagnostic] Geolocation not available")
        return
      }
      const opts = { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
      console.log("[Diagnostic] Calling getCurrentPosition with:", JSON.stringify(opts))
      navigator.geolocation.getCurrentPosition(
        (pos) => console.log("[Diagnostic] SUCCESS:", { lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("[Diagnostic] ERROR:", { code: err.code, message: err.message || undefined }),
        opts
      )
    }
    return () => {
      delete (window as any).__EVENTA_GEOLOCATION_TEST__
    }
  }, [])

  return (
    <LocationContext.Provider
      value={{
        defaultLocation,
        isLocationReady,
        isLoadingLocation,
        lastLocationError,
        setLastLocationError,
        setDefaultLocation,
        clearDefaultLocation,
        requestUserLocation,
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

