"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AddEventForm } from "@/components/events/add-event-form"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/context"

interface AddEventFormWrapperProps {
  initialData?: {
    title?: string
    description?: string
    location?: string
    date?: string
  }
  draftId?: string
}

export function AddEventFormWrapper({ initialData, draftId }: AddEventFormWrapperProps) {
  const { t } = useI18n()
  const tForm = t("form")
  const [draftData, setDraftData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(!!draftId)
  const [draftNotFound, setDraftNotFound] = useState(false)

  useEffect(() => {
    if (!draftId || typeof window === "undefined") {
      setIsLoading(false)
      return
    }

    try {
      const saved = localStorage.getItem("eventa-drafts")
      if (!saved) {
        setDraftNotFound(true)
        return
      }
      const drafts = JSON.parse(saved)
      const draft = Array.isArray(drafts) ? drafts.find((d: any) => d.id === draftId) : null
      if (!draft) {
        setDraftNotFound(true)
        return
      }
      // Convert draft format to form format (unchanged mapping)
      const formattedDate = `${draft.date}T${draft.time}`
      const endDate = new Date(new Date(formattedDate).getTime() + 2 * 60 * 60 * 1000)

      setDraftData({
        title: draft.title,
        description: draft.description || "",
        location: draft.city,
        date: formattedDate,
        city: draft.city,
        venue: draft.venue,
        startAt: formattedDate,
        endAt: endDate.toISOString().slice(0, 16),
      })
    } catch {
      setDraftNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }, [draftId])

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">Loading draft…</p>
      </div>
    )
  }

  if (draftNotFound) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <p className="text-pretty text-muted-foreground">
          This draft could not be found or has expired.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/add-event">Start new event</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/create-simple">Use simple creator</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{tForm("page.title")}</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          {tForm("page.subtitle")}
        </p>
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          {tForm("page.aiAssistPrefix")}
          <Link
            href="/create-simple"
            className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
          >
            {tForm("page.aiAssistLink")}
          </Link>
        </p>
      </div>
      <AddEventForm initialData={draftData || initialData} />
    </div>
  )
}
