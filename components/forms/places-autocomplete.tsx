"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"

interface PlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect?: (place: {
    address: string
    suburb?: string
    city?: string
    state?: string
    country?: string
    lat?: number
    lng?: number
    postcode?: string
  }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

interface AutocompletePrediction {
  place_id: string
  description: string
  structured_formatting?: {
    main_text: string
    secondary_text: string
  }
}

interface PlaceDetails {
  formatted_address: string
  address_components: Array<{
    types: string[]
    long_name: string
    short_name: string
  }>
  geometry?: {
    location?: {
      lat: number
      lng: number
    }
  }
  place_id: string
  name: string
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
  const [suggestions, setSuggestions] = useState<AutocompletePrediction[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const sessionTokenRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Generate a session token for billing optimization
  const generateSessionToken = useCallback(() => {
    sessionTokenRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Initialize session token on mount
  useEffect(() => {
    generateSessionToken()
  }, [generateSessionToken])

  // Handle input changes and fetch suggestions using REST API
  const handleInputChange = useCallback(
    async (inputValue: string) => {
      onChange(inputValue)

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      if (!inputValue || inputValue.length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.warn("[PlacesAutocomplete] API key not configured")
        return
      }

      // Debounce API calls
      debounceTimerRef.current = setTimeout(async () => {
        try {
          // Use Places API (New) REST endpoint for autocomplete
          const url = new URL("https://places.googleapis.com/v1/places:autocomplete", window.location.origin)
          url.searchParams.set("key", apiKey)

          const requestBody = {
            input: inputValue,
            includedRegionCodes: [], // Empty array = all regions
            includedPrimaryTypes: ["geocode", "establishment"],
            sessionToken: sessionTokenRef.current || undefined,
          }

          const response = await fetch(`https://places.googleapis.com/v1/places:autocomplete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
            },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error("[PlacesAutocomplete] Autocomplete request failed:", response.status, errorText)
            setSuggestions([])
            setShowSuggestions(false)
            return
          }

          const data = await response.json()

          if (data.suggestions && data.suggestions.length > 0) {
            const predictions: AutocompletePrediction[] = data.suggestions
              .filter((s: any) => s.placePrediction)
              .map((s: any) => ({
                place_id: s.placePrediction.placeId,
                description: s.placePrediction.text?.text || s.placePrediction.structuredFormat?.mainText?.text || "",
                structured_formatting: s.placePrediction.structuredFormat
                  ? {
                      main_text: s.placePrediction.structuredFormat.mainText?.text || "",
                      secondary_text: s.placePrediction.structuredFormat.secondaryText?.text || "",
                    }
                  : undefined,
              }))

            setSuggestions(predictions)
            setShowSuggestions(true)
            setSelectedIndex(-1)
          } else {
            setSuggestions([])
            setShowSuggestions(false)
          }
        } catch (error) {
          console.error("[PlacesAutocomplete] Error fetching suggestions:", error)
          setSuggestions([])
          setShowSuggestions(false)
        }
      }, 300) // 300ms debounce
    },
    [onChange, generateSessionToken]
  )

  // Handle place selection using REST API
  const handlePlaceSelect = useCallback(
    async (placeId: string) => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.warn("[PlacesAutocomplete] API key not configured")
        return
      }

      try {
        // Use Places API (New) REST endpoint for place details
        const url = `https://places.googleapis.com/v1/places/${placeId}`
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "id,displayName,formattedAddress,addressComponents,location,plusCode,types,shortFormattedAddress",
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[PlacesAutocomplete] Place details request failed:", response.status, errorText)
          return
        }

        const place: any = await response.json()

        // Debug: Log the place data structure to verify field names
        if (process.env.NODE_ENV !== "production") {
          console.log("[PlacesAutocomplete] Place details response:", {
            addressComponents: place.addressComponents,
            formattedAddress: place.formattedAddress,
            displayName: place.displayName,
          })
        }

        // Extract address components properly
        let streetNumber: string | undefined
        let streetName: string | undefined
        let suburb: string | undefined // locality - e.g., "Camberwell"
        let state: string | undefined // administrative_area_level_1 - e.g., "Victoria" or "VIC"
        let country: string | undefined
        let postcode: string | undefined

        if (place.addressComponents) {
          for (const component of place.addressComponents) {
            const types = component.types || []
            // Places API (New) uses different field names - try both variations
            const longName =
              component.longText ||
              component.longName ||
              component.long_name ||
              component.text?.text ||
              ""
            const shortName =
              component.shortText ||
              component.shortName ||
              component.short_name ||
              ""

            // Street number
            if (types.includes("street_number")) {
              streetNumber = longName
            }

            // Street name (route)
            if (types.includes("route")) {
              streetName = longName
            }

            // Suburb/Locality - this is what should go in the "city" field for most addresses
            // Try locality first (main city/suburb), then sublocality_level_1 (suburb in some regions)
            if (types.includes("locality") && !suburb) {
              suburb = longName
            } else if (types.includes("sublocality_level_1") && !suburb) {
              suburb = longName
            } else if (types.includes("sublocality") && !suburb) {
              suburb = longName
            }

            // State/Province (administrative_area_level_1)
            if (types.includes("administrative_area_level_1")) {
              state = longName
            }

            // Country
            if (types.includes("country")) {
              country = longName
            }

            // Postcode
            if (types.includes("postal_code")) {
              postcode = longName
            }
          }
        }

        // Build street address from components (preferred) or use formatted address
        let streetAddress: string
        if (streetNumber && streetName) {
          streetAddress = `${streetNumber} ${streetName}`
        } else if (streetName) {
          streetAddress = streetName
        } else {
          // Fallback: use formatted address but try to remove city/state/postcode/country
          const formattedAddress = place.formattedAddress || place.displayName?.text || value
          // Remove common suffixes to get just the street address
          let cleanAddress = formattedAddress
          if (suburb) cleanAddress = cleanAddress.replace(new RegExp(`,\\s*${suburb}`, "i"), "")
          if (state) cleanAddress = cleanAddress.replace(new RegExp(`,\\s*${state}`, "i"), "")
          if (postcode) cleanAddress = cleanAddress.replace(new RegExp(`\\s*${postcode}`, "i"), "")
          if (country) cleanAddress = cleanAddress.replace(new RegExp(`,\\s*${country}`, "i"), "")
          streetAddress = cleanAddress.trim().replace(/^,\s*|\s*,$/g, "") || formattedAddress
        }

        onChange(streetAddress)

        if (onPlaceSelect && place.location) {
          onPlaceSelect({
            address: streetAddress,
            suburb, // Suburb/locality (e.g., "Camberwell")
            city: suburb, // For backward compatibility, also set city to suburb
            state, // State/province (e.g., "Victoria" or "VIC")
            country,
            lat: place.location.latitude,
            lng: place.location.longitude,
            postcode,
          })
        }

        // Generate new session token for next search
        generateSessionToken()

        setSuggestions([])
        setShowSuggestions(false)
      } catch (error) {
        console.error("[PlacesAutocomplete] Error getting place details:", error)
      }
    },
    [value, onChange, onPlaceSelect, generateSessionToken]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) {
        return
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault()
        handlePlaceSelect(suggestions[selectedIndex].place_id)
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    },
    [showSuggestions, suggestions, selectedIndex, handlePlaceSelect]
  )

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [selectedIndex])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="relative w-full" style={{ position: "relative", zIndex: 1 }}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true)
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-[99999] mt-1 w-full rounded-lg border bg-white shadow-lg"
          style={{
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((prediction, index) => (
            <div
              key={prediction.place_id}
              className={`cursor-pointer px-4 py-3 text-sm ${
                index === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
              } ${index === 0 ? "" : "border-t"}`}
              onClick={() => handlePlaceSelect(prediction.place_id)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="font-medium">{prediction.description}</div>
              {prediction.structured_formatting?.secondary_text && (
                <div className="text-xs text-gray-500">{prediction.structured_formatting.secondary_text}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
