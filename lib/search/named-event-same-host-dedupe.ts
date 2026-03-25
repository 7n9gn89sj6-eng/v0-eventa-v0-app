/**
 * After unified ranking: for named-event queries, drop web rows whose host matches
 * an internal row's official `externalUrl` host (reduces duplicate festival cards).
 */

export function normalizeHostnameForDedupe(hostname: string): string {
  const h = hostname.toLowerCase().trim()
  return h.startsWith("www.") ? h.slice(4) : h
}

export function tryParseUrlHostname(url: string): string | null {
  const u = String(url || "").trim()
  if (!u) return null
  try {
    const href = /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`
    const parsed = new URL(href)
    return normalizeHostnameForDedupe(parsed.hostname)
  } catch {
    return null
  }
}

/**
 * Suppress web rows when any internal row lists the same official hostname in `externalUrl`.
 */
export function applyNamedEventSameHostWebDedupe(unifiedRanked: any[]): any[] {
  const internalHosts = new Set<string>()
  for (const r of unifiedRanked) {
    if (r._resultKind !== "internal") continue
    const url = r.externalUrl
    if (typeof url !== "string" || !url.trim()) continue
    const h = tryParseUrlHostname(url)
    if (h) internalHosts.add(h)
  }
  if (internalHosts.size === 0) return unifiedRanked

  return unifiedRanked.filter((r) => {
    if (r._resultKind !== "web") return true
    const raw = String(r.externalUrl || r._originalUrl || r.url || "")
    const wh = tryParseUrlHostname(raw)
    if (!wh) return true
    return !internalHosts.has(wh)
  })
}
