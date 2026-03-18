import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkRateLimit, getClientIdentifier, rateLimiters } from "@/lib/rate-limit";

const COOKIE_NAME = "eventa_admin_session";

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimitResult = await checkRateLimit(clientId, rateLimiters.admin);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimitResult.reset ? Math.ceil((rateLimitResult.reset - Date.now()) / 1000) : "a few"} seconds.` },
      { status: 429 }
    );
  }

  // Remove the cookie
  cookies().set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0, // forces delete
  });

  return NextResponse.json({ success: true, message: "Logged out" });
}
