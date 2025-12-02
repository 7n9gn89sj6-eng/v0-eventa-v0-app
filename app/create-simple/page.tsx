import { Suspense } from "react"
import { SimpleEventCreator } from "@/components/events/simple-event-creator"

export default function CreateSimplePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">Create an event</h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            Just describe your event in plain language. We'll handle the rest.
          </p>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <SimpleEventCreator />
        </Suspense>
      </div>
    </div>
  )
}
