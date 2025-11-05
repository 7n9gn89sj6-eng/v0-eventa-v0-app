import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { EventDetail } from "@/components/events/event-detail"
import type { Metadata } from "next"
import { getSession } from "@/lib/jwt"

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { id } = await params
  const event = await prisma.event.findUnique({
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
  params: { id: string }
  searchParams: { created?: string }
}) {
  const { id } = await params
  const { created } = await searchParams

  const session = await getSession()

  const event = await prisma.event.findUnique({
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

  let isFavorited = false
  if (session) {
    const favorite = await prisma.favorite.findUnique({
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
      isFavorited={isFavorited}
      hasSession={!!session}
    />
  )
}
