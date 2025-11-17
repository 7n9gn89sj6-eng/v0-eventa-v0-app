import { use, Suspense } from "react"
import { AddEventFormWrapper } from "@/components/events/add-event-form-wrapper"


export default function AddEventPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; description?: string; location?: string; date?: string; draft?: string }>
}) {
  const params = use(searchParams)

  const initialData = {
    title: params.title,
    description: params.description,
    location: params.location,
    date: params.date,
  }
  
  const draftId = params.draft

  return (
    <Suspense fallback={<div className="container mx-auto max-w-2xl px-4 py-8">Loading...</div>}>
      <AddEventFormWrapper initialData={initialData} draftId={draftId} />
    </Suspense>
  )
}
