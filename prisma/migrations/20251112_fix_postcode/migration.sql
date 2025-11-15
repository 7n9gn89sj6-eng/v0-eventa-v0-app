-- Migration to fix postcode column type mismatch
-- Ensures postcode is nullable text type to match Prisma schema

ALTER TABLE "Event"
  ALTER COLUMN "postcode" TYPE text USING "postcode"::text,
  ALTER COLUMN "postcode" DROP NOT NULL;
