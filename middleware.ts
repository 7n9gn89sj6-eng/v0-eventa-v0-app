import { type NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Prevent clickjacking attacks
  response.headers.set("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // Enable XSS protection
  response.headers.set("X-XSS-Protection", "1; mode=block")

  // Referrer policy for privacy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://vercel.live https://va.vercel-scripts.com; frame-src 'self' https://vercel.live;",
  )

  // Set locale header for English-only app
  response.headers.set("x-locale", "en")

  // Set locale cookie if not present
  if (!request.cookies.get("NEXT_LOCALE")) {
    response.cookies.set("NEXT_LOCALE", "en", {
      path: "/",
      maxAge: 31536000, // 1 year
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }

  return response
}

export const config = {
  // Match all paths except static files and API routes
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
