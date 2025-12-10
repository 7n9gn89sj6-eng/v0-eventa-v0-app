import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TEMPORARY: Admin authentication disabled for beta testing.
// Keeping imports but removing all auth enforcement.

export function middleware(req: NextRequest) {
  // Allow all admin routes without restriction
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
