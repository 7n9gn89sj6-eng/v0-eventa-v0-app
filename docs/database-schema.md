# Database Schema Documentation

## Overview

The Eventa database uses PostgreSQL (via Neon) with Prisma ORM. This document covers all models related to events, moderation, audit logs, and appeals.

## Models

### Event

The core model representing an event submission.

\`\`\`prisma
model Event {
  id                    String            @id @default(cuid())
  title                 String
  description           String
  startDate             DateTime
  endDate               DateTime?
  location              String
  latitude              Float?
  longitude             Float?
  category              String?
  price                 Float?
  currency              String?           @default("USD")
  language              String?           @default("en")
  organizerName         String?
  organizerEmail        String
  organizerPhone        String?
  externalUrl           String?
  imageUrl              String?
  status                EventStatus       @default(DRAFT)
  
  // Moderation fields (Phase 2)
  moderationStatus      ModerationStatus  @default(PENDING)
  moderationReason      String?
  moderationCategory    String?
  severityLevel         String?
  
  editToken             String            @unique
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  
  // Relations
  auditLogs             AuditLog[]
  appeals               Appeal[]
  favorites             Favorite[]
}
\`\`\`

#### Field Descriptions

**Core Event Fields:**
- `id`: Unique identifier (CUID format)
- `title`: Event name/title
- `description`: Full event description
- `startDate`: Event start date and time
- `endDate`: Optional end date and time
- `location`: Human-readable location string
- `latitude`/`longitude`: Geocoded coordinates for mapping
- `category`: Event category (e.g., "Music", "Sports", "Technology")
- `price`: Event cost (0 for free events)
- `currency`: Price currency code (default: USD)
- `language`: Event language code (default: en)

**Organizer Fields:**
- `organizerName`: Event organizer's name
- `organizerEmail`: Contact email (used for notifications)
- `organizerPhone`: Optional contact phone
- `externalUrl`: Link to external event page/tickets
- `imageUrl`: Event banner/poster image URL

**Status Fields:**
- `status`: User-controlled publication status
  - `DRAFT`: Not yet published by creator
  - `PUBLISHED`: Creator has published the event
  - `ARCHIVED`: Event is archived/past
- `moderationStatus`: System-controlled moderation state
  - `PENDING`: Awaiting moderation review
  - `APPROVED`: Passed moderation, can be public
  - `FLAGGED`: Requires admin review
  - `REJECTED`: Violates policies, not allowed

**Moderation Fields (Phase 2):**
- `moderationReason`: Explanation for flagged/rejected status
- `moderationCategory`: Policy category violated (e.g., "hate_speech", "spam")
- `severityLevel`: Risk level ("low", "medium", "high", "critical")

**Security Fields:**
- `editToken`: JWT token for passwordless editing
- `createdAt`: Timestamp of event creation
- `updatedAt`: Timestamp of last modification

#### Enums

\`\`\`prisma
enum EventStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum ModerationStatus {
  PENDING
  APPROVED
  FLAGGED
  REJECTED
}
\`\`\`

### AuditLog

Tracks all moderation actions and event lifecycle changes.

\`\`\`prisma
model AuditLog {
  id          String   @id @default(cuid())
  eventId     String
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  action      String   // e.g., "EVENT_CREATED", "MODERATION_APPROVED"
  actor       String?  // Admin email or "SYSTEM" for automated actions
  notes       String?  // Additional context or reason
  metadata    Json?    // Flexible field for action-specific data
  createdAt   DateTime @default(now())
  
  @@index([eventId])
  @@index([createdAt])
}
\`\`\`

#### Field Descriptions

- `id`: Unique log entry identifier
- `eventId`: Reference to the event being logged
- `action`: Type of action performed (see Action Types below)
- `actor`: Who performed the action
  - Admin email for manual actions
  - `"SYSTEM"` for automated actions (AI moderation)
  - `null` for user actions
- `notes`: Human-readable explanation or reason
- `metadata`: JSON field for additional structured data
  - AI analysis results
  - Previous status values
  - Appeal information
- `createdAt`: When the action occurred

#### Action Types

- `EVENT_CREATED`: Event initially submitted
- `EVENT_EDITED`: Event details modified by creator
- `AI_MODERATION_APPROVED`: AI approved the event
- `AI_MODERATION_FLAGGED`: AI flagged for review
- `AI_MODERATION_REJECTED`: AI rejected the event
- `ADMIN_APPROVED`: Admin manually approved
- `ADMIN_REJECTED`: Admin manually rejected
- `APPEAL_SUBMITTED`: Creator submitted an appeal
- `APPEAL_APPROVED`: Admin approved the appeal
- `APPEAL_REJECTED`: Admin rejected the appeal

### Appeal

Handles user appeals for rejected events.

\`\`\`prisma
model Appeal {
  id          String       @id @default(cuid())
  eventId     String
  event       Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  reason      String       // Creator's explanation for appeal
  status      AppealStatus @default(PENDING)
  adminNotes  String?      // Admin's response/decision notes
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  
  @@index([eventId])
  @@index([status])
}

enum AppealStatus {
  PENDING
  APPROVED
  REJECTED
}
\`\`\`

#### Field Descriptions

- `id`: Unique appeal identifier
- `eventId`: Reference to the event being appealed
- `reason`: Creator's explanation for why the rejection was incorrect
- `status`: Current appeal state
  - `PENDING`: Awaiting admin review
  - `APPROVED`: Admin approved, event status changed to APPROVED
  - `REJECTED`: Admin rejected, event remains REJECTED
- `adminNotes`: Admin's explanation for their decision
- `createdAt`: When appeal was submitted
- `updatedAt`: When appeal status was last changed

#### Constraints

- One appeal per event (enforced in application logic)
- Appeals only allowed for REJECTED events
- Cannot appeal FLAGGED events (admin must review first)

### Favorite

Allows authenticated users to save favorite events.

\`\`\`prisma
model Favorite {
  id        String   @id @default(cuid())
  userId    String
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  
  @@unique([userId, eventId])
  @@index([userId])
  @@index([eventId])
}
\`\`\`

#### Field Descriptions

- `id`: Unique favorite identifier
- `userId`: User who favorited the event
- `eventId`: Reference to the favorited event
- `createdAt`: When the favorite was added

## Database Migrations

### Migration Scripts

1. **01-enable-pgvector.sql**: Enables PostgreSQL vector extension for search
2. **02-create-search-indexes.sql**: Creates full-text search indexes
3. **03-add-moderation-fields.sql**: Adds moderation fields to Event table
4. **04-add-audit-and-appeals.sql**: Creates AuditLog and Appeal tables

### Running Migrations

\`\`\`bash
# Apply Prisma schema changes
npx prisma migrate dev

# Run custom SQL scripts (in order)
psql $DATABASE_URL -f scripts/01-enable-pgvector.sql
psql $DATABASE_URL -f scripts/02-create-search-indexes.sql
psql $DATABASE_URL -f scripts/03-add-moderation-fields.sql
psql $DATABASE_URL -f scripts/04-add-audit-and-appeals.sql
\`\`\`

## Indexes

### Performance Indexes

- `Event.moderationStatus`: Fast filtering by moderation state
- `Event.status`: Fast filtering by publication status
- `Event.createdAt`: Chronological sorting
- `AuditLog.eventId`: Fast audit log lookups per event
- `AuditLog.createdAt`: Chronological audit history
- `Appeal.eventId`: Fast appeal lookups per event
- `Appeal.status`: Fast filtering of pending appeals
- `Favorite.userId`: Fast user favorites lookup
- `Favorite.eventId`: Fast event favorites count

### Search Indexes

- Full-text search on `Event.title` and `Event.description`
- GIN index for efficient text search queries
- Vector search support via pgvector extension

## Data Relationships

\`\`\`
Event (1) ──→ (N) AuditLog
Event (1) ──→ (N) Appeal
Event (1) ──→ (N) Favorite

User (1) ──→ (N) Favorite
\`\`\`

## Query Examples

### Get all approved public events
\`\`\`typescript
const events = await prisma.event.findMany({
  where: {
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED'
  },
  orderBy: { startDate: 'asc' }
})
\`\`\`

### Get event with audit history
\`\`\`typescript
const event = await prisma.event.findUnique({
  where: { id: eventId },
  include: {
    auditLogs: {
      orderBy: { createdAt: 'desc' }
    }
  }
})
\`\`\`

### Get pending appeals for admin
\`\`\`typescript
const appeals = await prisma.appeal.findMany({
  where: { status: 'PENDING' },
  include: {
    event: true
  },
  orderBy: { createdAt: 'asc' }
})
