"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Search, MapPin } from "lucide-react"

interface SearchHeroProps {
  onSearch: (query: string) => void
  onLocationRequest: () => void
  initialQuery?: string
  compact?: boolean
}

const EXAMPLE_QUERIES = [
  "markets this weekend",
  "free concerts",
  "food festivals",
  "art exhibitions",
  "workshops near me",
]

export function SearchHero({ onSearch, onLocationRequest, initialQuery = "", compact = false }: SearchHeroProps) {
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  const handleExampleClick = (example: string) => {
    setQuery(example)
    onSearch(example)
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask for events in your own words — any language"
            className="pl-10"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-muted/30 to-background px-4">
      <div className="w-full max-w-3xl text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Discover Events Near You
        </h1>
        <p className="mb-8 text-lg text-muted-foreground text-balance">
          Ask for events in your own words — any language. We search local listings and the web.
        </p>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., markets this weekend, fiesta gratuita, πανηγύρι Αθήνα..."
              className="h-14 pl-12 pr-32 text-lg"
            />
            <Button type="submit" size="lg" className="absolute right-1 top-1/2 -translate-y-1/2">
              Search
            </Button>
          </div>
        </form>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              {example}
            </button>
          ))}
        </div>

        <Button variant="outline" onClick={onLocationRequest} className="gap-2 bg-transparent">
          <MapPin className="h-4 w-4" />
          Use my location for better results
        </Button>

        <p className="mt-8 text-sm text-muted-foreground">
          We show Eventa listings first. You can also include results from the web.
        </p>
      </div>
    </div>
  )
}
