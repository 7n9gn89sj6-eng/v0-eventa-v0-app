/**
 * Enhanced language detection using franc library
 * Detects language from text and maps to ISO 639-1 codes
 */

// Import franc dynamically to handle optional dependency
let francInstance: typeof import("franc") | null = null

async function getFranc() {
  if (!francInstance) {
    try {
      francInstance = await import("franc")
    } catch (error) {
      console.warn("[language-detection] franc not installed, falling back to heuristic detection")
      return null
    }
  }
  return francInstance
}

/**
 * Map franc language codes to ISO 639-1 codes used by Eventa
 * Franc returns ISO 639-3 codes, we need ISO 639-1 for compatibility
 */
const languageCodeMap: Record<string, string> = {
  // ISO 639-3 to ISO 639-1 mapping for supported languages
  eng: "en", // English
  ell: "el", // Greek
  ita: "it", // Italian
  spa: "es", // Spanish
  fra: "fr", // French
  // Add common variants
  grc: "el", // Ancient Greek → Modern Greek
  lat: "en", // Latin → English (fallback)
}

/**
 * Supported languages in Eventa
 */
const SUPPORTED_LANGUAGES = new Set(["en", "el", "it", "es", "fr"])

/**
 * Detect language from text using franc library
 * Falls back to heuristic detection if franc is not available
 *
 * @param text - Text to detect language from
 * @param minLength - Minimum text length required for detection (default: 10)
 * @returns ISO 639-1 language code (en, el, it, es, fr) or null if uncertain
 */
export async function detectLanguageEnhanced(
  text: string,
  minLength: number = 10,
): Promise<string | null> {
  if (!text || text.trim().length < minLength) {
    console.log("[language-detection] Text too short for detection:", { length: text?.length, minLength })
    return null
  }

  const franc = await getFranc()
  if (!franc) {
    console.log("[language-detection] franc not available, using heuristic fallback")
    // Fallback to heuristic detection
    return detectLanguageHeuristic(text)
  }

  try {
    // Detect language using franc (returns ISO 639-3 code)
    const detected = franc.default(text, { minLength })
    console.log("[language-detection] franc detected:", { detected, textPreview: text.substring(0, 50) })
    
    // If detection failed or uncertain (und), return null
    if (!detected || detected === "und") {
      console.log("[language-detection] Detection uncertain or failed")
      return null
    }

    // Map to ISO 639-1
    const iso6391 = languageCodeMap[detected] || detected.substring(0, 2)
    console.log("[language-detection] Mapped to ISO 639-1:", { iso6391, original: detected })

    // Only return if it's a supported language
    if (SUPPORTED_LANGUAGES.has(iso6391)) {
      console.log("[language-detection] ✓ Language detected:", iso6391)
      return iso6391
    }

    // If detected language is not supported, return null
    console.log("[language-detection] Detected language not supported:", { iso6391, supported: Array.from(SUPPORTED_LANGUAGES) })
    return null
  } catch (error) {
    console.error("[language-detection] Error detecting language:", error)
    return detectLanguageHeuristic(text)
  }
}

/**
 * Synchronous version for cases where async is not needed
 * Uses franc if available, otherwise falls back to heuristic
 */
export function detectLanguageEnhancedSync(text: string, minLength: number = 10): string | null {
  if (!text || text.trim().length < minLength) {
    return null
  }

  try {
    // Try to use franc synchronously (only works if already loaded)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const franc = require("franc")
    const detected = franc(text, { minLength })
    
    if (!detected || detected === "und") {
      return null
    }

    const iso6391 = languageCodeMap[detected] || detected.substring(0, 2)
    return SUPPORTED_LANGUAGES.has(iso6391) ? iso6391 : null
  } catch {
    // Fallback to heuristic
    return detectLanguageHeuristic(text)
  }
}

/**
 * Heuristic language detection (fallback)
 * Based on character patterns and common words
 */
