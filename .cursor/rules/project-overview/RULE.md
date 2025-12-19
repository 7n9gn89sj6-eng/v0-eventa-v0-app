---
alwaysApply: true
---

I am not a programmer but a novice:

# Eventa - Project Overview

Eventa is a multilingual community events platform with AI-powered hybrid search capabilities. This document explains the application's purpose, core functionality, user flows, and technical architecture to help developers understand and work with the codebase.

## Application Purpose

Eventa enables users to:

- **Browse Events**: Anyone can search and browse events without requiring login or authentication
- **AI-Powered Search**: Plain language, multilingual search with intelligent synonym expansion (e.g., "market" matches "fiesta", "festa", "bazaar")
- **Hybrid Search**: Combines local database results with optional Google web search results
- **Post Events**: Authenticated users can create events with automatic geocoding and location mapping
- **Multilingual Support**: UI available in 5 languages (English, Italian, Greek, Spanish, French)

## Core User Flows

### 1. Browse/Search Flow (No Login Required)
- User enters natural language query (e.g., "jazz events in Rome this weekend")
- AI extracts intent: location (Rome), category (jazz), date (this weekend)
- System performs hybrid search: internal database + optional web search
- Results are ranked by relevance (date match, location match, text similarity)
- User can filter by date range, category, price, distance
- User can view event details, export to calendar (.ics file)

### 2. Event Creation Flow (Authenticated)
- User signs in via email magic link (NextAuth)
- User fills out event form: title, description, date/time, location, category, price
- System geocodes location (address → lat/lng via Mapbox)
- Event is saved with status: PENDING
- User receives email with edit link (no login required for edits)
- AI moderation automatically analyzes content
- Event status changes based on AI decision:
  - APPROVED → Event becomes publicly visible
  - FLAGGED → Admin receives notification for review
  - REJECTED → Creator receives notification with reason

### 3. Event Editing Flow (Via Email Link)
- User clicks edit link from email (no login required)
- System validates edit token
- User updates event details
- Event triggers re-moderation (status returns to PENDING)
- Same approval workflow applies

### 4. Admin Moderation Workflow
- Admin accesses dashboard at `/admin/events`
- Views events filtered by moderation status (PENDING, FLAGGED, REJECTED)
- Reviews AI analysis: severity level, detected issues, confidence scores
- Admin can:
  - Approve event → Status: APPROVED, becomes public
  - Reject event → Status: REJECTED, creator notified
  - Add custom moderation reason/notes
- All actions logged in audit trail

### 5. Appeal Process
- Creator receives rejection notification with reason
- Creator can submit appeal via event page
- Admin receives email notification of appeal
- Admin reviews appeal and can:
  - Approve appeal → Event status: APPROVED
  - Reject appeal → Creator notified of final decision
- Appeal history tracked in audit logs

## Key Features

### AI-Powered Multilingual Search
- **Intent Extraction**: AI parses natural language queries to extract:
  - Location (city, country)
  - Date (relative: "this weekend", "next month" | specific: "April 2026", "30 April 2026")
  - Category/Type (jazz, market, theatre, etc.)
  - Duration (e.g., "for one week")
- **Synonym Expansion**: Automatically matches related terms (market/fiesta/festa/bazaar)
- **Language Detection**: Detects query language and normalizes accordingly
- **Date Parsing**: Intelligent parsing of dates from text (month names, relative dates, specific dates)

### Hybrid Search System
- **Internal Database Search**: 
  - Full-text search using pg_trgm (trigram matching)
  - Optional semantic search using pgvector embeddings
  - Filters by date range, location, category
  - Results ranked by relevance score
- **External Web Search** (Optional):
  - Google Programmable Search Engine integration
  - Filters results by date range and location
  - Extracts dates from page content when structured data is incorrect
  - Deduplicates against internal results

### Date and Location Filtering
- **Date Filtering**:
  - Parses natural language dates ("April 2026", "this weekend", "30 April 2026")
  - Applies strict date range filtering in database queries
  - Post-filters results to remove outliers (>7 days outside range)
  - Boosts events within requested date range in ranking
- **Location Filtering**:
  - City name matching with disambiguation (excludes "Berlin Maryland" when searching "Berlin")
  - Geocoding for distance-based filtering
  - Location-aware result ranking

### AI Moderation
- **Automatic Content Screening**: All submitted events analyzed by AI
- **Harmful Content Detection**: Identifies:
  - Grooming/exploitation
  - Hate gatherings
  - Criminal activity
  - Extremism
- **Three-Tier Decision System**:
  - APPROVED: Safe content, immediately public
  - FLAGGED: Needs human review, admin notified
  - REJECTED: Violates policies, creator notified
- **Severity Levels**: Low, Medium, High, Critical

### Rate Limiting
- **5 events per hour** per email address
- Prevents spam and abuse
- Uses Upstash Redis for distributed rate limiting
- Applies to event submissions only (not browsing/searching)

### Calendar Export
- Events can be downloaded as `.ics` files
- Compatible with Google Calendar, Apple Calendar, Outlook
- Includes event details, location, timezone information
- Accessible via `/api/events/:id/calendar` endpoint

