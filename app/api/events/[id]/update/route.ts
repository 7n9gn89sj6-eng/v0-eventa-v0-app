import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const formData = await req.formData();

  const token = formData.get("token")?.toString();
  const title = formData.get("title")?.toString();
  const description = formData.get("description")?.toString();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const valid = await validateEventEditToken(id, token);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 403 }
    );
  }

  await db.event.update({
    where: { id },
    data: {
      title,
      description,
    },
  });

  // ✅ IMPORTANT: return HTML redirect, not NextResponse.redirect
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/events/${id}`,
    },
  });
}
