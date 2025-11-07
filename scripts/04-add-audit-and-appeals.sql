-- Add moderation tracking fields
ALTER TABLE "Event" 
ADD COLUMN IF NOT EXISTS "moderatedBy" TEXT,
ADD CONSTRAINT "Event_moderatedBy_fkey" 
  FOREIGN KEY ("moderatedBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- Create audit log table
CREATE TABLE IF NOT EXISTS "EventAuditLog" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "oldStatus" TEXT,
  "newStatus" TEXT,
  "notes" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventAuditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EventAuditLog_eventId_idx" ON "EventAuditLog"("eventId");
CREATE INDEX IF NOT EXISTS "EventAuditLog_createdAt_idx" ON "EventAuditLog"("createdAt");

-- Create appeals table
CREATE TABLE IF NOT EXISTS "EventAppeal" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventAppeal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE,
  CONSTRAINT "EventAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EventAppeal_eventId_idx" ON "EventAppeal"("eventId");
CREATE INDEX IF NOT EXISTS "EventAppeal_status_idx" ON "EventAppeal"("status");