### Multilingual UI
- UI translations in 5 languages: English (en), Italian (it), Greek (el), Spanish (es), French (fr)
- Language switcher in header (globe icon)
- Language preference stored in cookie
- Search accepts queries in any language

## Technical Architecture

### Framework & Core Technologies
- **Next.js 16**: App Router architecture, Server Components by default
- **TypeScript**: Full type safety throughout codebase
- **PostgreSQL**: Primary database via Neon (cloud PostgreSQL)
- **Prisma ORM**: Database schema management and query builder
- **Tailwind CSS + shadcn/ui**: Modern, responsive UI components

### Search Infrastructure
- **pg_trgm**: PostgreSQL extension for fuzzy text matching (keyword search)
- **pgvector**: PostgreSQL extension for semantic/vector search (optional)
- **Search Indexes**: Optimized indexes on title, description, city, categories
- **Hybrid Approach**: Combines database search with external web search

### Authentication
- **NextAuth.js**: Authentication framework
- **Email Magic Links**: Passwordless authentication via email
- **Optional Feature**: Can be disabled (`NEXT_PUBLIC_AUTH_ENABLED=false`) for browse-only mode
- **Admin Access**: Granted via database flag (`User.isAdmin = true`)

### AI & External Services
- **Vercel AI SDK**: AI integration framework
- **OpenAI API**: Powers intent extraction and content moderation
- **Google Programmable Search Engine**: Web search integration
- **Mapbox**: Geocoding and mapping services
- **Upstash Redis**: Rate limiting and caching

### Internationalization
- **next-intl**: Internationalization framework
- **Translation Files**: Located in `i18n/messages/`
- **Language Detection**: Automatic detection from user query
- **Cookie-Based Preference**: User language choice persisted

## Data Flow

### Event Submission Flow
```
User submits event
  ↓
Rate limit check (5/hour)
  ↓
Event saved: status = PENDING
  ↓
Email sent to user with edit link
  ↓
AI moderation analyzes content
  ↓
AI Decision:
  ├─ APPROVED → Event visible publicly
  ├─ FLAGGED → Admin notification sent
  └─ REJECTED → Creator notification sent
  ↓
Admin reviews (if FLAGGED)
  ↓
Final status: APPROVED or REJECTED
```

### Search Flow
```
User enters query
  ↓
AI intent extraction:
  - Extracts: location, date, category, keywords
  - Parses dates (natural language → ISO dates)
  ↓
Dual search execution:
  ├─ Internal: Database search with filters
  └─ External: Google web search (optional)
  ↓
Results merged and deduplicated
  ↓
Date/location filtering applied
  ↓
Results ranked by relevance:
  - Date match (within range = +10, outside = penalty)
  - Location match (+1)
  - Text similarity (title match = +2, description = +1)
  ↓
Results displayed to user
```

## Important Notes

### Event Visibility Rules
Events are only visible publicly when **BOTH** conditions are met:
1. **Event Status**: PUBLISHED (user-controlled)
2. **Moderation Status**: APPROVED (system-controlled)

Events with status PENDING, FLAGGED, or REJECTED are hidden from public view.

### Authentication Modes
- **Browse-Only Mode**: When `NEXT_PUBLIC_AUTH_ENABLED=false`
  - Users can search and browse events
  - Sign-in button is disabled
  - Event creation is not available
- **Full Mode**: When `NEXT_PUBLIC_AUTH_ENABLED=true` and email service configured
  - Users can sign in via email magic links
  - Authenticated users can create events
  - Admin dashboard accessible

### Current Deployment Stack
- **Hosting**: Render (not Vercel)
- **Version Control**: GitHub
- **Development**: Cursor IDE
- **Database**: Neon PostgreSQL (direct connection, not pooled for long-lived processes)

### Database Connection
- **Important**: Use direct connection string (no `-pooler`) for Render deployment
- Pooled connections are for serverless platforms (Vercel, Cloudflare Edge)
- Direct connections are required for long-lived Node.js processes

### Date Filtering Behavior
- Date filters are strictly enforced in database WHERE clauses
- Events outside the requested date range are filtered out
- Month names (e.g., "April") are parsed as full month ranges (April 1-30)
- Specific dates (e.g., "30 April 2026") create precise date ranges
- External search results have dates extracted from page content when structured data is incorrect

### Code Organization
- **API Routes**: `app/api/` - Server-side endpoints
- **Pages**: `app/` - Next.js pages and layouts
- **Components**: `components/` - Reusable React components
- **Utilities**: `lib/` - Helper functions, database client, types
- **Database Schema**: `prisma/schema.prisma` - Prisma schema definition
- **Translations**: `i18n/messages/` - Language files

## Key Files Reference

- **Database Client**: `lib/db.ts` - Prisma client initialization
- **Search Routes**: 
  - `app/api/search/intent/route.ts` - AI intent extraction
  - `app/api/search/internal/route.ts` - Internal database search
  - `app/api/search/external/route.ts` - External web search
  - `app/api/search/dual/route.ts` - Combines internal + external
- **Event Routes**: `app/api/events/` - CRUD operations for events
- **Admin Routes**: `app/api/admin/` - Moderation and admin functions
- **Search Components**: `components/search/` - Search UI components
- **Event Components**: `components/events/` - Event display components
