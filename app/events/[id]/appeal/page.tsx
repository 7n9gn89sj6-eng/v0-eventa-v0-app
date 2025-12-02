import { redirect, notFound } from "next/navigation"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { AppealForm } from "@/components/events/appeal-form"

export const dynamic = "force-dynamic"

export default async function EventAppealPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()

  if (!session) {
    redirect("/verify")
  }

  const { id } = await params

  const event = await db.event.findUnique({
    where: { id },
    include: {
      appeals: {
        where: {
          userId: session.userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  })

  if (!event) {
    notFound()
  }

  // Only allow appeals for rejected events
  if (event.moderationStatus !== "REJECTED") {
    redirect(`/events/${id}`)
  }

  // Only allow creator to appeal
  if (event.createdById !== session.userId) {
    redirect(`/events/${id}`)
  }

  const existingAppeal = event.appeals[0]

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Appeal Event Rejection</h1>
      <p className="text-muted-foreground mb-8">Submit an appeal if you believe your event was incorrectly rejected</p>

      <AppealForm eventId={id} existingAppeal={existingAppeal} />
    </div>
  )
}
