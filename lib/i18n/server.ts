import { translations, type Locale, type TranslationNamespace } from "./translations"

export async function getTranslations(namespace: TranslationNamespace, locale: Locale = "en") {
  return (key: string) => {
    const keys = key.split(".")
    let value: any = translations[locale][namespace]

    for (const k of keys) {
      value = value?.[k]
    }

    return typeof value === "string" ? value : key
  }
}

export async function getLocale(): Promise<Locale> {
  return "en"
}
