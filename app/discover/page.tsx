import { Suspense } from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

type SearchParams = {
  q?: string
  city?: string
  category?: string
  date_from?: string
  date_to?: string
  lat?: string
  lng?: string
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          {params.q ? `Results for "${params.q}"` : "Discover Events"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {params.q ? "Here's what we found for your search" : "Browse upcoming events in your area and beyond"}
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner size="lg" className="py-12" />}>
        <EventsListingContent
          initialQuery={params.q}
          initialCity={params.city}
          initialCategory={params.category}
          initialDateFrom={params.date_from}
          initialDateTo={params.date_to}
          userLat={params.lat ? Number.parseFloat(params.lat) : undefined}
          userLng={params.lng ? Number.parseFloat(params.lng) : undefined}
        />
      </Suspense>
    </div>
  )
}
