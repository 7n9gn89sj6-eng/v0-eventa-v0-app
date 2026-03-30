"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SimpleEventCreator } from "@/components/events/simple-event-creator"
import { useI18n } from "@/lib/i18n/context"

function ExpiredDraftNotice() {
  const searchParams = useSearchParams()
  if (searchParams.get("reason") !== "expired") return null
  return (
    <p className="mb-6 text-sm text-muted-foreground" role="status">
      Your in-progress event was not found in this browser. Please recreate it.
    </p>
  )
}

export default function CreateSimplePage() {
  const { t } = useI18n()
  const tForm = t("form")

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={null}>
          <ExpiredDraftNotice />
        </Suspense>
        <div className="mb-8">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {tForm("page.createSimpleTitle")}
          </h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            {tForm("page.createSimpleSubtitle")}
          </p>
        </div>

        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              Loading…
            </p>
          }
        >
          <SimpleEventCreator />
        </Suspense>
      </div>
    </div>
  )
}
