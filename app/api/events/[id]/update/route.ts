import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const eventId = params.id;
  const formData = await req.formData();

  const token = formData.get("token")?.toString();
  const title = formData.get("title")?.toString();
  const description = formData.get("description")?.toString();

  if (!token) {
    return NextResponse.json(
      { error: "Missing edit token" },
      { status: 400 }
    );
  }

  const valid = await validateEventEditToken(eventId, token);

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid or expired edit token" },
      { status: 403 }
    );
  }

  await db.event.update({
    where: { id: eventId },
    data: {
      title,
      description,
    },
  });

  return NextResponse.redirect(
    new URL(`/events/${eventId}`, req.url),
    303
  );
}
