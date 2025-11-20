import { Suspense } from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

export default function DiscoverPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          {searchParams.q ? `Results for "${searchParams.q}"` : "Discover Events"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {searchParams.q ? "Here's what we found for your search" : "Browse upcoming events in your area and beyond"}
        </p>
      </div>

      <Suspense fallback={<LoadingSpinner size="lg" className="py-12" />}>
        <EventsListingContent initialQuery={searchParams.q} />
      </Suspense>
    </div>
  )
}
