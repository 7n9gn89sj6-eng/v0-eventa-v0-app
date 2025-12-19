# Plain Language Search Implementation Summary

## Overview

This implementation adds language detection and semantic search capabilities to Eventa, enabling better discovery of events through plain-language queries and multi-language content support.

## What's Implemented

### ✅ Language Detection
- Automatic detection of event language (title + description)
- Uses `franc` library for accurate language detection
- Stores ISO 639-1 language codes: `en`, `el`, `it`, `es`, `fr`
- Graceful fallback if detection fails

### ✅ Embedding Generation
- Generates vector embeddings for events using OpenAI `text-embedding-3-small`
- Stores embeddings in PostgreSQL using pgvector
- Runs asynchronously (non-blocking) after event creation
- Cost-effective: ~$0.00001 per event

### ✅ Hybrid Search
- Combines full-text search (pg_trgm) with semantic search (pgvector)
- Configurable weighting (default: 40% full-text, 60% semantic)
- Falls back to full-text only if embeddings unavailable
- Handles events without embeddings gracefully

## Installation Steps

1. **Install franc library:**
   ```bash
   npm install franc
   ```

2. **Run database migration:**
   ```bash
   npx prisma migrate dev --name add_language_field
   ```
   OR use the migration script:
   ```bash
   tsx scripts/add-language-field-migration.ts
   ```

3. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

4. **Verify environment variables:**
   - `OPENAI_API_KEY` should be set (for embeddings)

## Files Created/Modified

### New Files
- `lib/search/language-detection-enhanced.ts` - Language detection with franc
- `lib/embeddings/generate.ts` - Embedding generation
- `lib/embeddings/store.ts` - Embedding storage utilities
- `lib/embeddings/query.ts` - Query embedding generation
- `scripts/add-language-field-migration.ts` - Migration script
- `docs/PLAIN_LANGUAGE_SEARCH_IMPLEMENTATION.md` - Implementation plan
- `docs/IMPLEMENTATION_STATUS.md` - Status tracking

### Modified Files
- `prisma/schema.prisma` - Added `language` field
- `app/api/events/route.ts` - Added language detection + embedding generation
- `app/api/events/submit/route.ts` - Added language detection + embedding generation
- `lib/search/database-search.ts` - Added hybrid search support

## Configuration

### Environment Variables
- `OPENAI_API_KEY` - Required for embedding generation
- `SKIP_EMBEDDING_GENERATION=true` - Optional: disable embedding generation

### Search Options
The `searchDatabase` function now accepts:
- `useSemanticSearch?: boolean` - Enable/disable semantic search (default: true)
- `semanticWeight?: number` - Weight for semantic search 0-1 (default: 0.6)

## How It Works

### Event Creation Flow
1. User creates/submits event
2. Language is detected from title + description → stored in `language` field
3. Event is saved to database
4. Embedding is generated asynchronously → stored in `embedding` field
5. Event creation completes (embedding generation doesn't block)

### Search Flow
1. User enters search query (plain language, e.g., "jazz events tonight")
2. Query embedding is generated
3. Database query combines:
   - Full-text search (matches keywords)
   - Semantic search (matches meaning)
4. Results ranked by combined score
5. Results returned to user

## Testing

### Test Language Detection
```typescript
// Create event with Greek text
const event = await createEvent({
  title: "Συναυλία Jazz",
  description: "Μουσική βραδιά με jazz συγκρότημα"
})
// Verify: event.language === "el"
```

### Test Semantic Search
```typescript
// Search with plain language
const results = await searchDatabase({
  query: "things to do tonight",
  useSemanticSearch: true
})
// Should return relevant events even without exact keyword matches
```

## Cost Analysis

- **Language Detection:** Free (local processing)
- **Embedding Generation:** ~$0.00001 per event
  - 10,000 events = $0.10 one-time
  - 1,000 events/month = $0.01/month

## Backward Compatibility

✅ All changes are **additive and backward compatible**:
- Existing events work without `language` or `embedding` fields
- Search degrades gracefully if embeddings unavailable
- No breaking changes to existing APIs

## Future Enhancements

- Backfill script for existing events (optional)
- Language-aware filtering
- Translation UI (defer to post-beta)
- Advanced ranking with user preferences

## Troubleshooting

### Embeddings not generating
- Check `OPENAI_API_KEY` is set
- Check console logs for errors
- Verify embedding field exists in database

### Language not detected
- Ensure `franc` is installed: `npm install franc`
- Check console logs for detection errors
- Language detection is optional - events work without it

### Search not using semantic search
- Check if embeddings exist for events
- Verify `useSemanticSearch` is not set to `false`
- Check query embedding generation in logs

## Support

For issues or questions, refer to:
- `docs/PLAIN_LANGUAGE_SEARCH_IMPLEMENTATION.md` - Detailed implementation plan
- `docs/IMPLEMENTATION_STATUS.md` - Current status and next steps

