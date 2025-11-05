"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { translations, type Locale, type TranslationNamespace } from "./translations"

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (namespace: TranslationNamespace) => (key: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    // Read locale from cookie on mount
    const cookies = document.cookie.split("; ")
    const localeCookie = cookies.find((c) => c.startsWith("NEXT_LOCALE="))
    if (localeCookie) {
      const savedLocale = localeCookie.split("=")[1] as Locale
      if (savedLocale in translations) {
        setLocaleState(savedLocale)
      }
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    document.cookie = `NEXT_LOCALE=${newLocale}; max-age=31536000; path=/; samesite=lax`
  }

  const t = (namespace: TranslationNamespace) => (key: string) => {
    const keys = key.split(".")
    let value: any = translations[locale][namespace]

    for (const k of keys) {
      value = value?.[k]
    }

    return typeof value === "string" ? value : key
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return context
}

export function useTranslations(namespace: TranslationNamespace) {
  const { t } = useI18n()
  return t(namespace)
}

export function useLocale() {
  const { locale } = useI18n()
  return locale
}
