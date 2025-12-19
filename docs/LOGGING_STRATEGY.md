# Logging Strategy for Plain Language Search

## Overview

Comprehensive logging has been added to help debug and monitor the language detection and semantic search features. All logs are prefixed with their component for easy filtering.

## Log Prefixes

- `[language-detection]` - Language detection operations
- `[embeddings]` - Embedding generation and storage
- `[events]` - Event creation flow (language + embeddings)
- `[submit]` - Event submission flow (language + embeddings)
- `[searchDatabase]` - Database search operations (hybrid search)

## Log Levels

### Info (`console.log` / `logger.info`)
- Start of operations
- Successful completions
- Key decision points
- Configuration states

### Warn (`console.warn` / `logger.warn`)
- Fallbacks to alternative methods
- Optional operations that failed (non-critical)
- Missing configurations

### Error (`console.error` / `logger.error`)
- Actual errors that need attention
- Failed operations

### Debug (`logger.debug`)
- Detailed query information
- Internal state details

## Logging Points

### Language Detection

**Entry point:**
```
[language-detection] Detecting language for event: { titlePreview, hasDescription, combinedLength }
```

**Detection process:**
```
[language-detection] franc detected: { detected, textPreview }
[language-detection] Mapped to ISO 639-1: { iso6391, original }
[language-detection] ✓ Language detected: { iso6391 }
```

**Fallbacks:**
```
[language-detection] franc not available, using heuristic fallback
[language-detection] Heuristic: detected { lang }
[language-detection] Heuristic: no pattern matched, returning null
```

**Results:**
```
[language-detection] Event language detection result: { detected, title }
```

### Embedding Generation

**Event embeddings:**
```
[embeddings] Generating embedding for event: { titlePreview, textLength, hasDescription, hasVenue, categoriesCount }
[embeddings] Calling OpenAI embeddings API...
[embeddings] ✓ Embedding generated successfully: { dimensions, durationMs, titlePreview }
```

**Query embeddings:**
```
[embeddings] Generating query embedding: { query }
[embeddings] ✓ Query embedding generated: { dimensions, durationMs, queryPreview }
```

**Storage:**
```
[embeddings] Storing embedding for event: { eventId, dimensions }
[embeddings] Executing SQL to store embedding...
[embeddings] ✓ Embedding stored successfully: { eventId, durationMs }
```

**Errors:**
```
[embeddings] OPENAI_API_KEY not configured, skipping embedding generation
[embeddings] Text too short for embedding generation: { length }
[embeddings] Error generating embedding: { error }
```

### Event Creation Flow

**Language detection:**
```
[events] Starting language detection for new event: { titlePreview }
[events] Language detection result: { detectedLanguage, titlePreview }
```

**Embedding generation:**
```
[events] Starting embedding generation for event: { eventId, titlePreview }
[events] Embedding generated, storing for event: { eventId }
[events] Embedding generation skipped (SKIP_EMBEDDING_GENERATION=true)
```

### Search Operations

**Semantic search status:**
```
[searchDatabase] Semantic search enabled, generating query embedding: { query }
[searchDatabase] Query embedding generated successfully, using hybrid search: { queryPreview, semanticWeight, fullTextWeight }
[searchDatabase] Query embedding not available, using full-text search only
[searchDatabase] Semantic search disabled, using full-text search only
```

**Query execution:**
```
[searchDatabase] Executing search query: { queryPreview, useSemanticSearch, limit, hasDateFilter, hasCategoryFilter }
[searchDatabase] Search query completed: { resultsCount, queryDurationMs, queryPreview, usedSemanticSearch }
```

## Filtering Logs

### View only language detection logs:
```bash
# Terminal/Console
grep "[language-detection]" logs.txt

# Or in browser console
console.log entries.filter(e => e.includes("[language-detection]"))
```

### View only embedding logs:
```bash
grep "[embeddings]" logs.txt
```

### View only search logs:
```bash
grep "[searchDatabase]" logs.txt
```

