// FORCE NODE RUNTIME + FORCE DYNAMIC EXECUTION
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createAdminJwt, setAdminCookie } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    console.log("---- LOGIN REQUEST RECEIVED ----");

    const body = await request.json().catch((err) => {
      console.error("ERROR PARSING JSON BODY:", err);
      return null;
    });

    console.log("LOGIN BODY:", body);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { email, password } = body;

    if (!email || !password) {
      console.log("MISSING FIELD:", { email, password });
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    console.log("LOOKING UP ADMIN BY EMAIL:", email);

    // Fetch admin from DB
    const admin = await db.user
      .findUnique({
        where: { email },
      })
      .catch((err) => {
        console.error("PRISMA findUnique ERROR:", err);
        throw err;
      });

    console.log("FOUND ADMIN:", admin ? admin.email : "NO USER FOUND");

    if (!admin || !admin.isAdmin) {
      console.log("ADMIN VALIDATION FAILED");
      return NextResponse.json(
        { error: "Not an admin" },
        { status: 401 }
      );
    }

    console.log("COMPARING PASSWORD WITH HASH...");

    const passwordMatch = await bcrypt
      .compare(password, admin.adminPassword)
      .catch((err) => {
        console.error("BCRYPT ERROR:", err);
        throw err;
      });

    console.log("PASSWORD MATCH RESULT:", passwordMatch);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    console.log("GENERATING ADMIN TOKEN...");

    // Create token + cookie
    const token = createAdminJwt(admin.id);

    console.log("SETTING COOKIE...");
    setAdminCookie(token);

    console.log("---- LOGIN SUCCESS ----");

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("🔥 SERVER LOGIN ERROR:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
