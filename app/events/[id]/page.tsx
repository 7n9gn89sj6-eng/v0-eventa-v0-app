import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { EventDetail } from "@/components/events/event-detail"
import type { Metadata } from "next"
import { getSession } from "@/lib/jwt"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params

  const event = await db.event.findUnique({
    where: { id },
  })

  if (!event) {
    return {
      title: "Event Not Found - Eventa",
    }
  }

  return {
    title: `${event.title} - Eventa`,
    description: event.description.slice(0, 160),
  }
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; edited?: string }>
}) {
  const { id } = await params
  const { created, edited } = await searchParams

  const session = await getSession()

  const event = await db.event.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  if (!event) {
    notFound()
  }

  // Moderation logic
  if (event.moderationStatus === "FLAGGED" || event.moderationStatus === "REJECTED") {
    const isCreator = session && session.userId === event.createdById
    if (!isCreator) {
      notFound()
    }
  }

  let isFavorited = false

  if (session) {
    const favorite = await db.favorite.findUnique({
      where: {
        userId_eventId: {
          userId: session.userId,
          eventId: event.id,
        },
      },
    })
    isFavorited = !!favorite
  }

  return (
    <EventDetail
      event={event}
      showSuccessBanner={created === "true"}
      showEditedBanner={edited === "true"}
      isFavorited={isFavorited}
      hasSession={!!session}
    />
  )
}
