// lib/jwt.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/* =====================================================
   ADMIN AUTH (JWT-based)
===================================================== */

/** Create a signed admin JWT token */
export function createAdminJwt(adminId: string) {
  return jwt.sign(
    { userId: adminId, role: "admin" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/** Store the admin JWT in a secure cookie */
export function setAdminCookie(token: string) {
  cookies().set({
    name: "admin_token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/** Validate admin cookie and return decoded payload */
export async function getAdminSession() {
  const token = cookies().get("admin_token")?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
    };
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

/* =====================================================
   USER SESSION SYSTEM (database-backed)
===================================================== */

/**
 * Create a session record + set cookie
 * Used in:
 *  - /app/admin/dev-login/route.ts
 *  - /app/api/auth/verify/route.ts
 *  - /app/api/verify/route.ts
 */
export async function createSession(userId: string) {
  const sessionToken = crypto.randomUUID();

  // Save session in the database
  await db.session.create({
    data: {
      sessionToken,
      userId,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
    },
  });

  // Set session cookie
  cookies().set({
    name: "session",
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return sessionToken;
}

/**
 * Read + validate the session cookie
 * Returns: { userId } or null
 */
export async function getSession() {
  const token = cookies().get("session")?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { sessionToken: token },
    select: { userId: true, expires: true },
  });

  if (!session) return null;
  if (session.expires < new Date()) return null;

  return { userId: session.userId };
}
