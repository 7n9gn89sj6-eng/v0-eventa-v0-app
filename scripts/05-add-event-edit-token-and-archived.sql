-- Migration: add_event_edit_token_and_archived
-- Add ARCHIVED status to EventStatus enum and create EventEditToken table

-- Add ARCHIVED to the EventStatus enum
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- Create EventEditToken table
CREATE TABLE IF NOT EXISTS "EventEditToken" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventEditToken_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on token
CREATE UNIQUE INDEX IF NOT EXISTS "EventEditToken_token_key" ON "EventEditToken"("token");

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "EventEditToken_eventId_idx" ON "EventEditToken"("eventId");
CREATE INDEX IF NOT EXISTS "EventEditToken_token_idx" ON "EventEditToken"("token");

-- Add foreign key constraint
ALTER TABLE "EventEditToken" ADD CONSTRAINT "EventEditToken_eventId_fkey" 
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
