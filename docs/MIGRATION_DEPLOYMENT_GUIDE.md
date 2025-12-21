# Production Migration Deployment Guide

## Current Status

✅ **Prisma Schema**: Uses `env("DATABASE_URL")` only  
✅ **Migration Exists**: `prisma/migrations/add_language_field/migration.sql`  
✅ **Migration Content**: Adds `Event.language` column safely with `IF NOT EXISTS`

## Environment Verification

### Prisma Schema ✅
```prisma
datasource db {
  provider     = "postgresql"
  url          = env("DATABASE_URL")  // ✅ Correct - uses DATABASE_URL only
  relationMode = "prisma"
  extensions   = [vector(schema: "public")]
}
```

### Application Code ✅
- `lib/db.ts` uses `process.env.DATABASE_URL` only
- No hardcoded references to `NEON_DATABASE_URL` in core code
- Scripts may reference `NEON_DATABASE_URL` as fallback (acceptable for local dev)

### Render Environment Variables
**Required:**
- `DATABASE_URL` - Direct Neon connection string (NOT pooled, no `-pooler`)

**Should NOT exist:**
- `NEON_DATABASE_URL` - Remove if present (causes confusion)

## Migration Details

### Migration File: `prisma/migrations/add_language_field/migration.sql`

```sql
-- Add language field to Event table for detected language
-- Language is nullable for backward compatibility with existing events
-- Stores ISO 639-1 language codes: en, el, it, es, fr

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- Add index for language-based filtering (optional but useful for future language-aware search)
CREATE INDEX IF NOT EXISTS "Event_language_idx" ON "Event"("language");

-- Note: embedding field already exists, no migration needed
```

**Safety Features:**
- ✅ Uses `IF NOT EXISTS` - safe to run multiple times
- ✅ Column is nullable - won't break existing events
- ✅ Index creation is idempotent

## Deployment Steps

### Step 1: Verify Environment Variables in Render

1. Go to Render Dashboard → Your Web Service → Environment
2. Verify `DATABASE_URL` is set (direct connection, no `-pooler`)
3. Remove `NEON_DATABASE_URL` if it exists
4. Ensure connection string format:
   ```
   postgresql://user:pass@ep-xxx-xxx.ap-southeast-2.aws.neon.tech:5432/dbname?sslmode=require
   ```
   NOT:
   ```
   postgresql://user:pass@ep-xxx-xxx-pooler.ap-southeast-2.aws.neon.tech:5432/dbname?sslmode=require
   ```

### Step 2: Deploy Migration Locally (Connected to Production DB)

**Option A: Using Prisma CLI (Recommended)**

```bash
# Set production database URL
export DATABASE_URL="your-production-neon-direct-connection-string"

# Deploy pending migrations
npx prisma migrate deploy

# Expected output:
# ✅ Applied migration `add_language_field`
```

**Option B: Manual SQL (If Prisma CLI unavailable)**

Run in Neon SQL Editor:

```sql
-- Add language field to Event table for detected language
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- Add index for language-based filtering
CREATE INDEX IF NOT EXISTS "Event_language_idx" ON "Event"("language");
```

### Step 3: Verify Migration Applied

**Using Verification Script:**

```bash
# Set production database URL
export DATABASE_URL="your-production-neon-direct-connection-string"

# Run verification
npm run db:verify-language
```

**Expected Output:**
```
✅ Migration successful! The language column exists.
✅ Search API should now work without 500 errors.
```

**Manual SQL Verification:**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Event' 
AND column_name IN ('language', 'embedding');
```

**Expected Result:**
- `language` - `text` - `YES` (nullable)
- `embedding` - `USER-DEFINED` (vector) - `YES` (nullable)

### Step 4: Post-Deployment Validation

1. **Test Search API:**
   ```
   GET /api/search/events?query=test
   ```
   Should return 200 (not 500)

2. **Test Search Page:**
   - Navigate to `/discover`
   - Perform a search
   - Should return results without errors

3. **Check Render Logs:**
   - No Prisma schema validation errors
   - No "column does not exist" errors

## Troubleshooting

### Error: "Can't reach database server"
- **Cause**: Using pooled connection string
- **Fix**: Use direct connection string (remove `-pooler` from hostname)

### Error: "Migration already applied"
- **Status**: ✅ OK - Migration is idempotent
- **Action**: No action needed, migration is already applied

### Error: "No migrations found"
- **Cause**: Migration file missing or Prisma can't find it
- **Fix**: Verify `prisma/migrations/add_language_field/migration.sql` exists

### Error: "Permission denied"
- **Cause**: Database user lacks ALTER TABLE permissions
- **Fix**: Ensure database user has sufficient privileges

## Success Criteria

✅ `Event.language` column exists in production database  
✅ Search API returns 200 (not 500)  
✅ No Prisma schema validation errors in logs  
✅ Environment uses `DATABASE_URL` only (no `NEON_DATABASE_URL`)  
✅ Connection string is direct (not pooled)  

## Post-Migration Notes

- Existing events will have `language = NULL` (expected)
- New events will have language detected automatically
- Edited events will have language regenerated
- Search will work correctly even if language is NULL

