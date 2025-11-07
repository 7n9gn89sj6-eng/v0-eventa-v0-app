# Testing Documentation

## Overview

Phase 2 includes comprehensive automated testing using Playwright to ensure the moderation workflow, notifications, appeals, and calendar export function correctly.

## Testing Strategy

### Test Pyramid

1. **Integration Tests** (Primary Focus)
   - Test complete user workflows end-to-end
   - Verify API endpoints with real database
   - Test email notifications (using Mailtrap)
   - Validate moderation decisions

2. **Unit Tests** (Future)
   - Test individual functions in isolation
   - Mock external dependencies
   - Fast feedback for developers

3. **E2E Tests** (Current Implementation)
   - Test full application flows
   - Browser-based testing with Playwright
   - Verify UI interactions and API calls

## Test Setup

### Prerequisites

\`\`\`bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Set up test database
cp .env.test.example .env.test
\`\`\`

### Environment Variables

\`\`\`env
# .env.test
DATABASE_URL="postgresql://test:test@localhost:5432/eventa_test"
OPENAI_API_KEY="sk-test-..."
EMAIL_SERVER_HOST="sandbox.smtp.mailtrap.io"
EMAIL_SERVER_PORT="2525"
EMAIL_SERVER_USER="test-user"
EMAIL_SERVER_PASSWORD="test-password"
EMAIL_FROM="test@eventa.app"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
\`\`\`

### Running Tests

\`\`\`bash
# Run all tests
npm test

# Run specific test file
npm test tests/moderation.spec.ts

# Run tests in headed mode (see browser)
npm test -- --headed

# Run tests in debug mode
npm test -- --debug

# Generate test report
npm test -- --reporter=html
\`\`\`

## Test Files

### tests/moderation.spec.ts

Tests the complete moderation workflow from submission to approval/rejection.

**Test Cases:**

1. **Event Submission Creates Pending Status**
   - Submit a new event
   - Verify event is created with `moderationStatus: "PENDING"`
   - Verify verification email is sent
   - Verify audit log entry is created

2. **AI Moderation Approves Clean Content**
   - Submit event with appropriate content
   - Wait for AI moderation to complete
   - Verify `moderationStatus` changes to "APPROVED"
   - Verify audit log shows AI approval
   - Verify event is visible publicly

3. **AI Moderation Flags Suspicious Content**
   - Submit event with potentially problematic content
   - Wait for AI moderation
   - Verify `moderationStatus` is "FLAGGED"
   - Verify admin notification email is sent
   - Verify event is NOT visible publicly

4. **AI Moderation Rejects Harmful Content**
   - Submit event with clear policy violations
   - Wait for AI moderation
   - Verify `moderationStatus` is "REJECTED"
   - Verify creator notification email is sent
   - Verify rejection reason is provided
   - Verify event is NOT visible publicly

5. **Admin Can Approve Flagged Event**
   - Create flagged event
   - Admin logs in
   - Admin approves event with reason
   - Verify `moderationStatus` changes to "APPROVED"
   - Verify audit log shows admin approval
   - Verify event becomes publicly visible

6. **Admin Can Reject Event**
   - Create pending event
   - Admin logs in
   - Admin rejects event with reason
   - Verify `moderationStatus` changes to "REJECTED"
   - Verify creator notification is sent
   - Verify event is NOT visible publicly

7. **Event Edit Triggers Re-moderation**
   - Create approved event
   - Edit event content via edit token
   - Verify `moderationStatus` resets to "PENDING"
   - Verify AI moderation runs again
   - Verify audit log shows edit action

8. **Public Visibility Rules Enforced**
   - Create events with different statuses
   - Query public event listing
   - Verify only APPROVED + PUBLISHED events are returned
   - Verify PENDING/FLAGGED/REJECTED events are hidden

### tests/appeal-workflow.spec.ts

Tests the appeal submission and review process.

**Test Cases:**

1. **User Can Submit Appeal for Rejected Event**
   - Create rejected event
   - Submit appeal with reason
   - Verify appeal is created with status "PENDING"
   - Verify admin notification email is sent
   - Verify audit log entry is created

2. **Cannot Appeal Non-Rejected Event**
   - Create approved event
   - Attempt to submit appeal
   - Verify error response
   - Verify no appeal is created

3. **Cannot Submit Duplicate Appeal**
   - Create rejected event
   - Submit first appeal successfully
   - Attempt to submit second appeal
   - Verify error response
   - Verify only one appeal exists

4. **Admin Can Approve Appeal**
   - Create rejected event with appeal
   - Admin logs in
   - Admin approves appeal with notes
   - Verify appeal status changes to "APPROVED"
   - Verify event `moderationStatus` changes to "APPROVED"
   - Verify creator notification is sent
   - Verify audit log shows appeal approval

5. **Admin Can Reject Appeal**
   - Create rejected event with appeal
   - Admin logs in
   - Admin rejects appeal with notes
   - Verify appeal status changes to "REJECTED"
   - Verify event remains "REJECTED"
   - Verify creator notification is sent
   - Verify audit log shows appeal rejection

6. **Appeal Notification Contains Correct Information**
   - Submit appeal
   - Check admin notification email
   - Verify email contains event details
   - Verify email contains appeal reason
   - Verify email contains review link

### tests/rate-limiting.spec.ts

Tests rate limiting for event submissions.

**Test Cases:**

1. **Rate Limit Allows 5 Submissions Per Hour**
   - Submit 5 events from same email
   - Verify all succeed
   - Verify rate limit headers are correct

2. **Rate Limit Blocks 6th Submission**
   - Submit 5 events from same email
   - Attempt 6th submission
   - Verify 429 error response
   - Verify error message explains rate limit

3. **Rate Limit Resets After 1 Hour**
   - Submit 5 events
   - Wait 1 hour (or mock time)
   - Submit another event
   - Verify submission succeeds

4. **Rate Limit Is Per Email Address**
   - Submit 5 events from email A
   - Submit event from email B
   - Verify email B submission succeeds

### tests/calendar-export.spec.ts

Tests ICS calendar file generation and download.

**Test Cases:**

1. **Calendar Export Generates Valid ICS File**
   - Create approved event
   - Request calendar export
   - Verify response is `text/calendar`
   - Verify ICS format is valid
   - Verify required fields are present

2. **ICS Contains Correct Event Details**
   - Create event with all fields
   - Export calendar
   - Parse ICS file
   - Verify title, description, dates, location match

3. **ICS Handles Special Characters**
   - Create event with special chars in title/description
   - Export calendar
   - Verify special characters are properly escaped
   - Verify line folding for long content

4. **ICS Works with Different Timezones**
   - Create events in different timezones
   - Export calendars
   - Verify timezone information is correct
   - Verify UTC conversion is accurate

5. **Calendar Import Works in Google Calendar**
   - Export ICS file
   - Import into Google Calendar (manual test)
   - Verify event appears correctly

6. **Calendar Import Works in Apple Calendar**
   - Export ICS file
   - Import into Apple Calendar (manual test)
   - Verify event appears correctly

## Test Utilities

### Test Helpers

\`\`\`typescript
// tests/helpers.ts

export async function createTestEvent(data: Partial<Event>) {
  return await prisma.event.create({
    data: {
      title: 'Test Event',
      description: 'Test description',
      startDate: new Date('2025-08-01'),
      location: 'Test Location',
      organizerEmail: 'test@example.com',
      ...data
    }
  })
}

export async function waitForModeration(eventId: string, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (event?.moderationStatus !== 'PENDING') {
      return event
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('Moderation timeout')
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.fill('[name="email"]', 'admin@eventa.app')
  await page.fill('[name="password"]', 'admin-password')
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin/events')
}
\`\`\`

### Mock Data

\`\`\`typescript
// tests/fixtures.ts

export const validEvent = {
  title: 'Community Meetup',
  description: 'A friendly gathering for local community members',
  startDate: new Date('2025-08-15T18:00:00Z'),
  location: 'Community Center, Main St',
  organizerEmail: 'organizer@example.com',
  category: 'Community',
  price: 0
}

export const suspiciousEvent = {
  title: 'Get Rich Quick Seminar',
  description: 'Learn how to make $10,000 per day with this one weird trick!',
  startDate: new Date('2025-08-15T18:00:00Z'),
  location: 'Hotel Conference Room',
  organizerEmail: 'spam@example.com',
  category: 'Business',
  price: 499
}

export const harmfulEvent = {
  title: 'Hate Group Rally',
  description: 'Join us to promote harmful ideologies...',
  startDate: new Date('2025-08-15T18:00:00Z'),
  location: 'Public Park',
  organizerEmail: 'bad@example.com',
  category: 'Political'
}
\`\`\`

## Edge Cases Tested

1. **Concurrent Submissions**
   - Multiple users submitting events simultaneously
   - Rate limiting under concurrent load
   - Database transaction handling

2. **Invalid Data**
   - Missing required fields
   - Invalid date formats
   - Malformed email addresses
   - XSS attempts in content

3. **Token Expiration**
   - Expired edit tokens
   - Invalid token signatures
   - Token reuse attempts

4. **Email Delivery Failures**
   - SMTP server unavailable
   - Invalid recipient addresses
   - Retry logic for failed sends

5. **AI Moderation Failures**
   - OpenAI API timeout
   - Invalid API responses
   - Fallback to manual review

6. **Database Constraints**
   - Unique constraint violations
   - Foreign key constraints
   - Transaction rollbacks

## Continuous Integration

### GitHub Actions Workflow

\`\`\`yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
\`\`\`

## Test Coverage Goals

- **API Endpoints**: 100% coverage of all routes
- **Moderation Logic**: 100% coverage of decision paths
- **Email Notifications**: 100% coverage of all email types
- **Audit Logging**: 100% coverage of all actions
- **Appeal Workflow**: 100% coverage of all states

## Future Testing Enhancements

1. **Performance Testing**
   - Load testing with k6 or Artillery
   - Database query performance
   - API response time benchmarks

2. **Security Testing**
   - SQL injection attempts
   - XSS vulnerability scanning
   - Authentication bypass attempts

3. **Accessibility Testing**
   - WCAG compliance checks
   - Screen reader compatibility
   - Keyboard navigation

4. **Visual Regression Testing**
   - Screenshot comparison
   - UI component testing
   - Cross-browser compatibility
