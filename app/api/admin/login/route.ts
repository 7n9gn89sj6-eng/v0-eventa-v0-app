import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createAdminJwt, setAdminCookie } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    console.log("LOGIN REQUEST RECEIVED");

    const body = await request.json();
    console.log("LOGIN BODY:", body);

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    // Fetch user
    const admin = await db.user.findUnique({
      where: { email },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: "Not an admin" }, { status: 401 });
    }

    // Compare bcrypt hash correctly
    const isMatch = await bcrypt.compare(password, admin.adminPassword);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Create token + cookie
    const token = createAdminJwt(admin.id);
    setAdminCookie(token);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
