"use client"

import { useSearch } from "@/lib/search/use-search"
import { ResultCard } from "./result-card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Globe } from "lucide-react"
import type { SearchFilters } from "@/lib/types"

interface SearchResultsProps {
  query: string
  filters: SearchFilters
  includeWeb: boolean
  onIncludeWebChange: (include: boolean) => void
  userLocation: { lat: number; lng: number } | null
}

export function SearchResults({ query, filters, includeWeb, onIncludeWebChange, userLocation }: SearchResultsProps) {
  const { results, usedWeb, langDetected, totalResults, isLoading, error } = useSearch({
    query,
    filters,
    includeWeb,
    userLat: userLocation?.lat,
    userLng: userLocation?.lng,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to search events. Please try again.</AlertDescription>
      </Alert>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="mb-4 text-lg text-muted-foreground">No events found for "{query}"</p>
        <p className="mb-6 text-sm text-muted-foreground">
          Try a broader date range, a different word (e.g., 'market'/'fiesta'), or include web results.
        </p>
        {!includeWeb && (
          <Button onClick={() => onIncludeWebChange(true)} variant="outline" className="gap-2">
            <Globe className="h-4 w-4" />
            Include web results
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {totalResults} {totalResults === 1 ? "event" : "events"} found
          </h2>
          {langDetected && (
            <p className="text-sm text-muted-foreground">Detected language: {langDetected.toUpperCase()}</p>
          )}
        </div>

        {!includeWeb && results.length < 10 && (
          <Button onClick={() => onIncludeWebChange(true)} variant="outline" size="sm" className="gap-2">
            <Globe className="h-4 w-4" />
            Include web results
          </Button>
        )}
      </div>

      {usedWeb && (
        <Alert>
          <AlertDescription>
            Showing results from Eventa and the web. Web results are labeled with "Source: Web".
          </AlertDescription>
        </Alert>
      )}

      {/* Results grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {results.map((result, index) => (
          <ResultCard key={`${result.source}-${result.id || index}`} result={result} />
        ))}
      </div>
    </div>
  )
}
