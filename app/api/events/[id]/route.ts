import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";

/* ----------------------------------------------------------
   PUT — edit event via token (used by Edit page)
---------------------------------------------------------- */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const token =
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing edit token" },
        { status: 401 }
      );
    }

    const valid = await validateEventEditToken(id, token);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 403 }
      );
    }

    const updated = await db.event.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
      },
    });

    return NextResponse.json({ event: updated });
  } catch (err) {
    console.error("[edit PUT] error:", err);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}
