/**
 * User location utilities
 * Handles storing and retrieving user's detected location
 * Uses localStorage key "eventa.defaultLocation" for consistency with Location Context
 */

const LOCATION_STORAGE_KEY = "eventa.defaultLocation"

export interface UserLocation {
  lat: number
  lng: number
  city: string
  country?: string
  timestamp: number // When location was detected
}

const LOCATION_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Store user location in localStorage
 */
export function storeUserLocation(location: { lat: number; lng: number; city: string; country?: string }): void {
  if (typeof window === "undefined") return

  const locationWithTimestamp: UserLocation = {
    ...location,
    timestamp: Date.now(),
  }

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationWithTimestamp))
  } catch (error) {
    console.warn("[user-location] Failed to store location:", error)
  }
}

/**
 * Retrieve user location from localStorage if it's still valid
 */
export function getUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!stored) return null

    const location: UserLocation = JSON.parse(stored)
    
    // Check if location is still valid (not too old)
    const age = Date.now() - location.timestamp
    if (age > LOCATION_MAX_AGE) {
      localStorage.removeItem(LOCATION_STORAGE_KEY)
      return null
    }

    return location
  } catch (error) {
    console.warn("[user-location] Failed to retrieve location:", error)
    return null
  }
}

/**
 * Clear stored user location
 */
export function clearUserLocation(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY)
  } catch (error) {
    console.warn("[user-location] Failed to clear location:", error)
  }
}

