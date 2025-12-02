# API Endpoints Documentation

## Overview

This document covers all API endpoints added or modified in Phase 2 for event moderation, admin controls, appeals, and audit logging.

## Public Event Endpoints

### GET /api/events

Get a list of published, approved events.

**Query Parameters:**
- `status` (optional): Filter by event status (default: "PUBLISHED")
- `moderationStatus` (optional): Filter by moderation status (default: "APPROVED")
- `category` (optional): Filter by event category
- `search` (optional): Search in title and description
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
\`\`\`json
{
  "events": [
    {
      "id": "clx123...",
      "title": "Summer Music Festival",
      "description": "Annual outdoor music event",
      "startDate": "2025-07-15T18:00:00Z",
      "location": "Central Park, NYC",
      "category": "Music",
      "price": 50,
      "moderationStatus": "APPROVED",
      "status": "PUBLISHED"
    }
  ],
  "total": 42
}
\`\`\`

### POST /api/events/submit

Submit a new event for moderation.

**Rate Limit:** 5 requests per hour per email

**Request Body:**
\`\`\`json
{
  "title": "Tech Conference 2025",
  "description": "Annual technology conference",
  "startDate": "2025-08-20T09:00:00Z",
  "endDate": "2025-08-22T17:00:00Z",
  "location": "Convention Center, SF",
  "organizerEmail": "organizer@example.com",
  "organizerName": "Tech Corp",
  "category": "Technology",
  "price": 299,
  "externalUrl": "https://techconf.example.com"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "event": {
    "id": "clx456...",
    "moderationStatus": "PENDING",
    "editToken": "eyJhbGc..."
  },
  "message": "Event submitted successfully. Check your email for verification."
}
\`\`\`

**Error Responses:**
- `429`: Rate limit exceeded
- `400`: Invalid event data
- `500`: Server error

### GET /api/events/[id]

Get details of a specific event.

**Path Parameters:**
- `id`: Event ID

**Query Parameters:**
- `token` (optional): Edit token for viewing non-public events

**Response:**
\`\`\`json
{
  "id": "clx123...",
  "title": "Summer Music Festival",
  "description": "Annual outdoor music event",
  "startDate": "2025-07-15T18:00:00Z",
  "endDate": "2025-07-15T23:00:00Z",
  "location": "Central Park, NYC",
  "latitude": 40.7829,
  "longitude": -73.9654,
  "category": "Music",
  "price": 50,
  "currency": "USD",
  "organizerName": "Music Events Inc",
  "organizerEmail": "contact@musicevents.com",
  "externalUrl": "https://summerfest.example.com",
  "imageUrl": "https://blob.vercel-storage.com/...",
  "moderationStatus": "APPROVED",
  "status": "PUBLISHED",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
\`\`\`

**Error Responses:**
- `404`: Event not found or not approved
- `403`: Unauthorized (for non-public events without valid token)

### PUT /api/events/[id]

Update an existing event (requires edit token).

**Path Parameters:**
- `id`: Event ID

**Query Parameters:**
- `token`: Edit token (required)

**Request Body:**
\`\`\`json
{
  "title": "Updated Event Title",
  "description": "Updated description",
  "startDate": "2025-08-20T09:00:00Z"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "event": {
    "id": "clx123...",
    "moderationStatus": "PENDING",
    "message": "Event updated. Re-running moderation."
  }
}
\`\`\`

**Behavior:**
- Resets `moderationStatus` to "PENDING"
- Triggers AI moderation on updated content
- Creates audit log entry

### GET /api/events/[id]/calendar

Download event as ICS calendar file.

**Path Parameters:**
- `id`: Event ID

**Response:**
- Content-Type: `text/calendar`
- Downloads `.ics` file compatible with Google Calendar, Apple Calendar, Outlook

**ICS Format:**
\`\`\`
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eventa//Event Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:clx123@eventa.app
DTSTAMP:20250115T100000Z
DTSTART:20250715T180000Z
DTEND:20250715T230000Z
SUMMARY:Summer Music Festival
DESCRIPTION:Annual outdoor music event...
LOCATION:Central Park, NYC
ORGANIZER;CN=Music Events Inc:mailto:contact@musicevents.com
URL:https://eventa.app/events/clx123
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
\`\`\`

### POST /api/events/[id]/appeal

Submit an appeal for a rejected event.

**Path Parameters:**
- `id`: Event ID

**Query Parameters:**
- `token`: Edit token (required)

**Request Body:**
\`\`\`json
{
  "reason": "This event does not violate any policies. It's a legitimate community gathering."
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "appeal": {
    "id": "clx789...",
    "status": "PENDING"
  },
  "message": "Appeal submitted successfully. An admin will review it shortly."
}
\`\`\`

**Error Responses:**
- `400`: Event not rejected or appeal already exists
- `403`: Invalid edit token
- `404`: Event not found

### POST /api/events/[id]/favorite

Add event to user's favorites (requires authentication).

**Path Parameters:**
- `id`: Event ID

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Event added to favorites"
}
\`\`\`

### DELETE /api/events/[id]/favorite

Remove event from user's favorites (requires authentication).

**Path Parameters:**
- `id`: Event ID

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Event removed from favorites"
}
\`\`\`

## Admin Endpoints

All admin endpoints require authentication and admin role.

### GET /api/admin/events

Get all events with moderation details (admin only).

**Query Parameters:**
- `status` (optional): Filter by moderation status
- `severity` (optional): Filter by severity level
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
\`\`\`json
{
  "events": [
    {
      "id": "clx123...",
      "title": "Event Title",
      "moderationStatus": "FLAGGED",
      "severityLevel": "medium",
      "moderationReason": "Potential spam content detected",
      "moderationCategory": "spam",
      "createdAt": "2025-01-15T10:00:00Z",
      "organizerEmail": "user@example.com"
    }
  ],
  "total": 15
}
\`\`\`

### GET /api/admin/events/[id]

Get detailed event information with audit logs (admin only).

**Path Parameters:**
- `id`: Event ID

**Response:**
\`\`\`json
{
  "event": {
    "id": "clx123...",
    "title": "Event Title",
    "description": "Full description...",
    "moderationStatus": "FLAGGED",
    "moderationReason": "AI detected potential policy violation",
    "severityLevel": "high",
    "moderationCategory": "hate_speech"
  },
  "auditLogs": [
    {
      "id": "clx999...",
      "action": "AI_MODERATION_FLAGGED",
      "actor": "SYSTEM",
      "notes": "Content flagged for manual review",
      "createdAt": "2025-01-15T10:05:00Z"
    }
  ],
  "appeals": [
    {
      "id": "clx888...",
      "reason": "This is a false positive...",
      "status": "PENDING",
      "createdAt": "2025-01-15T11:00:00Z"
    }
  ]
}
\`\`\`

### POST /api/admin/events/[id]/moderate

Approve or reject an event (admin only).

**Path Parameters:**
- `id`: Event ID

**Request Body:**
\`\`\`json
{
  "action": "approve",  // or "reject"
  "reason": "Event meets all guidelines",
  "notes": "Reviewed content, no policy violations found"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "event": {
    "id": "clx123...",
    "moderationStatus": "APPROVED"
  },
  "message": "Event approved successfully"
}
\`\`\`

**Behavior:**
- Updates `moderationStatus`
- Creates audit log entry
- Sends notification to creator (if rejected)
- If approved, event becomes publicly visible

### POST /api/admin/events/[id]/appeal

Respond to an appeal (admin only).

**Path Parameters:**
- `id`: Event ID

**Request Body:**
\`\`\`json
{
  "action": "approve",  // or "reject"
  "adminNotes": "After review, this event is acceptable"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "appeal": {
    "id": "clx888...",
    "status": "APPROVED"
  },
  "message": "Appeal approved. Event is now public."
}
\`\`\`

**Behavior:**
- Updates appeal status
- If approved: Changes event `moderationStatus` to "APPROVED"
- Creates audit log entry
- Sends notification to creator

### GET /api/admin/summary

Get moderation statistics (admin only).

**Response:**
\`\`\`json
{
  "pending": 12,
  "flagged": 5,
  "approved": 234,
  "rejected": 18,
  "pendingAppeals": 3,
  "recentActivity": [
    {
      "eventId": "clx123...",
      "action": "AI_MODERATION_FLAGGED",
      "createdAt": "2025-01-15T14:30:00Z"
    }
  ]
}
\`\`\`

## Search Endpoints

### POST /api/search/internal

Search for events using natural language or filters.

**Request Body:**
\`\`\`json
{
  "query": "music festivals in NYC",
  "filters": {
    "category": "Music",
    "priceRange": [0, 100],
    "dateRange": {
      "start": "2025-07-01",
      "end": "2025-08-31"
    }
  },
  "limit": 20
}
\`\`\`

**Response:**
\`\`\`json
{
  "results": [
    {
      "id": "clx123...",
      "title": "Summer Music Festival",
      "description": "Annual outdoor music event",
      "startDate": "2025-07-15T18:00:00Z",
      "location": "Central Park, NYC",
      "score": 0.95
    }
  ],
  "total": 8
}
\`\`\`

**Behavior:**
- Only returns APPROVED events
- Uses full-text search and vector similarity
- Filters by moderation status automatically

## Error Responses

All endpoints follow consistent error response format:

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
\`\`\`

**Common Error Codes:**
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `VALIDATION_ERROR`: Invalid request data
- `INTERNAL_ERROR`: Server error

## Rate Limiting

**Event Submission:**
- Limit: 5 requests per hour per email
- Header: `X-RateLimit-Remaining`
- Reset: `X-RateLimit-Reset`

**Other Endpoints:**
- No rate limiting currently implemented
- Future: General API rate limiting per IP/user
