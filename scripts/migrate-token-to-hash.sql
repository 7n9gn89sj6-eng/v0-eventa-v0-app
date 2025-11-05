-- Migration: Rename token column to tokenHash in EventEditToken table
-- This is a breaking change - existing tokens will need to be regenerated

-- Step 1: Add new tokenHash column
ALTER TABLE "EventEditToken" ADD COLUMN "tokenHash" TEXT;

-- Step 2: Copy existing tokens to tokenHash (temporary, will be replaced with hashed versions)
UPDATE "EventEditToken" SET "tokenHash" = "token";

-- Step 3: Make tokenHash NOT NULL
ALTER TABLE "EventEditToken" ALTER COLUMN "tokenHash" SET NOT NULL;

-- Step 4: Add unique constraint to tokenHash
ALTER TABLE "EventEditToken" ADD CONSTRAINT "EventEditToken_tokenHash_key" UNIQUE ("tokenHash");

-- Step 5: Drop old token column and its unique constraint
ALTER TABLE "EventEditToken" DROP CONSTRAINT IF EXISTS "EventEditToken_token_key";
ALTER TABLE "EventEditToken" DROP COLUMN "token";

-- Step 6: Create index on tokenHash
CREATE INDEX "EventEditToken_tokenHash_idx" ON "EventEditToken"("tokenHash");

-- Note: All existing tokens are now invalid and users will need to regenerate them
-- This is intentional for security - we're moving from plain text to hashed tokens
