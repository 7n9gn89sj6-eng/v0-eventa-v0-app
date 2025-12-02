# Moderation & Admin Workflow

## Overview

The Eventa app implements a comprehensive moderation system that combines AI-powered content analysis with human admin oversight to ensure event quality and safety.

## Event Lifecycle

### 1. Event Creation & Submission

**User Flow:**
1. User creates an event via the homepage draft system or `/add-event` form
2. User submits the event with all required details (title, description, date, location, etc.)
3. System validates the event data

**System Actions:**
- Event is created in the database with `moderationStatus: "PENDING"`
- Verification email with edit link is sent immediately to the creator
- Audit log entry is created: `EVENT_CREATED`
- AI moderation is triggered asynchronously (non-blocking)

### 2. AI Moderation Process

**Automatic Analysis:**
The AI moderation system (`lib/ai-moderation.ts`) analyzes the event content for:

- **Harmful Content Detection:**
  - Child grooming or exploitation
  - Hate gatherings or extremist events
  - Criminal activity promotion
  - Human trafficking or exploitation
  - Violent extremism

- **Quality Assessment:**
  - Spam detection
  - Content appropriateness
  - Information completeness

**AI Decision Flow:**
\`\`\`
Event Submitted
    ↓
AI Analysis (OpenAI GPT-4)
    ↓
Decision: APPROVED | FLAGGED | REJECTED
    ↓
Database Update + Audit Log
    ↓
If FLAGGED/REJECTED → Admin Email Notification
    ↓
If REJECTED → Creator Email Notification
\`\`\`

**Moderation Results:**
- `status`: "approved" | "flagged" | "rejected"
- `reason`: Explanation of the decision
- `severity_level`: "low" | "medium" | "high" | "critical"
- `policy_category`: Which policy was violated (if any)

### 3. Moderation Status States

#### PENDING
- **Initial state** for all new events
- Event is NOT visible publicly
- Creator can edit via edit link
- Waiting for AI or admin review

#### APPROVED
- Event passed moderation checks
- **Visible publicly** in search results and event listings
- Appears in `/events` browse page
- Included in search API results
- Creator can still edit (triggers re-moderation)

#### FLAGGED
- AI detected potential issues requiring human review
- Event is NOT visible publicly
- Admin receives email notification
- Admin must manually review and decide
- Creator is NOT notified (pending admin decision)

#### REJECTED
- Event violates content policies
- Event is NOT visible publicly
- Creator receives email notification with reason
- Creator can appeal the decision
- Cannot be made public without admin approval

### 4. Admin Review Process

**Admin Dashboard Access:**
- Navigate to `/admin/events`
- View all events with filtering by moderation status
- See AI analysis results and severity levels

**Review Actions:**
1. Admin clicks on an event to view full details at `/admin/events/[id]`
2. Reviews event information, AI analysis, and audit history
3. Takes action:
   - **Approve**: Sets status to APPROVED, event becomes public
   - **Reject**: Sets status to REJECTED, creator is notified
   - **Request Changes**: (Future feature)

**Admin Controls:**
- Approve/Reject buttons with reason input
- View AI moderation analysis
- See full audit log history
- Review and respond to appeals

### 5. Creator Notifications

**Rejection Email:**
Sent automatically when an event is rejected (by AI or admin):
- Subject: "Event Rejected: [Event Title]"
- Contains rejection reason
- Includes link to appeal the decision
- Provides edit link to modify the event

**Appeal Decision Email:**
Sent when admin responds to an appeal:
- Subject: "Appeal Decision: [Event Title]"
- Contains admin's decision and notes
- If approved: Event becomes public
- If rejected: Final decision with explanation

### 6. Event Editing & Re-moderation

**Edit Flow:**
1. Creator clicks edit link from email
2. Makes changes to event details
3. Submits updated event

**System Actions:**
- `moderationStatus` is reset to "PENDING"
- Audit log entry: `EVENT_EDITED`
- AI moderation runs again on updated content
- Previous moderation results are preserved in audit log
- If rejected again, creator receives new notification

### 7. Appeal Workflow

**User Appeal Process:**
1. Creator receives rejection email
2. Clicks "Appeal this decision" link
3. Fills out appeal form at `/events/[id]/appeal`
4. Submits appeal with explanation

**System Actions:**
- Appeal record created in database
- Audit log entry: `APPEAL_SUBMITTED`
- Admin receives email notification
- Appeal status: "PENDING"

**Admin Appeal Review:**
1. Admin views appeal in event review page
2. Reads creator's appeal explanation
3. Takes action:
   - **Approve Appeal**: Event status → APPROVED, creator notified
   - **Reject Appeal**: Event remains REJECTED, creator notified

**Appeal Constraints:**
- Only one appeal allowed per event
- Appeals only available for REJECTED events
- Cannot appeal FLAGGED events (admin must review first)

## Public Visibility Rules

### Events Shown Publicly:
- Status: `PUBLISHED` (user-controlled)
- Moderation Status: `APPROVED`
- Both conditions must be true

### Events Hidden from Public:
- Status: `DRAFT` (not yet published by creator)
- Moderation Status: `PENDING`, `FLAGGED`, or `REJECTED`
- Any event that doesn't meet both public criteria

### Visibility Enforcement:
- **Event Detail Page** (`/events/[id]`): Returns 404 for non-approved events (unless creator has edit token)
- **Events Listing** (`/events`): Filters to only APPROVED events
- **Search API** (`/api/search/internal`): Only returns APPROVED events
- **Events API** (`/api/events`): Only returns APPROVED events by default

## Rate Limiting

**Submission Limits:**
- 5 events per hour per user (based on email address)
- Uses Upstash Redis for distributed rate limiting
- Returns 429 error when limit exceeded
- Prevents spam and abuse

**Implementation:**
- Sliding window algorithm
- Key: `rate-limit:event-submission:${email}`
- TTL: 1 hour
- Counter increments on each submission

## Notification System

### Email Types:

1. **Verification Email** (Immediate)
   - Sent on event creation
   - Contains edit link with token
   - Allows creator to modify event

2. **Rejection Notification** (Automatic)
   - Sent when event is rejected
   - Includes rejection reason and category
   - Provides appeal link

3. **Admin Alert** (Automatic)
   - Sent when event is flagged or rejected by AI
   - Contains event details and AI analysis
   - Includes link to admin review page

4. **Appeal Notification** (Automatic)
   - Sent to admin when user submits appeal
   - Contains appeal explanation
   - Includes link to review appeal

5. **Appeal Decision** (Manual)
   - Sent when admin responds to appeal
   - Contains decision and admin notes
   - Final outcome for the event

## Security Considerations

1. **Edit Token Validation**: All edit operations require valid JWT token
2. **Admin Authentication**: Admin routes protected by auth middleware
3. **Rate Limiting**: Prevents spam and abuse
4. **Audit Logging**: All actions tracked for accountability
5. **Content Sanitization**: User input sanitized before storage
6. **Email Verification**: Ensures creator owns the email address

## Future Enhancements

- Multi-level admin roles (moderator, admin, super-admin)
- Automated re-review after X days for flagged events
- Machine learning model training from admin decisions
- Bulk moderation actions
- Moderation queue prioritization by severity
- Creator reputation system
