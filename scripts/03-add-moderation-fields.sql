-- Add moderation enums and fields to Event table

-- Create moderation status enum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED');

-- Create moderation severity enum
CREATE TYPE "ModerationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- Add moderation fields to Event table
ALTER TABLE "Event" 
ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "moderationReason" TEXT,
ADD COLUMN "moderationSeverity" "ModerationSeverity",
ADD COLUMN "moderationCategory" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3);

-- Create index for moderation queries
CREATE INDEX "Event_moderationStatus_idx" ON "Event"("moderationStatus");
