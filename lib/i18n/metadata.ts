import { translations, type Locale } from "./translations"
import type { Metadata } from "next"

/**
 * Gets localized metadata for pages
 * @param titleKey - Translation key for the title
 * @param descriptionKey - Translation key for the description
 * @param locale - The locale to use (defaults to "en")
 * @returns Metadata object with localized title and description
 */
export async function getLocalizedMetadata(
  titleKey: string,
  descriptionKey: string,
  locale: Locale = "en",
): Promise<Metadata> {
  const t = translations[locale].metadata as any

  return {
    title: t[titleKey] || titleKey,
    description: t[descriptionKey] || descriptionKey,
  }
}
