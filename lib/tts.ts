/**
 * Text-to-Speech utility using Web Speech API
 */

export function getSpeechLanguage(locale: string): string {
  const languageMap: Record<string, string> = {
    el: "el-GR",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    en: "en-US",
  }
  return languageMap[locale] || "en-US"
}

export interface TTSControls {
  speak: () => void
  stop: () => void
  isSpeaking: boolean
}

/**
 * Create TTS controls for a given text and locale
 * @param text - The text to speak
 * @param locale - The user's locale (e.g., "en", "el", "it")
 * @returns Controls to speak and stop the utterance
 */
export function createTTS(text: string, locale: string): TTSControls {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("[v0] Speech synthesis not available")
    return {
      speak: () => {},
      stop: () => {},
      isSpeaking: false,
    }
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = getSpeechLanguage(locale)
  utterance.rate = 1.0
  utterance.pitch = 1.0
  utterance.volume = 1.0

  return {
    speak: () => {
      // Cancel any ongoing speech first
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    stop: () => {
      window.speechSynthesis.cancel()
    },
    isSpeaking: window.speechSynthesis.speaking,
  }
}

/**
 * Simple helper to speak text immediately
 * @param text - The text to speak
 * @param locale - The user's locale
 */
export function speak(text: string, locale: string): void {
  const tts = createTTS(text, locale)
  tts.speak()
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }
}
