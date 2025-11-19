-- Migration to ensure no postcode column exists in Event table
-- This matches the current Prisma schema which has no postcode field

-- Remove postcode column from Event table if it exists
ALTER TABLE "Event" DROP COLUMN IF EXISTS "postcode";
