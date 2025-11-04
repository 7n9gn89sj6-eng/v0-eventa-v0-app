import { type NextRequest, NextResponse } from "next/server"

const locales = ["en", "it", "el", "es", "fr"] as const
type Locale = (typeof locales)[number]

function parseAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return "en"

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,it;q=0.8")
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, qValue] = lang.trim().split(";")
      const quality = qValue ? Number.parseFloat(qValue.split("=")[1]) : 1.0
      return { code: code.split("-")[0].toLowerCase(), quality }
    })
    .sort((a, b) => b.quality - a.quality)

  // Find first matching supported locale
  for (const { code } of languages) {
    if (locales.includes(code as Locale)) {
      return code as Locale
    }
  }

  return "en"
}

export function middleware(request: NextRequest) {
  // 1. Check NEXT_LOCALE cookie first
  let locale: Locale = request.cookies.get("NEXT_LOCALE")?.value as Locale

  // 2. Fall back to Accept-Language header
  if (!locale || !locales.includes(locale)) {
    const acceptLanguage = request.headers.get("accept-language")
    locale = parseAcceptLanguage(acceptLanguage)
  }

  // 3. Default to 'en' if still not set
  if (!locale || !locales.includes(locale)) {
    locale = "en"
  }

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
