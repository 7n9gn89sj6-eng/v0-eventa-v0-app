import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: { email: true, isAdmin: true },
    });

    return NextResponse.json({ ok: true, users });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
    });
  }
}
