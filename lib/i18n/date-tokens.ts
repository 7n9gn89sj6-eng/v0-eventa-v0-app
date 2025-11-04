/**
 * Multilingual date tokens for parsing natural language dates
 * Maps localized terms to English equivalents for normalization
 */

export type Locale = "en" | "el" | "it" | "es" | "fr"

// Relative date terms
export const relativeDateTokens: Record<Locale, Record<string, string>> = {
  en: {
    today: "today",
    tomorrow: "tomorrow",
    "this weekend": "this weekend",
    "next week": "next week",
    "next month": "next month",
  },
  el: {
    σήμερα: "today",
    αύριο: "tomorrow",
    "αυτό το σαββατοκύριακο": "this weekend",
    "το σαββατοκύριακο": "this weekend",
    "την επόμενη εβδομάδα": "next week",
    "επόμενη εβδομάδα": "next week",
    "τον επόμενο μήνα": "next month",
    "επόμενο μήνα": "next month",
  },
  it: {
    oggi: "today",
    domani: "tomorrow",
    "questo weekend": "this weekend",
    "questo fine settimana": "this weekend",
    "la prossima settimana": "next week",
    "prossima settimana": "next week",
    "il prossimo mese": "next month",
    "prossimo mese": "next month",
  },
  es: {
    hoy: "today",
    mañana: "tomorrow",
    "este fin de semana": "this weekend",
    "este finde": "this weekend",
    "la próxima semana": "next week",
    "próxima semana": "next week",
    "el próximo mes": "next month",
    "próximo mes": "next month",
  },
  fr: {
    "aujourd'hui": "today",
    aujourdhui: "today",
    demain: "tomorrow",
    "ce week-end": "this weekend",
    "ce weekend": "this weekend",
    "la semaine prochaine": "next week",
    "semaine prochaine": "next week",
    "le mois prochain": "next month",
    "mois prochain": "next month",
  },
}

// Day names
export const dayTokens: Record<Locale, Record<string, string>> = {
  en: {
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday",
  },
  el: {
    δευτέρα: "monday",
    τρίτη: "tuesday",
    τετάρτη: "wednesday",
    πέμπτη: "thursday",
    παρασκευή: "friday",
    σάββατο: "saturday",
    κυριακή: "sunday",
  },
  it: {
    lunedì: "monday",
    lunedi: "monday",
    martedì: "tuesday",
    martedi: "tuesday",
    mercoledì: "wednesday",
    mercoledi: "wednesday",
    giovedì: "thursday",
    giovedi: "thursday",
    venerdì: "friday",
    venerdi: "friday",
    sabato: "saturday",
    domenica: "sunday",
  },
  es: {
    lunes: "monday",
    martes: "tuesday",
    miércoles: "wednesday",
    miercoles: "wednesday",
    jueves: "thursday",
    viernes: "friday",
    sábado: "saturday",
    sabado: "saturday",
    domingo: "sunday",
  },
  fr: {
    lundi: "monday",
    mardi: "tuesday",
    mercredi: "wednesday",
    jeudi: "thursday",
    vendredi: "friday",
    samedi: "saturday",
    dimanche: "sunday",
  },
}

