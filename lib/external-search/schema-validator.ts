import DOMPurify from "isomorphic-dompurify"

export interface ValidatedExternalEvent {
  title: string
  date: string // YYYY-MM-DD
  time: string | null // HH:mm or null
  city: string | null
  venue: string | null
  description: string | null
  sourceLabel: string
  sourceUrl: string | null
}

export interface ValidationError {
  code: string
  message: string
}

const UNSAFE_PATTERNS = [
  /free\s+crypto\s+airdrop/i,
  /connect\s+wallet/i,
  /claim\s+now/i,
  /limited\s+time\s+offer/i,
  /click\s+here\s+to\s+win/i,
  /casino/i,
  /viagra/i,
  /porn/i,
]

export function validateAndNormalizeExternalEvent(
  raw: any,
  providerName: string,
): { event: ValidatedExternalEvent | null; error: ValidationError | null } {
  // Check required fields
  if (!raw.title || typeof raw.title !== "string" || raw.title.trim().length === 0) {
    return {
      event: null,
      error: { code: "ERR_EXT_SCHEMA_REQUIRED", message: "Missing or invalid title" },
    }
  }

  if (!raw.startAt && !raw.date) {
    return {
      event: null,
      error: { code: "ERR_EXT_SCHEMA_REQUIRED", message: "Missing date" },
    }
  }

  // Validate title length
  const title = raw.title.trim()
  if (title.length > 140) {
    return {
      event: null,
      error: { code: "ERR_EXT_SCHEMA_REQUIRED", message: "Title exceeds 140 characters" },
    }
  }

  // Safety filter: check for unsafe patterns
  const textToCheck = `${title} ${raw.description || ""}`.toLowerCase()
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(textToCheck)) {
      return {
        event: null,
        error: { code: "ERR_EXT_SAFETY_FILTER", message: "Content failed safety filter" },
      }
    }
  }

  // Normalize date
  let date: string
  try {
    const dateObj = new Date(raw.startAt || raw.date)
    if (isNaN(dateObj.getTime())) {
      return {
        event: null,
        error: { code: "ERR_EXT_SCHEMA_REQUIRED", message: "Invalid date format" },
      }
    }
    date = dateObj.toISOString().split("T")[0] // YYYY-MM-DD
  } catch {
    return {
      event: null,
      error: { code: "ERR_EXT_SCHEMA_REQUIRED", message: "Invalid date" },
    }
  }

  // Normalize time (24h format or null)
  let time: string | null = null
  if (raw.startAt) {
    try {
      const dateObj = new Date(raw.startAt)
      const hours = dateObj.getHours().toString().padStart(2, "0")
      const minutes = dateObj.getMinutes().toString().padStart(2, "0")
      time = `${hours}:${minutes}`
    } catch {
      time = null
    }
  }

  // Sanitize description
  let description: string | null = null
  if (raw.description) {
    try {
      // Remove HTML, scripts, trackers
      let cleaned = DOMPurify.sanitize(raw.description, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      })

      // Remove tracking parameters
      cleaned = cleaned.replace(/utm_[a-z_]+=[^&\s]+/gi, "")
      cleaned = cleaned.replace(/fbclid=[^&\s]+/gi, "")

      // Collapse whitespace
      cleaned = cleaned.replace(/\s+/g, " ").trim()

      // Truncate to 280 chars
      if (cleaned.length > 280) {
        cleaned = cleaned.substring(0, 277) + "..."
      }

      description = cleaned || null
    } catch {
      return {
        event: null,
        error: { code: "ERR_EXT_SANITIZE_FAIL", message: "Failed to sanitize description" },
      }
    }
  }

  // Validate URL scheme
  let sourceUrl: string | null = null
  if (raw.sourceUrl || raw.url) {
    const url = raw.sourceUrl || raw.url
    if (typeof url === "string") {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        sourceUrl = url
      } else {
        return {
          event: null,
          error: { code: "ERR_EXT_URL_SCHEME", message: "Invalid URL scheme (must be http/https)" },
        }
      }
    }
  }

  // Normalize city and venue
  const city = raw.city && typeof raw.city === "string" ? raw.city.trim() : null
  const venue = raw.venue && typeof raw.venue === "string" ? raw.venue.trim() : null

  // Generate source label
  const sourceLabel = `From ${providerName.charAt(0).toUpperCase() + providerName.slice(1).replace(/_/g, " ")}`

  return {
    event: {
      title,
      date,
      time,
      city,
      venue,
      description,
      sourceLabel,
      sourceUrl,
    },
    error: null,
  }
}
