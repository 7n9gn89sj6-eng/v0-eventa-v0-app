"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Loader2, MapPin } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { mergeResolvedPlaceWithSuggestion } from "@/lib/places/merge-resolved-with-suggest"
import type { SelectedPlaceWire } from "@/lib/places/selected-place"
import { cn } from "@/lib/utils"

type Suggestion = {
  id: string
  label: string
  primary: string
  city: string
  country: string
  region: string | null
  postcode: string | null
  lat: number | null
  lng: number | null
}

export interface MapboxPlaceAutocompleteProps {
  disabled?: boolean
  id?: string
  label?: string
  description?: string
  /** Seed the input when the field mounts (e.g. header prefill). */
  initialQuery?: string
  autoFocus?: boolean
  /** Optional test id for Discover / Header integration tests. */
  testId?: string
  /** When true, the input stays enabled after a selection so typing clears the selection (Post Event). */
  allowEditQueryWhileSelected?: boolean
  onResolved: (place: SelectedPlaceWire) => void
  onClear: () => void
}

/**
 * Verify-then-select: type → Mapbox suggestions (server) → pick one → resolve to canonical place.
 * Uses GET /api/places/suggest?q= and GET /api/places/resolve?id= (no provider keys in browser).
 */
export function MapboxPlaceAutocomplete({
  disabled,
  id: idProp,
  label = "Event location",
  description = "Start typing an address or place name, then choose the correct option from the list.",
  initialQuery = "",
  autoFocus = false,
  testId,
  allowEditQueryWhileSelected = false,
  onResolved,
  onClear,
}: MapboxPlaceAutocompleteProps) {
  const genId = useId()
  const inputId = idProp ?? genId
  const listId = `${inputId}-suggestions`
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState(() => initialQuery)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolveLoading, setResolveLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configError, setConfigError] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<SelectedPlaceWire | null>(null)
  const [highlight, setHighlight] = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) return
    setQuery(initialQuery)
  }, [initialQuery, selected])

  useEffect(() => {
    if (autoFocus && inputRef.current && !selected) {
      inputRef.current.focus()
    }
  }, [autoFocus, selected])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    setError(null)
    setConfigError(false)
    try {
      const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(q)}`)
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        setConfigError(true)
        setSuggestions([])
        return
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Suggestions failed")
        setSuggestions([])
        return
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch {
      setError("Could not load suggestions. Check your connection.")
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selected) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query)
    }, 320)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected, fetchSuggestions])

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocDown)
    return () => document.removeEventListener("mousedown", onDocDown)
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(null)
    setQuery("")
    setSuggestions([])
    setOpen(false)
    setError(null)
    onClear()
  }, [onClear])

  const handleSelect = async (s: Suggestion) => {
    setResolveLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/places/resolve?id=${encodeURIComponent(s.id)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not confirm this place.")
        setOpen(false)
        return
      }
      if (!data.place || typeof data.place !== "object") {
        setError("Invalid response from server.")
        return
      }
      const place = data.place as SelectedPlaceWire
      const merged = mergeResolvedPlaceWithSuggestion(place, {
        primary: s.primary,
        city: s.city,
        country: s.country,
        region: s.region,
        postcode: s.postcode,
        lat: s.lat,
        lng: s.lng,
      })
      if (!merged.formattedAddress?.trim()) {
        setError("Could not confirm this place.")
        return
      }
      setSelected(merged)
      setQuery(merged.formattedAddress)
      setOpen(false)
      setSuggestions([])
      onResolved(merged)
    } catch {
      setError("Could not confirm this place.")
    } finally {
      setResolveLoading(false)
    }
  }

  const onInputChange = (v: string) => {
    if (disabled || resolveLoading) return
    if (selected) {
      setSelected(null)
      onClear()
    }
    setQuery(v)
    setOpen(true)
    setHighlight(0)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const s = suggestions[highlight]
      if (s) void handleSelect(s)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        {selected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={clearSelection}
            disabled={disabled}
          >
            Change location
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={
            disabled || (!allowEditQueryWhileSelected && Boolean(selected)) || resolveLoading
          }
          placeholder="e.g. 123 Collins Street, Melbourne"
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => !selected && setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn("pl-9", selected && "bg-muted/40")}
        />
        {loading || resolveLoading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}

        {open && !selected && suggestions.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          >
            {suggestions.map((s, i) => (
              <li key={s.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent",
                    i === highlight && "bg-accent",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => void handleSelect(s)}
                >
                  <span className="font-medium">{s.primary}</span>
                  <span className="text-xs text-muted-foreground line-clamp-2">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {configError ? (
        <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
            Location search is not configured on the server. You can still continue — we will try other ways to
            understand the address.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
