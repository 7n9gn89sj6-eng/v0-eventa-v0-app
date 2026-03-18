// app/api/admin/events/[id]/analyze/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { db } from "@/lib/db";
import { analyzeEventContent } from "@/lib/ai-moderation";
import { checkRateLimit, getClientIdentifier, rateLimiters } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(clientId, rateLimiters.admin);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateLimitResult.reset ? Math.ceil((rateLimitResult.reset - Date.now()) / 1000) : "a few"} seconds.` },
        { status: 429 }
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const event = await db.event.findUnique({
      where: { id },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const analysis = await analyzeEventContent({
      title: event.title,
      description: event.description,
      city: event.city,
      country: event.country,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Error analyzing event:", error);
    return NextResponse.json({ error: "Failed to analyze event" }, { status: 500 });
  }
}

