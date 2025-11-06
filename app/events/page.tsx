import { Suspense } from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

export default function EventsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Browse Events</h1>
        <p className="text-lg text-muted-foreground">Discover upcoming events in your area and beyond</p>
      </div>

      <Suspense fallback={<LoadingSpinner size="lg" className="py-12" />}>
        <EventsListingContent />
      </Suspense>
    </div>
  )
}
