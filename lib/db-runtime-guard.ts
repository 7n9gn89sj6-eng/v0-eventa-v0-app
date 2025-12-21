/**
 * Runtime guard for missing database columns
 * Temporary safety mechanism until migrations are applied
 */

// Process-level flag to track language column availability
let languageColumnAvailable: boolean | null = null // null = unknown, true = available, false = missing
let languageColumnChecked = false // Track if we've checked at least once

/**
 * Check if an error is related to a missing Event.language column
 */
function isMissingLanguageColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  
  const errorMessage = error.message || ""
  const errorString = error.toString()
  
  // Check for various forms of "column does not exist" errors
  const missingColumnPatterns = [
    "Event.language",
    "does not exist",
    "column.*language.*does not exist",
    "Unknown column.*language",
  ]
  
  const combinedText = `${errorMessage} ${errorString}`.toLowerCase()
  
  return missingColumnPatterns.some(pattern => {
    const regex = new RegExp(pattern.toLowerCase().replace(/\*/g, ".*"))
    return regex.test(combinedText)
  })
}

/**
 * Mark language column as unavailable (called when we detect it's missing)
 */
function markLanguageColumnUnavailable() {
  if (languageColumnAvailable === false) return // Already marked
  
  languageColumnAvailable = false
  languageColumnChecked = true
  console.warn(
    "[SEARCH FALLBACK] Language filtering disabled — missing Event.language column. " +
    "This is expected until the migration is applied. Migration: prisma/migrations/add_language_field"
  )
}

/**
 * Check if language filtering is available
 * Returns true if confirmed available, false if confirmed missing or unknown (conservative)
 */
export function isLanguageFilteringAvailable(): boolean {
  // Conservative: return false if unknown (null) or confirmed missing
  // This ensures we use explicit select on first query attempt
  return languageColumnAvailable === true
}

/**
 * Wrap a Prisma query to handle missing language column
 * On first error, marks the column as unavailable and re-throws
 * Callers should use makeEventQuerySafe() to prepare queries
 */
export async function withLanguageColumnGuard<T>(
  queryFn: () => Promise<T>
): Promise<T> {
  try {
    const result = await queryFn()
    // If query succeeds, mark column as available (if we hadn't checked before)
    if (languageColumnAvailable === null) {
      languageColumnAvailable = true
      languageColumnChecked = true
    }
    return result
  } catch (error) {
    if (isMissingLanguageColumnError(error)) {
      markLanguageColumnUnavailable()
      throw error
    }
    throw error
  }
}

/**
 * Make Event query options safe for missing language column
 * If language column is unavailable, removes language from select/where
 */
export function makeEventQuerySafe<T extends { select?: any; where?: any }>(
  queryOptions: T
): T {
  // If language column is available or unknown, return as-is
  if (languageColumnAvailable !== false) {
    return queryOptions
  }

  // Language column is missing - make query safe
  const safeOptions = { ...queryOptions }

  // Remove language from select if present
  if (safeOptions.select && safeOptions.select.language !== undefined) {
    const { language, ...restSelect } = safeOptions.select
    safeOptions.select = restSelect
  }

  // Remove language from where clause if present
  if (safeOptions.where) {
    const { language, ...restWhere } = safeOptions.where as any
    if (language !== undefined) {
      safeOptions.where = restWhere
    }
  }

  return safeOptions
}

/**
 * Get a select object that excludes language field
 * Use this when language column is missing and you need explicit select
 */
export function getEventSelectWithoutLanguage(): Record<string, boolean> {
  // Explicitly list all Event fields except 'language'
  // This is used when language column is missing to avoid Prisma selecting it
  return {
    id: true,
    title: true,
    description: true,
    startAt: true,
    endAt: true,
    locationAddress: true,
    city: true,
    country: true,
    imageUrl: true,
    externalUrl: true,
    categories: true,
    timezone: true,
    venueName: true,
    address: true,
    lat: true,
    lng: true,
    priceFree: true,
    priceAmount: true,
    websiteUrl: true,
    languages: true,
    imageUrls: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    searchText: true,
    searchTextFolded: true,
    postcode: true,
    status: true,
    adminNotes: true,
    aiAnalyzedAt: true,
    aiReason: true,
    aiStatus: true,
    category: true,
    editCount: true,
    extractionConfidence: true,
    lastEditedAt: true,
    moderatedAt: true,
    moderatedBy: true,
    moderationCategory: true,
    moderationReason: true,
    moderationSeverity: true,
    moderationStatus: true,
    organizerContact: true,
    organizerName: true,
    publishedAt: true,
    reviewedAt: true,
    reviewedBy: true,
    sourceText: true,
    tags: true,
    // Note: 'language' and 'embedding' are explicitly excluded
  }
}

