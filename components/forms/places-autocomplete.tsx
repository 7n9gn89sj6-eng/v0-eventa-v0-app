"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

interface PlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect?: (place: {
    address: string
    city?: string
    country?: string
    lat?: number
    lng?: number
    postcode?: string
  }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

declare global {
  interface Window {
    google: any
    initGooglePlaces: () => void
  }
}

export function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter an address",
  disabled = false,
  className,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load Google Places API script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.warn("[PlacesAutocomplete] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured - using regular input")
      // Still allow the input to work, just without autocomplete
      setIsLoaded(true)
      return
    }

    // Check if already loaded
    if (window.google?.maps?.places) {
      setIsLoaded(true)
      return
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener("load", () => setIsLoaded(true))
      return
    }

    // Load the script
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => {
      // Verify the API actually loaded before marking as loaded
      if (window.google?.maps?.places) {
        setIsLoaded(true)
      } else {
        console.warn("[PlacesAutocomplete] Google Places API script loaded but API not available")
        setIsLoaded(true) // Still allow input to work
      }
    }
    script.onerror = () => {
      // Gracefully degrade - allow regular input to work even if API fails
      console.warn("[PlacesAutocomplete] Google Places API not available - using regular input")
      setIsLoaded(true) // Allow the input field to work normally (no autocomplete, but functional)
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup: remove script if component unmounts (optional, usually keep it)
    }
  }, [])

  // Initialize autocomplete when Google Maps is loaded
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      // No API key - skip autocomplete initialization
      return
    }

    if (!isLoaded || !inputRef.current || !window.google?.maps?.places) {
      return
    }

    // Initialize autocomplete
    const Autocomplete = window.google.maps.places.Autocomplete
    const autocomplete = new Autocomplete(inputRef.current, {
      types: ["address"], // Restrict to addresses
      fields: ["formatted_address", "address_components", "geometry", "place_id"],
    })

    autocompleteRef.current = autocomplete

    // Handle place selection
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()

      if (!place.geometry || !place.geometry.location) {
        console.warn("[PlacesAutocomplete] Place has no geometry")
        return
      }

      // Extract address components
      let city: string | undefined
      let country: string | undefined
      let postcode: string | undefined

      if (place.address_components) {
        for (const component of place.address_components) {
          const types = component.types

          if (types.includes("locality") || types.includes("administrative_area_level_1")) {
            city = component.long_name
          }

          if (types.includes("country")) {
            country = component.long_name
          }

          if (types.includes("postal_code")) {
            postcode = component.long_name
          }
        }
      }

      const formattedAddress = place.formatted_address || value

      // Update input value
      onChange(formattedAddress)

      // Call onPlaceSelect callback with extracted data
      if (onPlaceSelect) {
        onPlaceSelect({
          address: formattedAddress,
          city,
          country,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          postcode,
        })
      }
    })

    return () => {
      // Cleanup autocomplete
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [isLoaded, onChange, onPlaceSelect, value])

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}