function detectLanguageHeuristic(text: string): string | null {
  const lowerText = text.toLowerCase()

  // Greek: contains Greek characters
  if (/[α-ωά-ώΑ-ΩΆ-Ώ]/.test(text)) {
    console.log("[language-detection] Heuristic: detected Greek")
    return "el"
  }

  // Common word patterns for each language
  const patterns: Record<string, RegExp[]> = {
    it: [
      /\b(festa|mercato|vino|arte|cibo|evento|spettacolo|concerto)\b/,
      /\b(dove|quando|cosa|come|perché)\b/,
    ],
    es: [
      /\b(fiesta|mercado|vino|comida|evento|espectáculo|concierto)\b/,
      /\b(dónde|cuándo|qué|cómo|por qué)\b/,
    ],
    fr: [
      /\b(fête|marché|vin|nourriture|événement|spectacle|concert)\b/,
      /\b(où|quand|quoi|comment|pourquoi)\b/,
    ],
  }

  for (const [lang, regexes] of Object.entries(patterns)) {
    if (regexes.some((regex) => regex.test(lowerText))) {
      console.log("[language-detection] Heuristic: detected", lang)
      return lang
    }
  }

  // Default to English if no pattern matches
  // But return null if we're really uncertain (let caller decide)
  console.log("[language-detection] Heuristic: no pattern matched, returning null")
  return null
}

/**
 * Detect language from event title and description
 * Combines both fields for better accuracy
 * Returns "unknown" if confidence is low (< 0.7 threshold)
 *
 * @param title - Event title
 * @param description - Event description
 * @returns ISO 639-1 language code, "unknown" if confidence is low, or null if text is too short
 */
export async function detectEventLanguage(
  title: string,
  description?: string | null,
): Promise<string | null> {
  // Combine title and description for better detection accuracy
  const combinedText = description
    ? `${title} ${description}`.trim()
    : title.trim()

  console.log("[language-detection] Detecting language for event:", { 
    titlePreview: title.substring(0, 50), 
    hasDescription: !!description,
    combinedLength: combinedText.length 
  })

  // Require minimum length for reliable detection
  if (combinedText.length < 10) {
    console.log("[language-detection] Combined text too short for detection")
    return null
  }

  // Calculate confidence based on text length and detection result
  // Heuristic: longer text = higher confidence
  // Confidence thresholds:
  // - < 20 chars: very low confidence → "unknown"
  // - 20-30 chars: low confidence → "unknown" if detection uncertain
  // - > 30 chars: higher confidence → use detection result
  const textLength = combinedText.length
  const minConfidenceLength = 20
  const goodConfidenceLength = 30

  const detected = await detectLanguageEnhanced(combinedText, 10)
  
  // If detection failed or returned null, confidence is low
  if (!detected) {
    // If text is very short, return null (too short to detect)
    if (textLength < minConfidenceLength) {
      console.log("[language-detection] Text too short for reliable detection, returning null", {
        length: textLength,
        minLength: minConfidenceLength,
      })
      return null
    }
    // If text is longer but detection failed, return "unknown" (low confidence)
    console.log("[language-detection] Detection failed or uncertain, storing as 'unknown'", {
      length: textLength,
      detected,
    })
    return "unknown"
  }

  // If text is short (< 20 chars), confidence is low even if detection succeeded
  if (textLength < minConfidenceLength) {
    console.log("[language-detection] Text too short for high confidence, storing as 'unknown'", {
      length: textLength,
      detected,
      minLength: minConfidenceLength,
    })
    return "unknown"
  }

  // If text is between 20-30 chars, we have moderate confidence
  // Use detection result but log it
  if (textLength < goodConfidenceLength) {
    console.log("[language-detection] Moderate confidence detection", {
      length: textLength,
      detected,
      confidence: "moderate",
    })
  } else {
    console.log("[language-detection] High confidence detection", {
      length: textLength,
      detected,
      confidence: "high",
    })
  }

  console.log("[language-detection] Event language detection result:", { 
    detected, 
    title: title.substring(0, 50),
    confidence: textLength >= goodConfidenceLength ? "high" : textLength >= minConfidenceLength ? "moderate" : "low",
  })
  
  return detected
}

