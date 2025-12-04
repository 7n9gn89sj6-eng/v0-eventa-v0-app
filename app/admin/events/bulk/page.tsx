import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import BulkReviewClient from "@/components/admin/bulk-review-client";

export const dynamic = "force-dynamic";

export default async function BulkReviewPage() {
  const session = await getSession();
  if (!session) redirect("/verify");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) redirect("/");

  const events = await db.event.findMany({
    where: {
      aiStatus: { in: ["NEEDS_REVIEW", "PENDING", "REJECTED"] },
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdBy: {
        select: { email: true, name: true },
      },
    },
  });

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Bulk Review</h1>
      <p className="text-muted-foreground mb-8">
        Select multiple events and apply a bulk moderation action.
      </p>

      <BulkReviewClient events={events} />
    </div>
  );
}
