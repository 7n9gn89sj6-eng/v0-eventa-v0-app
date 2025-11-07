# Audit Logs Documentation

## Overview

The audit log system provides complete transparency and accountability for all moderation actions and event lifecycle changes in the Eventa platform.

## Purpose

Audit logs serve multiple purposes:

1. **Accountability**: Track who made what decisions and when
2. **Transparency**: Provide creators with visibility into moderation process
3. **Debugging**: Help diagnose issues with event status or moderation
4. **Compliance**: Maintain records for legal or policy requirements
5. **Analytics**: Understand moderation patterns and AI performance

## Log Entry Structure

### Database Schema

\`\`\`prisma
model AuditLog {
  id          String   @id @default(cuid())
  eventId     String
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  action      String
  actor       String?
  notes       String?
  metadata    Json?
  createdAt   DateTime @default(now())
}
\`\`\`

### Field Descriptions

**id**: Unique identifier for the log entry (CUID format)

**eventId**: Reference to the event being logged

**action**: Type of action performed (see Action Types below)

**actor**: Who performed the action
- Admin email address (e.g., "admin@eventa.app") for manual actions
- `"SYSTEM"` for automated actions (AI moderation, scheduled tasks)
- `null` for user-initiated actions (event creation, editing)

**notes**: Human-readable explanation or reason
- Admin's reason for approval/rejection
- AI's explanation for moderation decision
- System notes for automated actions

**metadata**: JSON field for additional structured data
- AI analysis results (confidence scores, detected categories)
- Previous status values (for tracking changes)
- Appeal information
- Request details (IP address, user agent)

**createdAt**: Timestamp when the action occurred (UTC)

## Action Types

### Event Lifecycle Actions

**EVENT_CREATED**
- Triggered when: User submits a new event
- Actor: `null` (user action)
- Notes: "Event submitted by creator"
- Metadata: `{ organizerEmail: string }`

**EVENT_EDITED**
- Triggered when: Creator updates event details
- Actor: `null` (user action)
- Notes: "Event updated by creator"
- Metadata: `{ changedFields: string[], previousStatus: string }`

**EVENT_PUBLISHED**
- Triggered when: Creator publishes a draft event
- Actor: `null` (user action)
- Notes: "Event published by creator"

**EVENT_ARCHIVED**
- Triggered when: Event is archived (past date or manual)
- Actor: `"SYSTEM"` or admin email
- Notes: "Event archived"

### AI Moderation Actions

**AI_MODERATION_APPROVED**
- Triggered when: AI determines event is safe and appropriate
- Actor: `"SYSTEM"`
- Notes: "AI moderation approved event"
- Metadata:
\`\`\`json
{
  "aiAnalysis": {
    "status": "approved",
    "confidence": 0.95,
    "categories_checked": ["spam", "hate_speech", "exploitation"],
    "flags": []
  }
}
\`\`\`

**AI_MODERATION_FLAGGED**
- Triggered when: AI detects potential issues requiring human review
- Actor: `"SYSTEM"`
- Notes: "AI flagged event for manual review: [reason]"
- Metadata:
\`\`\`json
{
  "aiAnalysis": {
    "status": "flagged",
    "reason": "Potential spam content detected",
    "severity_level": "medium",
    "policy_category": "spam",
    "confidence": 0.72,
    "detected_patterns": ["excessive capitalization", "promotional language"]
  }
}
\`\`\`

**AI_MODERATION_REJECTED**
- Triggered when: AI determines event violates policies
- Actor: `"SYSTEM"`
- Notes: "AI rejected event: [reason]"
- Metadata:
\`\`\`json
{
  "aiAnalysis": {
    "status": "rejected",
    "reason": "Content promotes harmful activities",
    "severity_level": "high",
    "policy_category": "hate_speech",
    "confidence": 0.89,
    "violations": ["promotes discrimination", "contains hate speech"]
  }
}
\`\`\`

### Admin Moderation Actions

**ADMIN_APPROVED**
- Triggered when: Admin manually approves an event
- Actor: Admin email address
- Notes: Admin's reason for approval
- Metadata: `{ previousStatus: string }`

**ADMIN_REJECTED**
- Triggered when: Admin manually rejects an event
- Actor: Admin email address
- Notes: Admin's reason for rejection
- Metadata: `{ previousStatus: string, policyViolations: string[] }`

**ADMIN_STATUS_CHANGED**
- Triggered when: Admin changes event status manually
- Actor: Admin email address
- Notes: "Status changed from [old] to [new]"
- Metadata: `{ previousStatus: string, newStatus: string }`

### Appeal Actions

**APPEAL_SUBMITTED**
- Triggered when: Creator submits an appeal for rejected event
- Actor: `null` (user action)
- Notes: "Creator submitted appeal"
- Metadata:
\`\`\`json
{
  "appealId": "clx123...",
  "appealReason": "This event does not violate policies..."
}
\`\`\`

**APPEAL_APPROVED**
- Triggered when: Admin approves an appeal
- Actor: Admin email address
- Notes: Admin's explanation for approving appeal
- Metadata:
\`\`\`json
{
  "appealId": "clx123...",
  "previousStatus": "REJECTED",
  "newStatus": "APPROVED"
}
\`\`\`

**APPEAL_REJECTED**
- Triggered when: Admin rejects an appeal
- Actor: Admin email address
- Notes: Admin's explanation for rejecting appeal
- Metadata:
\`\`\`json
{
  "appealId": "clx123...",
  "finalDecision": true
}
\`\`\`

## Creating Audit Logs

### Using the Audit Log Helper

\`\`\`typescript
import { createAuditLog } from '@/lib/audit-log'

// Example: Log event creation
await createAuditLog({
  eventId: event.id,
  action: 'EVENT_CREATED',
  actor: null,
  notes: 'Event submitted by creator',
  metadata: {
    organizerEmail: event.organizerEmail
  }
})

// Example: Log admin approval
await createAuditLog({
  eventId: event.id,
  action: 'ADMIN_APPROVED',
  actor: 'admin@eventa.app',
  notes: 'Event meets all guidelines',
  metadata: {
    previousStatus: 'FLAGGED'
  }
})

// Example: Log AI moderation
await createAuditLog({
  eventId: event.id,
  action: 'AI_MODERATION_FLAGGED',
  actor: 'SYSTEM',
  notes: 'AI flagged event for manual review: Potential spam content',
  metadata: {
    aiAnalysis: {
      status: 'flagged',
      reason: 'Potential spam content detected',
      severity_level: 'medium',
      confidence: 0.72
    }
  }
})
\`\`\`

### Direct Prisma Creation

\`\`\`typescript
await prisma.auditLog.create({
  data: {
    eventId: event.id,
    action: 'EVENT_EDITED',
    actor: null,
    notes: 'Event updated by creator',
    metadata: {
      changedFields: ['title', 'description'],
      previousStatus: 'APPROVED'
    }
  }
})
\`\`\`

## Querying Audit Logs

### Get All Logs for an Event

\`\`\`typescript
const logs = await prisma.auditLog.findMany({
  where: { eventId: event.id },
  orderBy: { createdAt: 'desc' }
})
\`\`\`

### Get Recent Moderation Actions

\`\`\`typescript
const recentActions = await prisma.auditLog.findMany({
  where: {
    action: {
      in: ['ADMIN_APPROVED', 'ADMIN_REJECTED', 'AI_MODERATION_FLAGGED']
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
  include: {
    event: {
      select: {
        id: true,
        title: true,
        organizerEmail: true
      }
    }
  }
})
\`\`\`

### Get Admin Activity

\`\`\`typescript
const adminActivity = await prisma.auditLog.findMany({
  where: {
    actor: 'admin@eventa.app',
    createdAt: {
      gte: new Date('2025-01-01')
    }
  },
  orderBy: { createdAt: 'desc' }
})
\`\`\`

### Get AI Moderation Statistics

\`\`\`typescript
const aiStats = await prisma.auditLog.groupBy({
  by: ['action'],
  where: {
    actor: 'SYSTEM',
    action: {
      startsWith: 'AI_MODERATION_'
    }
  },
  _count: true
})
\`\`\`

## Displaying Audit Logs

### Admin Dashboard View

\`\`\`typescript
// components/admin/audit-log-viewer.tsx
export function AuditLogViewer({ eventId }: { eventId: string }) {
  const logs = useAuditLogs(eventId)
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Audit History</h3>
      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id} className="border rounded p-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium">{formatAction(log.action)}</span>
                {log.actor && (
                  <span className="text-sm text-muted-foreground ml-2">
                    by {log.actor}
                  </span>
                )}
              </div>
              <time className="text-sm text-muted-foreground">
                {formatDate(log.createdAt)}
              </time>
            </div>
            {log.notes && (
              <p className="text-sm mt-1">{log.notes}</p>
            )}
            {log.metadata && (
              <details className="mt-2">
                <summary className="text-sm cursor-pointer">
                  View details
                </summary>
                <pre className="text-xs mt-1 p-2 bg-muted rounded">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
\`\`\`

### Timeline View

\`\`\`typescript
// Render logs as a timeline
export function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      {logs.map((log, index) => (
        <div key={log.id} className="relative pl-10 pb-8">
          <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary" />
          <div className="bg-card border rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium">{formatAction(log.action)}</h4>
              <time className="text-sm text-muted-foreground">
                {formatRelativeTime(log.createdAt)}
              </time>
            </div>
            {log.actor && (
              <p className="text-sm text-muted-foreground">
                {log.actor === 'SYSTEM' ? 'Automated' : `By ${log.actor}`}
              </p>
            )}
            {log.notes && <p className="text-sm mt-2">{log.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
\`\`\`

## Retention and Cleanup

### Retention Policy

- Audit logs are retained indefinitely by default
- Logs are automatically deleted when parent event is deleted (CASCADE)
- Consider implementing archival for old logs (>1 year)

### Cleanup Script

\`\`\`typescript
// scripts/cleanup-old-audit-logs.ts
import { prisma } from '@/lib/prisma'

async function cleanupOldLogs() {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  
  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: oneYearAgo
      },
      event: {
        status: 'ARCHIVED'
      }
    }
  })
  
  console.log(`Deleted ${result.count} old audit logs`)
}
\`\`\`

## Best Practices

1. **Always Log Moderation Actions**: Every status change should have an audit log
2. **Include Context**: Use the `notes` field to explain why an action was taken
3. **Store Structured Data**: Use `metadata` for machine-readable information
4. **Consistent Action Names**: Use the predefined action types
5. **Timestamp Everything**: Rely on `createdAt` for chronological ordering
6. **Don't Log Sensitive Data**: Avoid storing passwords, tokens, or PII in logs
7. **Make Logs Searchable**: Index by `eventId`, `action`, and `createdAt`

## Analytics and Reporting

### Moderation Performance Metrics

\`\`\`typescript
// Get AI moderation accuracy (approved vs flagged/rejected)
const aiDecisions = await prisma.auditLog.groupBy({
  by: ['action'],
  where: {
    actor: 'SYSTEM',
    action: {
      startsWith: 'AI_MODERATION_'
    },
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  },
  _count: true
})

// Calculate metrics
const total = aiDecisions.reduce((sum, d) => sum + d._count, 0)
const approved = aiDecisions.find(d => d.action === 'AI_MODERATION_APPROVED')?._count || 0
const flagged = aiDecisions.find(d => d.action === 'AI_MODERATION_FLAGGED')?._count || 0
const rejected = aiDecisions.find(d => d.action === 'AI_MODERATION_REJECTED')?._count || 0

console.log({
  total,
  approvalRate: (approved / total) * 100,
  flagRate: (flagged / total) * 100,
  rejectionRate: (rejected / total) * 100
})
\`\`\`

### Admin Activity Report

\`\`\`typescript
// Get admin moderation activity
const adminActivity = await prisma.auditLog.groupBy({
  by: ['actor'],
  where: {
    actor: {
      not: 'SYSTEM'
    },
    action: {
      in: ['ADMIN_APPROVED', 'ADMIN_REJECTED']
    },
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  },
  _count: true
})
\`\`\`

### Appeal Success Rate

\`\`\`typescript
// Calculate appeal approval rate
const appeals = await prisma.auditLog.groupBy({
  by: ['action'],
  where: {
    action: {
      in: ['APPEAL_APPROVED', 'APPEAL_REJECTED']
    },
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  },
  _count: true
})

const approved = appeals.find(a => a.action === 'APPEAL_APPROVED')?._count || 0
const rejected = appeals.find(a => a.action === 'APPEAL_REJECTED')?._count || 0
const total = approved + rejected

console.log({
  appealSuccessRate: (approved / total) * 100
})
