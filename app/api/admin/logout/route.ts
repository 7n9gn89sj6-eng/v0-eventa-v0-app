import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "eventa_admin_session";

export async function POST() {
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