// Month names
export const monthTokens: Record<Locale, Record<string, number>> = {
  en: {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  },
  el: {
    ιανουάριος: 0,
    ιανουαριος: 0,
    φεβρουάριος: 1,
    φεβρουαριος: 1,
    μάρτιος: 2,
    μαρτιος: 2,
    απρίλιος: 3,
    απριλιος: 3,
    μάιος: 4,
    μαιος: 4,
    ιούνιος: 5,
    ιουνιος: 5,
    ιούλιος: 6,
    ιουλιος: 6,
    αύγουστος: 7,
    αυγουστος: 7,
    σεπτέμβριος: 8,
    σεπτεμβριος: 8,
    οκτώβριος: 9,
    οκτωβριος: 9,
    νοέμβριος: 10,
    νοεμβριος: 10,
    δεκέμβριος: 11,
    δεκεμβριος: 11,
  },
  it: {
    gennaio: 0,
    febbraio: 1,
    marzo: 2,
    aprile: 3,
    maggio: 4,
    giugno: 5,
    luglio: 6,
    agosto: 7,
    settembre: 8,
    ottobre: 9,
    novembre: 10,
    dicembre: 11,
    gen: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    mag: 4,
    giu: 5,
    lug: 6,
    ago: 7,
    set: 8,
    ott: 9,
    nov: 10,
    dic: 11,
  },
  es: {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
    ene: 0,
    feb: 1,
    mar: 2,
    abr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dic: 11,
  },
  fr: {
    janvier: 0,
    février: 1,
    fevrier: 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    août: 7,
    aout: 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    décembre: 11,
    decembre: 11,
    janv: 0,
    févr: 1,
    fevr: 1,
    avr: 3,
    juil: 6,
    sept: 8,
    oct: 9,
    nov: 10,
    déc: 11,
    dec: 11,
  },
}

// Modifiers (this/next)
export const modifierTokens: Record<Locale, Record<string, string>> = {
  en: {
    this: "this",
    next: "next",
  },
  el: {
    αυτό: "this",
    αυτη: "this",
    αυτην: "this",
    επόμενο: "next",
    επόμενη: "next",
    επόμενην: "next",
  },
  it: {
    questo: "this",
    questa: "this",
    prossimo: "next",
    prossima: "next",
  },
  es: {
    este: "this",
    esta: "this",
    próximo: "next",
    próxima: "next",
    proximo: "next",
    proxima: "next",
  },
  fr: {
    ce: "this",
    cette: "this",
    prochain: "next",
    prochaine: "next",
  },
}

/**
 * Normalize a multilingual date phrase to English
 * @param phrase - The input phrase in any supported language
 * @returns Normalized English phrase
 */
export function normalizeMultilingualDate(phrase: string): string {
  const lower = phrase.toLowerCase().trim()

  // Try to match relative date tokens first (longer phrases)
  for (const locale of Object.keys(relativeDateTokens) as Locale[]) {
    const tokens = relativeDateTokens[locale]
    for (const [foreign, english] of Object.entries(tokens)) {
      if (lower === foreign || lower.includes(foreign)) {
        return english
      }
    }
  }

  // Try to match day + modifier patterns (e.g., "next monday", "prossimo lunedì")
  for (const locale of Object.keys(dayTokens) as Locale[]) {
    const days = dayTokens[locale]
    const modifiers = modifierTokens[locale]

    for (const [foreignDay, englishDay] of Object.entries(days)) {
      for (const [foreignMod, englishMod] of Object.entries(modifiers)) {
        // Match "modifier day" or "day modifier"
        const pattern1 = `${foreignMod} ${foreignDay}`
        const pattern2 = `${foreignDay} ${foreignMod}`

        if (lower.includes(pattern1) || lower.includes(pattern2)) {
          return `${englishMod} ${englishDay}`
        }
      }

      // Match standalone day (assume "this")
      if (lower === foreignDay) {
        return `this ${englishDay}`
      }
    }
  }

  // Try to match month patterns (e.g., "15 marzo", "marzo 15")
  for (const locale of Object.keys(monthTokens) as Locale[]) {
    const months = monthTokens[locale]

    for (const [foreignMonth, monthIndex] of Object.entries(months)) {
      if (lower.includes(foreignMonth)) {
        // Extract day number if present
        const dayMatch = lower.match(/\b(\d{1,2})\b/)
        if (dayMatch) {
          const day = Number.parseInt(dayMatch[1])
          const now = new Date()
          const targetDate = new Date(now.getFullYear(), monthIndex, day)

          // If the date has passed this year, assume next year
          if (targetDate < now) {
            targetDate.setFullYear(targetDate.getFullYear() + 1)
          }

          return targetDate.toISOString().split("T")[0]
        }
      }
    }
  }

  // Return original if no match found
  return phrase
}
