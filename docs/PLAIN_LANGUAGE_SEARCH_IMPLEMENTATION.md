# Plain Language Search & Language Handling Implementation Plan

## Current State Analysis

✅ **Already in place:**
- pgvector extension enabled in PostgreSQL
- `embedding` field exists in Event model (Unsupported type - works but not Prisma-validated)
- Basic language detection (heuristic-based, limited)
- Full-text search with `searchText` and `searchTextFolded`
- OpenAI SDK available for embeddings

❌ **Missing:**
- Proper language detection library
- Language field on Event model
- Embedding generation on event creation/edit
- Semantic search integration
- Hybrid search combining full-text + semantic

## Proposed Schema Changes

### Minimal Addition to Event Model

```prisma
model Event {
  // ... existing fields ...
  language            String?             // ISO 639-1 language code (en, el, it, es, fr)
  // embedding field already exists as Unsupported("vector")?
}
```

**Rationale:**
- Single `language` field stores detected language of title + description
- Nullable (optional) for backward compatibility
- Uses ISO 639-1 codes matching existing `languages` array convention
- Minimal change, no breaking updates

## Recommended Libraries

### 1. Language Detection: `franc`

```bash
npm install franc
```

**Why franc:**
- ✅ Lightweight (~50KB)
- ✅ No external dependencies
- ✅ Supports 100+ languages including all target languages
- ✅ Fast (local processing, no API calls)
- ✅ Battle-tested

**Alternative (if needed):** `@compact-enc-det/compact-enc-det` (CLD3 port) - slightly better accuracy but heavier.

### 2. Embeddings: OpenAI (already installed)

**Model:** `text-embedding-3-small` (recommended)
- ✅ 1536 dimensions (matches existing schema: `vector(1536)`)
- ✅ Fast and cost-effective ($0.02 per 1M tokens)
- ✅ High quality
- ✅ Already using OpenAI in the project

**Usage pattern:**
- Generate embedding on event creation/edit
- Store in `embedding` field
- Cache to avoid regeneration on unchanged content

## Implementation Phases

### Phase 1: Language Detection (Low Risk)

**Changes:**
1. Add `language` field to Prisma schema
2. Install `franc` library
3. Create `lib/search/language-detection-enhanced.ts`
4. Add language detection to event creation/edit flows
5. Migration script

**Files to modify:**
- `prisma/schema.prisma`
- `app/api/events/route.ts` (POST handler)
- `app/api/events/submit/route.ts`
- `lib/search/language-detection.ts` (replace or enhance)

**Risk:** Low - additive change, backward compatible

### Phase 2: Embedding Generation (Medium Risk)

**Changes:**
1. Create `lib/embeddings/generate.ts`
2. Add embedding generation to event creation/edit
3. Handle errors gracefully (embedding optional)
4. Add caching to avoid redundant API calls

**Files to modify:**
- `app/api/events/route.ts` (POST handler)
- `app/api/events/submit/route.ts`
- `app/api/events/[id]/route.ts` (PUT handler if exists)

**Risk:** Medium - API dependency, but errors can be handled gracefully

### Phase 3: Hybrid Search Integration (Medium Risk)

**Changes:**
1. Enhance `lib/search/database-search.ts` with semantic search
2. Combine full-text rank + semantic similarity
3. Add configurable weighting between methods
4. Maintain backward compatibility with existing search

**Files to modify:**
- `lib/search/database-search.ts`
- Potentially `app/api/search/internal/route.ts`

**Risk:** Medium - Core search logic, but can be feature-flagged

## Cost Analysis

### Embedding Generation
- **Model:** text-embedding-3-small
- **Cost:** $0.02 per 1M tokens
- **Average event text:** ~500 tokens (title + description)
- **Cost per event:** ~$0.00001 (negligible)

**Example scaling:**
- 10,000 events: ~$0.10 one-time
- 1,000 events/month: ~$0.01/month

### Language Detection
- **Cost:** $0 (local processing with `franc`)

## Implementation Details

### Language Detection Logic

```typescript
// Detect language from title + description
const combinedText = `${event.title} ${event.description}`
const detectedLang = franc(combinedText, { minLength: 10 })
// Map to ISO 639-1 codes
const languageCode = mapToISO6391(detectedLang)
```

**Fallback strategy:**
1. If detection confidence low → null (store as null)
2. If text too short → null
3. Default to 'en' only if absolutely certain

### Embedding Generation Logic

