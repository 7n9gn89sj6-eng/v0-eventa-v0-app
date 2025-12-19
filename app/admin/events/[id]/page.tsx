import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/jwt";
import { db } from "@/lib/db";
import { AdminEventReview } from "@/components/admin/admin-event-review";

export const dynamic = "force-dynamic";

export default async function AdminEventReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  /* ------------------------- AUTH ------------------------- */

  const session = await getSession();
  if (!session) redirect("/verify");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true, id: true, email: true },
  });

  if (!user?.isAdmin) redirect("/");

  /* ------------------------- PARAMS ------------------------- */

  const { id } = await params;

  /* ------------------------- FETCH EVENT ------------------------- */

  const event = await db.event.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
          id: true,
        },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      appeals: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!event) notFound();

  /* ------------------------- CHECK EMBEDDING STATUS ------------------------- */

  // Check if embedding exists using raw SQL (Prisma doesn't support vector type in select)
  let hasEmbedding = false;
  try {
    const result = await db.$queryRawUnsafe<Array<{ has_embedding: boolean }>>(
      `SELECT (embedding IS NOT NULL) as has_embedding FROM "Event" WHERE id = $1`,
      id,
    );
    hasEmbedding = result[0]?.has_embedding ?? false;
  } catch (error) {
    console.warn("[admin] Failed to check embedding status:", error);
    // Default to false if check fails
  }

  // Add embedding status to event object for component
  const eventWithEmbedding = {
    ...event,
    hasEmbedding,
  };

  /* ------------------------- RENDER ------------------------- */

  return (
    <div className="container mx-auto px-4 py-12">
      <AdminEventReview
        event={eventWithEmbedding}
        adminId={user.id}
        adminEmail={user.email}
      />
    </div>
  );
}
