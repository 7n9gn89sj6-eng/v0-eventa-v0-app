"use client"

import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { Search, Loader2, MapPin, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { reverseGeocodeDebounced } from "@/lib/geocoding"

//
// ---- SIMPLE NATURAL LANGUAGE DATE PARSER ----
//
function parseDateRangeFromQuery(query: string) {
  const text = query.toLowerCase()
  const today = new Date()
  const format = (d: Date) => d.toISOString().split("T")[0]

  // Today / Tonight
  if (text === "today" || text === "tonight") {
    return { date_from: format(today), date_to: format(today) }
  }

  // Tomorrow
  if (text.startsWith("tomorrow")) {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return { date_from: format(d), date_to: format(d) }
  }

  // This weekend
  if (text.includes("this weekend")) {
    const d = new Date(today)
    const friday = new Date(d)
    friday.setDate(friday.getDate() + ((5 - d.getDay() + 7) % 7))
    const sunday = new Date(friday)
    sunday.setDate(friday.getDate() + 2)
    return { date_from: format(friday), date_to: format(sunday) }
  }

  return {}
}

//
// EXPORT COMPONENT
//
export interface SmartInputBarRef {
  setQuery: (q: string) => void
}

export const SmartInputBar = forwardRef<SmartInputBarRef, {
  onSearch?: (q: string) => Promise<void>
  onError?: (e: string) => void
  initialQuery?: string
  alwaysShowSuggestions?: boolean
  className?: string
}>(
  ({ onSearch, onError, initialQuery, alwaysShowSuggestions = false, className }, ref) => {

    const router = useRouter()
    const { t } = useI18n()
    const tHome = t("home")

    const [query, setQuery] = useState(initialQuery || "")
    const [error, setError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [showExamples, setShowExamples] = useState(!initialQuery || alwaysShowSuggestions)

    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; city: string } | null>(null)
    const [isLocating, setIsLocating] = useState(false)

    useEffect(() => {
      if (initialQuery) setQuery(initialQuery)
    }, [initialQuery])

    useImperativeHandle(ref, () => ({
      setQuery: (q: string) => setQuery(q),
    }))

    //
    // ---- LOCATION REQUEST ----
    //
    const handleLocation = () => {
      setIsLocating(true)
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const city = await reverseGeocodeDebounced(lat, lng)
          setUserLocation({ lat, lng, city: city || "Unknown location" })
          setIsLocating(false)
        },
        () => setIsLocating(false),
        { timeout: 8000 }
      )
    }

    //
    // ---- HANDLE SUBMIT ----
    //
    const handleSubmit = async () => {
      if (!query.trim()) return

      setIsProcessing(true)
      setError(null)

      try {
        const intentRes = await fetch("/api/search/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        })

        const params = new URLSearchParams()

        // Fallback to simple if intent fails
        if (!intentRes.ok) {
          params.set("q", query)
        } else {
          const intent = await intentRes.json()

          if (intent.extracted?.city) params.set("city", intent.extracted.city)
          if (intent.extracted?.type) params.set("category", intent.extracted.type)

          // Natural language dates
          const { date_from, date_to } = parseDateRangeFromQuery(query)
          if (date_from) params.set("date_from", date_from)
          if (date_to) params.set("date_to", date_to)

          if (!intent.extracted?.city && !intent.extracted?.type) {
            params.set("q", query)
          }
        }

        // Add location
        if (userLocation && userLocation.city !== "Unknown location") {
          params.set("city", userLocation.city)
          params.set("lat", String(userLocation.lat))
          params.set("lng", String(userLocation.lng))
        }

        router.push(`/discover?${params.toString()}`)
        await onSearch?.(query)

      } catch (err: any) {
        setError(err?.message || "Something went wrong.")
        onError?.(err?.message || "")
      }

      setIsProcessing(false)
    }

    //
    // ---- ENTER KEY ----
    //
    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      }
    }

    //
    // ---- EXAMPLE PROMPTS ----
    //
    const examples = [
      tHome("chips.jazzWeekend"),
      tHome("chips.athensFood"),
      tHome("chips.kidsSaturday"),
      tHome("chips.communityMarkets"),
    ]

    return (
      <div className={cn("space-y-3 w-full", className)}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowExamples(e.target.value.trim() ? alwaysShowSuggestions : true)
                }}
                onKeyDown={onKey}
                placeholder={tHome("search.searchGuidance")}
                className="w-full border rounded-lg px-10 py-3 text-sm bg-background"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleLocation}
              disabled={isLocating}
              className="shrink-0"
            >
              {isLocating ? <Loader2 className="animate-spin h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </Button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!query.trim() || isProcessing}
            size="lg"
            className="gap-2"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {isProcessing ? tHome("search.processing") : tHome("search.go")}
          </Button>
        </div>

        {userLocation && userLocation.city !== "Unknown location" && (
          <div className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm">
            <MapPin className="h-4 w-4" />
            Near {userLocation.city}
            <button className="ml-auto" onClick={() => setUserLocation(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {showExamples && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{tHome("search.tryThese")}</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="bg-secondary text-secondary-foreground rounded-full px-3 py-1.5 text-xs"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
)

SmartInputBar.displayName = "SmartInputBar"
