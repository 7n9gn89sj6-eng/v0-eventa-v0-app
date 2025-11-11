import { redirect } from "next/navigation"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AdminEventActions } from "@/components/admin/admin-event-actions"
import { AIModerationSummary } from "@/components/admin/ai-moderation-summary"
import { AIEventAnalysis } from "@/components/admin/ai-event-analysis"
import ClientOnly from "@/components/ClientOnly"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getSession()

  if (!session) {
    redirect("/verify")
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  })

  if (!user?.isAdmin) {
    redirect("/")
  }

  const events = await db.event.findMany({
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const stats = {
    total: events.length,
    published: events.filter((e) => e.status === "PUBLISHED").length,
    draft: events.filter((e) => e.status === "DRAFT").length,
    archived: events.filter((e) => e.status === "ARCHIVED").length,
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">AI-powered event moderation and management</p>
      </div>

      <div className="mb-8">
        <AIModerationSummary />
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Events</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Published</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.published}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Drafts</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats.draft}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Archived</CardDescription>
            <CardTitle className="text-3xl text-gray-600">{stats.archived}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      variant={
                        event.status === "PUBLISHED" ? "default" : event.status === "DRAFT" ? "secondary" : "outline"
                      }
                    >
                      {event.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      by {event.createdBy.name || event.createdBy.email}
                    </span>
                  </div>
                  <CardTitle className="mb-2">
                    <Link href={`/events/${event.id}`} className="hover:underline">
                      {event.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <AIEventAnalysis eventId={event.id} />
                  <AdminEventActions eventId={event.id} currentStatus={event.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <span className="font-medium">Location:</span> {event.city}, {event.country}
                </div>
                <div>
                  <span className="font-medium">Start:</span>{" "}
                  <ClientOnly>{new Date(event.startAt).toLocaleDateString()}</ClientOnly>
                </div>
                <div>
                  <span className="font-medium">Created:</span>{" "}
                  <ClientOnly>{new Date(event.createdAt).toLocaleDateString()}</ClientOnly>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
