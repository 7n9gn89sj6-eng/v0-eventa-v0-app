import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"

export const locales = ["en"] as const
export type Locale = (typeof locales)[number]

export default getRequestConfig(async () => {
  const headersList = await headers()
  const cookieStore = await cookies()

  const localeFromHeader = headersList.get("x-locale") as Locale | null
  const localeFromCookie = cookieStore.get("NEXT_LOCALE")?.value as Locale | null

  const locale = (localeFromHeader || localeFromCookie || "en") as Locale

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
