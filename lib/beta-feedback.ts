/**
 * Beta feedback utility
 * Generates mailto link with prefilled context for beta testers
 */

export interface BetaFeedbackContext {
  url?: string
  language?: string
  timestamp?: string
}

/**
 * Generate mailto link for beta feedback
 * Prefills subject and body with context information
 */
export function generateBetaFeedbackLink(context?: BetaFeedbackContext): string {
  const url = context?.url || (typeof window !== "undefined" ? window.location.href : "")
  const language = context?.language || (typeof window !== "undefined" ? navigator.language : "en")
  const timestamp = context?.timestamp || new Date().toISOString()

  const subject = encodeURIComponent("Eventa Beta Feedback")
  const body = encodeURIComponent(
    `Hi Eventa team,

I wanted to share some feedback about the beta:

[Your feedback here - what felt confusing, broken, or unclear?]

---
Context:
- URL: ${url}
- Browser language: ${language}
- Timestamp: ${timestamp}
`
  )

  // Use environment variable for feedback email, fallback to a default
  const feedbackEmail = process.env.NEXT_PUBLIC_BETA_FEEDBACK_EMAIL || "feedback@eventa.app"

  return `mailto:${feedbackEmail}?subject=${subject}&body=${body}`
}

/**
 * Open beta feedback email (client-side only)
 */
export function openBetaFeedback() {
  if (typeof window === "undefined") return

  const mailtoLink = generateBetaFeedbackLink({
    url: window.location.href,
    language: navigator.language,
    timestamp: new Date().toISOString(),
  })

  window.location.href = mailtoLink
}

