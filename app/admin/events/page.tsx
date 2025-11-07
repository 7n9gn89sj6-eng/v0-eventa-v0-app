import { redirect } from "next/navigation"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { AdminEventsTable } from "@/components/admin/admin-events-table"

export const dynamic = "force-dynamic"

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
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

  const params = await searchParams
  const statusFilter = params.status

  const where: any = {}
  if (statusFilter && ["PENDING", "APPROVED", "FLAGGED", "REJECTED"].includes(statusFilter)) {
    where.moderationStatus = statusFilter
  }

  const events = await db.event.findMany({
    where,
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ moderationStatus: "asc" }, { moderatedAt: "desc" }, { createdAt: "desc" }],
  })

  const stats = {
    pending: await db.event.count({ where: { moderationStatus: "PENDING" } }),
    approved: await db.event.count({ where: { moderationStatus: "APPROVED" } }),
    flagged: await db.event.count({ where: { moderationStatus: "FLAGGED" } }),
    rejected: await db.event.count({ where: { moderationStatus: "REJECTED" } }),
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Event Moderation Dashboard</h1>
        <p className="text-muted-foreground">Review and moderate submitted events</p>
      </div>

      <AdminEventsTable events={events} stats={stats} currentFilter={statusFilter} />
    </div>
  )
}
