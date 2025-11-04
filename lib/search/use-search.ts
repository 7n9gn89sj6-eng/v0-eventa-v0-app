"use client"

import useSWR from "swr"
import type { SearchResponse, SearchFilters } from "@/lib/types"

interface UseSearchOptions {
  query: string
  filters?: SearchFilters
  includeWeb?: boolean
  userLat?: number
  userLng?: number
}

async function searchFetcher(options: UseSearchOptions): Promise<SearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  })

  if (!response.ok) {
    throw new Error("Search failed")
  }

  return response.json()
}

export function useSearch(options: UseSearchOptions) {
  const { data, error, isLoading, mutate } = useSWR(
    options.query ? ["search", options] : null,
    () => searchFetcher(options),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    },
  )

  return {
    results: data?.results || [],
    usedWeb: data?.usedWeb || false,
    langDetected: data?.langDetected,
    totalResults: data?.totalResults || 0,
    isLoading,
    error,
    refetch: mutate,
  }
}
