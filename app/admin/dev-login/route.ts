import { NextResponse } from "next/server";
import { createSession } from "@/lib/jwt";
import { db } from "@/lib/db";

export async function GET() {
  const email = "pana2112gnostatos@gmail.com";


  // Ensure user exists
  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: "Dev Admin",
        isAdmin: true,
        isVerified: true,
      },
    });
  }

  // Ensure admin role
  if (!user.isAdmin) {
    await db.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    });
  }

  // Create session - createSession expects userId as a string
  const token = await createSession(user.id);

  const res = NextResponse.json({ ok: true, admin: email });
  res.cookies.set("eventa-session", token, {
    httpOnly: true,
    path: "/",
  });

  return res;
}
