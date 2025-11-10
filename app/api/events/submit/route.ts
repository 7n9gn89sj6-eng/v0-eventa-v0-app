// app/api/events/submit/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // never pre-render this

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // TODO: your logic here
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[submit] error:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

