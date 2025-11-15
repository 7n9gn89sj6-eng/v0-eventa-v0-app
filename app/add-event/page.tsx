"use client"

import { Suspense } from "react"
import { AddEventFormWrapper } from "@/components/events/add-event-form-wrapper"
import type { Metadata } from "next"
import { useI18n } from "@/lib/i18n/context"

// Note: metadata export removed since this is now a client component
// Metadata would need to be handled differently for client components

export default function AddEventPage({
  searchParams,
}: {
  searchParams: { title?: string; description?: string; location?: string; date?: string; draft?: string }
}) {
  const { t } = useI18n()

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{t("form.sections.eventDetails")}</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          Share your event with the community. Fill in the details below and we'll send you a verification email to finish publishing.
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <AddEventFormWrapper initialData={searchParams} draftId={searchParams.draft} />
      </Suspense>
    </div>
  )
}
