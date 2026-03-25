/** True if `value` parses as http: or https: (for safe optional image preview). */
export function isPublicHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}
