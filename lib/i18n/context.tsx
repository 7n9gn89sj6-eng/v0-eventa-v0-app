"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

import { translations, type Locale, type TranslationNamespace } from "./translations";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (namespace: TranslationNamespace) => (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const localeCookie = cookies.find((c) => c.startsWith("NEXT_LOCALE="));

    if (localeCookie) {
      const saved = localeCookie.split("=")[1] as Locale;
      if (saved in translations) setLocaleState(saved);
    } else {
      document.cookie =
        "NEXT_LOCALE=en; max-age=31536000; path=/; samesite=lax";
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    document.cookie = `NEXT_LOCALE=${newLocale}; max-age=31536000; path=/; samesite=lax`;
  };

  const t =
    (namespace: TranslationNamespace) =>
    (key: string, vars: Record<string, string | number> = {}) => {
      const ns = translations[locale][namespace];
      if (!ns) return key;

      const parts = key.split(".");
      let value: any = ns;

      for (const p of parts) {
        value = value?.[p];
      }

      if (!value) return key;
      if (typeof value !== "string") return key;

      // Replace variables {var}
      return value.replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ""));
    };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useTranslations(namespace: TranslationNamespace) {
  const { t } = useI18n();
  return t(namespace);
}

export function useLocale() {
  const { locale } = useI18n();
  return locale;
}
