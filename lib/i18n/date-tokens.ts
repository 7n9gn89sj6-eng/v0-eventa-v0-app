/**
 * Normalizes multilingual date phrases to English equivalents
 * This helps the date parser understand dates in multiple languages
 */
export function normalizeMultilingualDate(phrase: string): string {
  const normalized = phrase.toLowerCase().trim()

  // Italian translations
  const italianMap: Record<string, string> = {
    oggi: "today",
    domani: "tomorrow",
    "questo fine settimana": "this weekend",
    "prossimo mese": "next month",
    lunedì: "monday",
    martedì: "tuesday",
    mercoledì: "wednesday",
    giovedì: "thursday",
    venerdì: "friday",
    sabato: "saturday",
    domenica: "sunday",
    "questo lunedì": "this monday",
    "questo martedì": "this tuesday",
    "questo mercoledì": "this wednesday",
    "questo giovedì": "this thursday",
    "questo venerdì": "this friday",
    "questo sabato": "this saturday",
    "questa domenica": "this sunday",
    "prossimo lunedì": "next monday",
    "prossimo martedì": "next tuesday",
    "prossimo mercoledì": "next wednesday",
    "prossimo giovedì": "next thursday",
    "prossimo venerdì": "next friday",
    "prossimo sabato": "next saturday",
    "prossima domenica": "next sunday",
    gennaio: "january",
    febbraio: "february",
    marzo: "march",
    aprile: "april",
    maggio: "may",
    giugno: "june",
    luglio: "july",
    agosto: "august",
    settembre: "september",
    ottobre: "october",
    novembre: "november",
    dicembre: "december",
  }

  // Greek translations
  const greekMap: Record<string, string> = {
    σήμερα: "today",
    αύριο: "tomorrow",
    "αυτό το σαββατοκύριακο": "this weekend",
    "επόμενο μήνα": "next month",
    δευτέρα: "monday",
    τρίτη: "tuesday",
    τετάρτη: "wednesday",
    πέμπτη: "thursday",
    παρασκευή: "friday",
    σάββατο: "saturday",
    κυριακή: "sunday",
    ιανουάριος: "january",
    φεβρουάριος: "february",
    μάρτιος: "march",
    απρίλιος: "april",
    μάιος: "may",
    ιούνιος: "june",
    ιούλιος: "july",
    αύγουστος: "august",
    σεπτέμβριος: "september",
    οκτώβριος: "october",
    νοέμβριος: "november",
    δεκέμβριος: "december",
  }

  // Spanish translations
  const spanishMap: Record<string, string> = {
    hoy: "today",
    mañana: "tomorrow",
    "este fin de semana": "this weekend",
    "próximo mes": "next month",
    lunes: "monday",
    martes: "tuesday",
    miércoles: "wednesday",
    jueves: "thursday",
    viernes: "friday",
    sábado: "saturday",
    domingo: "sunday",
    enero: "january",
    febrero: "february",
    marzo: "march",
    abril: "april",
    mayo: "may",
    junio: "june",
    julio: "july",
    agosto: "august",
    septiembre: "september",
    octubre: "october",
    noviembre: "november",
    diciembre: "december",
  }

  // French translations
  const frenchMap: Record<string, string> = {
    "aujourd'hui": "today",
    demain: "tomorrow",
    "ce week-end": "this weekend",
    "mois prochain": "next month",
    lundi: "monday",
    mardi: "tuesday",
    mercredi: "wednesday",
    jeudi: "thursday",
    vendredi: "friday",
    samedi: "saturday",
    dimanche: "sunday",
    janvier: "january",
    février: "february",
    mars: "march",
    avril: "april",
    mai: "may",
    juin: "june",
    juillet: "july",
    août: "august",
    septembre: "september",
    octobre: "october",
    novembre: "november",
    décembre: "december",
  }

  // Check all language maps
  const allMaps = [italianMap, greekMap, spanishMap, frenchMap]
  for (const map of allMaps) {
    if (map[normalized]) {
      return map[normalized]
    }
  }

  // Return original if no translation found
  return phrase
}
