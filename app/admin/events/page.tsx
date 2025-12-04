import { redirect } from "next/navigation";
import { getSession } from "@/lib/jwt";
import { db } from "@/lib/db";
import { AdminEventsTable } from "@/components/admin/admin-events-table";
import { AdminSearchFilter } from "@/components/admin/admin-search-filter";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const currentTab = params.tab || "needs-review";
  const currentPage = parseInt(params.page || "1", 10);
  const searchTerm = params.search || "";
  const itemsPerPage = 20;

  /* ------------------------- AUTH CHECK ------------------------- */

  const session = await getSession();
  if (!session) redirect("/verify");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) redirect("/");

  /* ------------------------- FILTER BUILDER ------------------------- */

  let where: any = {};

  switch (currentTab) {
    case "needs-review":
      where = { aiStatus: "NEEDS_REVIEW" };
      break;

    case "ai-rejected":
      where = { aiStatus: "REJECTED" };
      break;

    case "auto-approved":
      where = { aiStatus: "SAFE" };
      break;

    case "all":
    default:
      where = {};
  }

  if (searchTerm) {
    where.OR = [
      { title: { contains: searchTerm, mode: "insensitive" } },
      { city: { contains: searchTerm, mode: "insensitive" } },
      { country: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  /* ------------------------- PAGINATION ------------------------- */

  const totalFilteredEvents = await db.event.count({ where });
  const totalPages = Math.ceil(totalFilteredEvents / itemsPerPage);

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
    orderBy: [{ createdAt: "desc" }],
    skip: (currentPage - 1) * itemsPerPage,
    take: itemsPerPage,
  });

  /* ------------------------- STATS ------------------------- */

  const stats = {
    needsReview: await db.event.count({
      where: { aiStatus: "NEEDS_REVIEW" },
    }),
    aiRejected: await db.event.count({
      where: { aiStatus: "REJECTED" },
    }),
    autoApproved: await db.event.count({
      where: { aiStatus: "SAFE" },
    }),
    all: await db.event.count(),
  };

  /* ------------------------- RENDER ------------------------- */

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Event Moderation</h1>
        <p className="text-muted-foreground">
          Review and manage event submissions
        </p>
      </div>

      <div className="mb-6">
        <AdminSearchFilter initialSearch={searchTerm} />
      </div>

      <AdminEventsTable
        events={events}
        stats={stats}
        currentTab={currentTab}
        currentPage={currentPage}
        totalPages={totalPages}
      />
    </div>
  );
}
