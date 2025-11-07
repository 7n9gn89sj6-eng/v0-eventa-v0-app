"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, AlertTriangle, Clock, Sparkles, User, Mail, Tag } from "lucide-react"
import { CATEGORY_LABELS } from "@/lib/ai-extraction-constants"
import type { BroadEventCategory } from "@/lib/types"

interface AdminEventReviewProps {
  event: any
  adminId: string
  adminEmail: string
}

export function AdminEventReview({ event, adminId, adminEmail }: AdminEventReviewProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")
  const [error, setError] = useState("")

  const handleModeration = async (action: "approve" | "reject") => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/events/${event.id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: reviewNotes,
          adminId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to moderate event")
      }

      router.refresh()
      router.push("/admin/events")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleAppealDecision = async (appealId: string, action: "approve" | "reject") => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/events/${event.id}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId,
          action,
          reviewNotes,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to process appeal")
      }

      router.refresh()
      router.push("/admin/events")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const getModerationIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case "REJECTED":
        return <XCircle className="h-5 w-5 text-red-600" />
      case "FLAGGED":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const renderConfidenceScore = (score: number) => {
    const percentage = Math.round(score * 100)
    const color = percentage >= 80 ? "text-green-600" : percentage >= 60 ? "text-yellow-600" : "text-red-600"
    return <span className={`font-semibold ${color}`}>{percentage}%</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground">Submitted by {event.createdBy.name || event.createdBy.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {getModerationIcon(event.moderationStatus)}
          <Badge
            variant={
              event.moderationStatus === "APPROVED"
                ? "default"
                : event.moderationStatus === "REJECTED"
                  ? "outline"
                  : event.moderationStatus === "FLAGGED"
                    ? "destructive"
                    : "secondary"
            }
          >
            {event.moderationStatus}
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {(event.sourceText || event.extractionConfidence || event.tags?.length > 0) && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Extraction Data
            </CardTitle>
            <CardDescription>Information extracted from user input via AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source Text */}
            {event.sourceText && (
              <div>
                <Label className="text-sm font-medium">Original User Input</Label>
                <div className="mt-1 rounded-lg border bg-white p-3 text-sm">
                  <p className="text-pretty">{event.sourceText}</p>
                </div>
              </div>
            )}

            {/* Extraction Confidence Scores */}
            {event.extractionConfidence && (
              <div>
                <Label className="text-sm font-medium">Extraction Confidence Scores</Label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {event.extractionConfidence.datetime !== undefined && (
                    <div className="flex items-center justify-between rounded-lg border bg-white p-3">
                      <span className="text-sm font-medium text-muted-foreground">Date/Time</span>
                      {renderConfidenceScore(event.extractionConfidence.datetime)}
                    </div>
                  )}
                  {event.extractionConfidence.location !== undefined && (
                    <div className="flex items-center justify-between rounded-lg border bg-white p-3">
                      <span className="text-sm font-medium text-muted-foreground">Location</span>
                      {renderConfidenceScore(event.extractionConfidence.location)}
                    </div>
                  )}
                  {event.extractionConfidence.title !== undefined && (
                    <div className="flex items-center justify-between rounded-lg border bg-white p-3">
                      <span className="text-sm font-medium text-muted-foreground">Title</span>
                      {renderConfidenceScore(event.extractionConfidence.title)}
                    </div>
                  )}
                  {event.extractionConfidence.category !== undefined && (
                    <div className="flex items-center justify-between rounded-lg border bg-white p-3">
                      <span className="text-sm font-medium text-muted-foreground">Category</span>
                      {renderConfidenceScore(event.extractionConfidence.category)}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Confidence scores indicate how certain the AI was about the extracted information.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Category */}
              {event.category && (
                <div>
                  <Label className="text-sm font-medium">AI-Assigned Category</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className="text-sm">
                      {CATEGORY_LABELS[event.category as BroadEventCategory] || event.category}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    AI-Generated Tags
                  </Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {event.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Organizer Info */}
            {(event.organizerName || event.organizerContact) && (
              <div>
                <Label className="text-sm font-medium">Extracted Organizer Information</Label>
                <div className="mt-2 space-y-2">
                  {event.organizerName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{event.organizerName}</span>
                    </div>
                  )}
                  {event.organizerContact && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{event.organizerContact}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Moderation Status Card */}
      {event.moderationReason && (
        <Card>
          <CardHeader>
            <CardTitle>AI Moderation Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Category</Label>
              <p className="text-sm text-muted-foreground">{event.moderationCategory || "N/A"}</p>
            </div>
            <div>
              <Label>Severity</Label>
              <Badge
                variant={
                  event.moderationSeverity === "HIGH"
                    ? "destructive"
                    : event.moderationSeverity === "MEDIUM"
                      ? "secondary"
                      : "outline"
                }
              >
                {event.moderationSeverity || "N/A"}
              </Badge>
            </div>
            <div>
              <Label>Reason</Label>
              <p className="text-sm">{event.moderationReason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Details */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Description</Label>
            <p className="text-sm">{event.description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Location</Label>
              <p className="text-sm text-muted-foreground">
                {event.locationAddress || event.address}
                <br />
                {event.city}, {event.country}
              </p>
            </div>
            <div>
              <Label>Date & Time</Label>
              <p className="text-sm text-muted-foreground">
                Start: {new Date(event.startAt).toLocaleString()}
                <br />
                End: {new Date(event.endAt).toLocaleString()}
              </p>
            </div>
          </div>
          {event.externalUrl && (
            <div>
              <Label>External URL</Label>
              <a
                href={event.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {event.externalUrl}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appeals with Actions */}
      {event.appeals && event.appeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Appeals</CardTitle>
            <CardDescription>User appeals for this event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.appeals.map((appeal: any) => (
              <div key={appeal.id} className="border-l-4 border-yellow-500 pl-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{appeal.user.name || appeal.user.email}</p>
                  <Badge variant={appeal.status === "pending" ? "secondary" : "outline"}>{appeal.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{appeal.reason}</p>
                <p className="text-xs text-muted-foreground">{new Date(appeal.createdAt).toLocaleString()}</p>

                {appeal.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => handleAppealDecision(appeal.id, "approve")} disabled={loading}>
                      Approve Appeal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAppealDecision(appeal.id, "reject")}
                      disabled={loading}
                    >
                      Reject Appeal
                    </Button>
                  </div>
                )}

                {appeal.reviewNotes && (
                  <div className="mt-2 p-3 bg-muted rounded">
                    <p className="text-xs font-medium">Admin Response:</p>
                    <p className="text-sm">{appeal.reviewNotes}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      {event.auditLogs && event.auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>History of actions on this event</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {event.auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                  <span className="font-medium">{log.actor}</span>
                  <span>{log.action}</span>
                  {log.notes && <span className="text-muted-foreground">- {log.notes}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Moderation Actions */}
      {(event.moderationStatus === "PENDING" || event.moderationStatus === "FLAGGED") && (
        <Card>
          <CardHeader>
            <CardTitle>Moderation Actions</CardTitle>
            <CardDescription>Review and take action on this event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reviewNotes">Review Notes (optional)</Label>
              <Textarea
                id="reviewNotes"
                placeholder="Add any notes about your decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => handleModeration("approve")} disabled={loading} className="flex-1">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve Event
              </Button>
              <Button
                onClick={() => handleModeration("reject")}
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Event
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
