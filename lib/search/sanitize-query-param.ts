/**
 * Coerce URL / intent values into a safe plain string for `q` and similar params.
 */
export function sanitizeQueryParam(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") {
    const t = value.trim()
    if (t === "[object Object]") return ""
    if (t.toLowerCase() === "undefined" || t.toLowerCase() === "null") return ""
    return t
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}
