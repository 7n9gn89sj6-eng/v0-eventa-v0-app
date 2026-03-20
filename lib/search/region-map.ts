/**
 * Deterministic region → country lists for search execution.
 * Add new regions here; do not special-case cities in the route.
 */

export type RegionDefinition = {
  key: string
  label: string
  countries: string[]
  aliases?: string[]
}

export const REGION_MAP: Record<string, RegionDefinition> = {
  "western-europe": {
    key: "western-europe",
    label: "Western Europe",
    countries: ["France", "Germany", "Netherlands", "Belgium", "Luxembourg"],
    aliases: ["western europe", "west europe"],
  },
  "southern-europe": {
    key: "southern-europe",
    label: "Southern Europe",
    countries: ["Italy", "Spain", "Portugal", "Greece", "Malta", "Cyprus"],
    aliases: ["southern europe", "south europe"],
  },
  "northern-europe": {
    key: "northern-europe",
    label: "Northern Europe",
    countries: ["Sweden", "Norway", "Denmark", "Finland", "Iceland"],
    aliases: ["northern europe", "north europe"],
  },
  uk: {
    key: "uk",
    label: "UK",
    countries: ["United Kingdom"],
    aliases: ["uk", "united kingdom", "great britain", "britain"],
  },
  "central-europe": {
    key: "central-europe",
    label: "Central Europe",
    countries: ["Germany", "Poland", "Czech Republic", "Austria", "Hungary", "Switzerland", "Slovakia"],
    aliases: ["central europe"],
  },
  "eastern-europe": {
    key: "eastern-europe",
    label: "Eastern Europe",
    countries: [
      "Poland",
      "Czech Republic",
      "Slovakia",
      "Hungary",
      "Romania",
      "Bulgaria",
      "Ukraine",
      "Belarus",
      "Estonia",
      "Latvia",
      "Lithuania",
      "Serbia",
      "Croatia",
      "Slovenia",
      "Bosnia and Herzegovina",
      "Montenegro",
      "North Macedonia",
      "Albania",
      "Moldova",
      "Kosovo",
    ],
    aliases: ["eastern europe", "east europe"],
  },
  europe: {
    key: "europe",
    label: "Europe",
    countries: [
      "France",
      "Germany",
      "Italy",
      "Spain",
      "United Kingdom",
      "Netherlands",
      "Belgium",
      "Luxembourg",
      "Austria",
      "Switzerland",
      "Ireland",
      "Portugal",
      "Greece",
      "Poland",
      "Czech Republic",
      "Slovakia",
      "Hungary",
      "Romania",
      "Bulgaria",
      "Croatia",
      "Slovenia",
      "Serbia",
      "Bosnia and Herzegovina",
      "Montenegro",
      "North Macedonia",
      "Albania",
      "Kosovo",
      "Estonia",
      "Latvia",
      "Lithuania",
      "Ukraine",
      "Belarus",
      "Moldova",
      "Sweden",
      "Norway",
      "Denmark",
      "Finland",
      "Iceland",
      "Malta",
      "Cyprus",
      "Russia",
    ],
    aliases: ["europe"],
  },
  scandinavia: {
    key: "scandinavia",
    label: "Scandinavia",
    countries: ["Sweden", "Norway", "Denmark", "Finland", "Iceland"],
    aliases: ["scandinavia", "nordic countries"],
  },
  "middle-east": {
    key: "middle-east",
    label: "Middle East",
    countries: [
      "Turkey",
      "Israel",
      "Saudi Arabia",
      "United Arab Emirates",
      "Jordan",
      "Lebanon",
      "Iraq",
      "Iran",
      "Kuwait",
      "Qatar",
      "Bahrain",
      "Oman",
      "Yemen",
      "Egypt",
      "Syria",
      "Palestine",
    ],
    aliases: ["middle east", "middle eastern"],
  },
  "south-america": {
    key: "south-america",
    label: "South America",
    countries: [
      "Brazil",
      "Argentina",
      "Chile",
      "Peru",
      "Colombia",
      "Venezuela",
      "Ecuador",
      "Bolivia",
      "Paraguay",
      "Uruguay",
      "Guyana",
      "Suriname",
    ],
    aliases: ["south america"],
  },
  "north-america": {
    key: "north-america",
    label: "North America",
    countries: ["United States", "Canada", "Mexico"],
    aliases: ["north america"],
  },
  "western-australia": {
    key: "western-australia",
    label: "Western Australia",
    countries: ["Australia"],
    aliases: ["western australia", "west australia"],
  },
}

function slugifyRegionInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

/**
 * Resolve a region string from intent parsing to a REGION_MAP key, or null.
 */
export function normalizeRegionKey(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const slug = slugifyRegionInput(raw)
  if (REGION_MAP[slug]) return slug

  const lower = raw.toLowerCase()
  for (const def of Object.values(REGION_MAP)) {
    if (def.label.toLowerCase() === lower) return def.key
    if (def.aliases?.some((a) => a.toLowerCase() === lower)) return def.key
  }

  return null
}

/**
 * Country names suitable for Prisma `country` contains / web context.
 */
export function resolveRegionCountries(regionRaw: string): string[] | null {
  const key = normalizeRegionKey(regionRaw)
  if (!key) return null
  const list = REGION_MAP[key]?.countries
  return list?.length ? [...list] : null
}
