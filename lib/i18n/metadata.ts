import { getTranslations } from "next-intl/server"
import type { Metadata } from "next"

export async function getLocalizedMetadata(
  titleKey: string,
  descriptionKey: string,
  namespace = "metadata",
): Promise<Metadata> {
  const t = await getTranslations(namespace)

  return {
    title: t(titleKey),
    description: t(descriptionKey),
  }
}
