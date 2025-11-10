"use client"

import { useEffect, useState } from "react"
import { AddEventForm } from "@/components/events/add-event-form"

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
  const [draftData, setDraftData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(!!draftId)

  useEffect(() => {
    if (draftId && typeof window !== "undefined") {
      const saved = localStorage.getItem("eventa-drafts")
      if (saved) {
        const drafts = JSON.parse(saved)
        const draft = drafts.find((d: any) => d.id === draftId)
        if (draft) {
          // Convert draft format to form format
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
        }
      }
      setIsLoading(false)
    }
  }, [draftId])

  if (isLoading) {
    return <div>Loading draft...</div>
  }

  return <AddEventForm initialData={draftData || initialData} />
}
