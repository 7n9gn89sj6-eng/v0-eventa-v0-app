import { Suspense } from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

type SearchParams = {
  q?: string
  city?: string
  country?: string
  category?: string
  date_from?: string
  date_to?: string
}

/** URL-level filters (excluding q) for hero copy — matches Discover SSOT params. */
function discoverScopeSubtitle(p: SearchParams): string | null {
  const segments: string[] = []
  const city = p.city?.trim()
  const country = p.country?.trim()
  if (city || country) segments.push([city, country].filter(Boolean).join(", "))
  const cat = p.category?.trim()
  if (cat && cat.toLowerCase() !== "all") segments.push(cat)
  const from = p.date_from?.trim()
  if (from) {
    const d1 = new Date(from)
    if (!Number.isNaN(d1.getTime())) {
      const s1 = d1.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      const to = p.date_to?.trim()
      if (to) {
        const d2 = new Date(to)
        segments.push(
          !Number.isNaN(d2.getTime())
            ? `${s1}–${d2.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : s1,
        )
      } else {
        segments.push(s1)
      }
    }
  }
  if (segments.length === 0) return null
  return `Filtered by ${segments.join(" · ")}`
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const scopeLine = discoverScopeSubtitle(params)

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          {params.q ? `Results for "${params.q}"` : "Discover Events"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {params.q ? "Here's what we found for your search" : "Browse upcoming events in your area and beyond"}
        </p>
        {scopeLine ? (
          <p className="text-base text-muted-foreground mt-2 max-w-3xl">{scopeLine}</p>
        ) : null}
      </div>

      <Suspense fallback={<LoadingSpinner size="lg" className="py-12" />}>
        <EventsListingContent
          initialQuery={params.q}
          initialCity={params.city}
          initialCountry={params.country}
          initialCategory={params.category}
          initialDateFrom={params.date_from}
          initialDateTo={params.date_to}
        />
      </Suspense>
    </div>
  )
}
