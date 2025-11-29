// app/discover/page.tsx

import { Suspense } from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

export default async function DiscoverPage(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          {searchParams.q ? `Results for "${searchParams.q}"` : "Discover Events"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {searchParams.q
            ? "Here's what we found for your search"
            : "Browse upcoming events in your area and beyond"}
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner size="lg" className="py-12" />}>
        <EventsListingContent
          initialQuery={searchParams.q}
          initialCity={searchParams.city}
          initialCategory={searchParams.category}
          initialDateFrom={searchParams.date_from}
          initialDateTo={searchParams.date_to}
          userLat={searchParams.lat ? Number.parseFloat(searchParams.lat) : undefined}
          userLng={searchParams.lng ? Number.parseFloat(searchParams.lng) : undefined}
        />
      </Suspense>
    </div>
  )
}
