import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "eventa_admin_session";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function getAdminInfo() {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded?.isAdmin) return null;

    return { email: decoded.email };
  } catch {
    return null;
  }
}
