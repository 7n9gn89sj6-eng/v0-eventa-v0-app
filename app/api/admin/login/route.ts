// app/api/admin/login/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAdminJwt, setAdminCookie } from "@/lib/jwt";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const admin = await db.user.findUnique({ where: { email } });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Not an admin" }, { status: 401 });
    }

    const isMatch = admin.adminPassword
      ? password === admin.adminPassword // plaintext fallback
      : await bcrypt.compare(password, admin.adminPasswordHash || "");

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = createAdminJwt(admin.id);

    // Set encrypted cookie
    setAdminCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