### View errors only:
```bash
grep -E "\[.*\] (Error|Failed|error|failed)" logs.txt
```

## Example Log Flow

### Event Creation with Language Detection and Embedding:

```
[events] Starting language detection for new event: { titlePreview: "Συναυλία Jazz" }
[language-detection] Detecting language for event: { titlePreview: "Συναυλία Jazz", hasDescription: true, combinedLength: 245 }
[language-detection] franc detected: { detected: "ell", textPreview: "Συναυλία Jazz Μουσική βραδιά..." }
[language-detection] Mapped to ISO 639-1: { iso6391: "el", original: "ell" }
[language-detection] ✓ Language detected: el
[language-detection] Event language detection result: { detected: "el", title: "Συναυλία Jazz" }
[events] Language detection result: { detectedLanguage: "el", titlePreview: "Συναυλία Jazz" }
[events] Starting embedding generation for event: { eventId: "abc123", titlePreview: "Συναυλία Jazz" }
[embeddings] Generating embedding for event: { titlePreview: "Συναυλία Jazz", textLength: 245, hasDescription: true, hasVenue: true, categoriesCount: 2 }
[embeddings] Calling OpenAI embeddings API...
[embeddings] ✓ Embedding generated successfully: { dimensions: 1536, durationMs: 234, titlePreview: "Συναυλία Jazz" }
[events] Embedding generated, storing for event: { eventId: "abc123" }
[embeddings] Storing embedding for event: { eventId: "abc123", dimensions: 1536 }
[embeddings] Executing SQL to store embedding...
[embeddings] ✓ Embedding stored successfully: { eventId: "abc123", durationMs: 12 }
```

### Search with Hybrid Search:

```
[searchDatabase] Semantic search enabled, generating query embedding: { query: "things to do tonight" }
[embeddings] Generating query embedding: { query: "things to do tonight" }
[embeddings] ✓ Query embedding generated: { dimensions: 1536, durationMs: 198, queryPreview: "things to do tonight" }
[searchDatabase] Query embedding generated successfully, using hybrid search: { queryPreview: "things to do tonight", semanticWeight: 0.6, fullTextWeight: 0.4 }
[searchDatabase] Executing search query: { queryPreview: "things to do tonight", useSemanticSearch: true, limit: 20, hasDateFilter: false, hasCategoryFilter: false }
[searchDatabase] Search query completed: { resultsCount: 15, queryDurationMs: 145, queryPreview: "things to do tonight", usedSemanticSearch: true }
```

## Performance Monitoring

Logs include timing information for:
- Embedding generation (`durationMs`)
- Embedding storage (`durationMs`)
- Query execution (`queryDurationMs`)

Use these to monitor performance and identify bottlenecks.

## Troubleshooting Checklist

1. **Language not detected?**
   - Check: `[language-detection]` logs
   - Verify: franc is installed (`npm install franc`)
   - Check: text length is sufficient (min 10 chars)

2. **Embeddings not generating?**
   - Check: `[embeddings]` logs
   - Verify: `OPENAI_API_KEY` is set
   - Check: API quota/rate limits

3. **Embeddings not storing?**
   - Check: `[embeddings] ✓ Embedding stored successfully` log
   - Verify: database connection
   - Check: pgvector extension is enabled

4. **Search not using semantic search?**
   - Check: `[searchDatabase]` logs
   - Verify: `useSemanticSearch` option
   - Check: query embedding generation logs

5. **Slow search performance?**
   - Check: `queryDurationMs` in search logs
   - Verify: embedding index exists
   - Consider: reducing semantic weight if needed

## Best Practices

1. **Monitor logs in production** to catch issues early
2. **Set up log aggregation** (e.g., Datadog, LogRocket) to filter by prefix
3. **Alert on errors** but not warnings (warnings are expected in some cases)
4. **Track performance metrics** from duration logs
5. **Use log levels appropriately** - don't log sensitive data

