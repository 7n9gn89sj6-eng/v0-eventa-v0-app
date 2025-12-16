import { NextResponse } from "next/server";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handleUpdate(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
  const eventId = params.id;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing edit token" },
      { status: 401 }
    );
  }

  const valid = await validateEventEditToken(eventId, token);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { title, description } = body;

  if (!title) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  try {
    const event = await db.event.update({
      where: { id: eventId },
      data: {
        title,
        description,
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("[events/update] Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, ctx);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, ctx);
}
