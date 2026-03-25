/** Build the same query string Discover uses in the browser for tests that mock `useSearchParams`. */
export function discoverUrlSearchParamsStringFromProps(p: {
  initialQuery?: string
  initialCity?: string
  initialCountry?: string
  initialCategory?: string
  initialDateFrom?: string
  initialDateTo?: string
}): string {
  const u = new URLSearchParams()
  const q = p.initialQuery?.trim()
  if (q) u.set("q", q)
  const city = p.initialCity?.trim()
  if (city) u.set("city", city)
  const country = p.initialCountry?.trim()
  if (country) u.set("country", country)
  const cat = p.initialCategory?.trim()
  if (cat && cat.toLowerCase() !== "all") u.set("category", cat.toLowerCase())
  const df = p.initialDateFrom?.trim()
  if (df) u.set("date_from", df)
  const dt = p.initialDateTo?.trim()
  if (dt) u.set("date_to", dt)
  return u.toString()
}