```typescript
// Generate embedding from searchable content
const searchableText = [
  event.title,
  event.description,
  event.venueName,
  ...event.categories,
].filter(Boolean).join(' ')

// Generate embedding (1536 dimensions)
const embedding = await generateEmbedding(searchableText)
```

**Caching:**
- Hash the searchable text
- Only regenerate if text changed
- Store hash alongside embedding (optional optimization)

### Hybrid Search Strategy

```sql
-- Combine full-text rank + semantic similarity
SELECT 
  *,
  (
    -- Full-text rank (existing, 0-1 scale)
    GREATEST(
      ts_rank(to_tsvector('simple', e."searchText"), query),
      ts_rank(to_tsvector('simple', e."searchTextFolded"), query)
    ) * 0.4 +  -- 40% weight
    
    -- Semantic similarity (1 - distance, 0-1 scale)
    (1 - (embedding <=> query_embedding)) * 0.6  -- 60% weight
  ) AS combined_score
FROM "Event" e
WHERE ...
ORDER BY combined_score DESC
```

**Weighting rationale:**
- Start with 40% full-text, 60% semantic (semantic better for plain language)
- Make configurable via env var
- Adjust based on beta testing feedback

## Migration Strategy

### Step 1: Schema Migration
```sql
-- Add language column (nullable, backward compatible)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- No migration needed for embedding (already exists)
```

### Step 2: Backfill (Optional, Async)
- Create background job to detect language for existing events
- Create background job to generate embeddings for existing events
- Can run incrementally, not blocking

### Step 3: New Events
- All new events get language + embedding automatically
- Search works immediately for new events

## Testing Strategy

### Unit Tests
- Language detection accuracy on sample texts
- Embedding generation correctness
- Hybrid search ranking logic

### Integration Tests
- End-to-end: Create event → Detect language → Generate embedding → Search
- Search quality: Compare results with/without semantic search

### Beta Testing
- Monitor search quality metrics
- Gather user feedback on search relevance
- A/B test hybrid search weighting

## Rollback Plan

### If Issues Arise:
1. **Language detection:** Can be disabled, events continue working with null language
2. **Embeddings:** Optional field, search falls back to full-text only
3. **Hybrid search:** Can switch back to full-text only via feature flag

### Backward Compatibility:
- All changes are additive
- Existing events work without language/embedding
- Search degrades gracefully if embeddings unavailable

## Success Metrics (Beta)

1. **Search relevance:** Users find events matching plain-language queries
2. **Language support:** Events in different languages are discoverable
3. **Performance:** Search response time < 200ms
4. **Cost:** Embedding costs remain < $1/month during beta
5. **Stability:** No regressions in existing search functionality

## Next Steps (Post-Beta)

- **Translation UI:** Add "Translate" button for events
- **Multi-language search:** Allow searching in user's language
- **Advanced ranking:** Incorporate user preferences, popularity
- **Search analytics:** Track which searches work/don't work

## Files to Create/Modify

### New Files:
- `lib/search/language-detection-enhanced.ts` - Language detection using franc
- `lib/embeddings/generate.ts` - Embedding generation
- `lib/embeddings/cache.ts` - Embedding caching (optional)
- `prisma/migrations/XXXXX_add_language_field/migration.sql` - Schema migration
- `scripts/backfill-language-embeddings.ts` - Background job for existing events (optional)

### Modified Files:
- `prisma/schema.prisma` - Add language field
- `lib/search/database-search.ts` - Add hybrid search
- `app/api/events/route.ts` - Add language detection + embedding generation
- `app/api/events/submit/route.ts` - Add language detection + embedding generation
- `lib/search/language-detection.ts` - Enhance or replace

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|-----------|------------|
| Language field addition | Low | Nullable, backward compatible |
| Language detection | Low | Graceful fallback, local processing |
| Embedding generation | Medium | Optional, error handling, caching |
| Hybrid search | Medium | Feature flag, gradual rollout |
| Schema migration | Low | Simple column addition |

## Timeline Estimate

- **Phase 1 (Language Detection):** 2-3 hours
- **Phase 2 (Embeddings):** 3-4 hours
- **Phase 3 (Hybrid Search):** 4-5 hours
- **Testing & Refinement:** 2-3 hours

**Total:** ~12-15 hours of focused development

## Notes

- All changes are **incremental and reversible**
- Focus on **correctness over novelty**
- Prioritize **backward compatibility**
- Keep **debugging easy** (good logging, clear error messages)
- Make it **easy to disable** if issues arise

