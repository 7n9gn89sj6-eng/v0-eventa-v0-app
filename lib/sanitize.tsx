// Input sanitization utilities
export function sanitizeString(input: string, maxLength = 1000): string {
  if (typeof input !== "string") return ""

  // Remove null bytes and control characters except newlines/tabs
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

  // Trim and limit length
  sanitized = sanitized.trim().slice(0, maxLength)

  return sanitized
}

export function sanitizeHtml(input: string): string {
  if (typeof input !== "string") return ""

  // Basic HTML entity encoding for display
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}

export function isValidCategory(category: string): boolean {
  // Only allow alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9-_]{1,50}$/.test(category)
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}
