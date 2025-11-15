"use client"

import { Suspense } from "react"
import { EventsListingContent } from "@/components/events/events-listing-content"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useI18n } from "@/lib/i18n/context"

export const dynamic = "force-dynamic"

export default function EventsPage() {
  const { t } = useI18n()

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t("events.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("events.subtitle")}</p>
      </div>

      <Suspense fallback={<LoadingSpinner size="lg" className="py-12" />}>
        <EventsListingContent />
      </Suspense>
    </div>
  )
}
