import { type NextRequest, NextResponse } from "next/server"

const locales = ["en"] as const
type Locale = (typeof locales)[number]

function parseAcceptLanguage(acceptLanguage: string | null): Locale {
  return "en"
}

export function middleware(request: NextRequest) {
  const locale: Locale = "en"

  // Create response without modifying URL
  const response = NextResponse.next()

  // Expose locale to server components via custom header
  response.headers.set("x-locale", locale)

  // Ensure cookie is set for future requests
  if (!request.cookies.get("NEXT_LOCALE")) {
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 31536000, // 1 year
    })
  }

  return response
}

export const config = {
  // Match all paths except static files and API routes
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
