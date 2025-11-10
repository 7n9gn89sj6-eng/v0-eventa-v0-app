export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { status } = await request.json()

    if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const event = await db.event.update({
      where: { id: params.id },
      data: { status },
    })

    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error("Error updating event status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
