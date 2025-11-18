"use client"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle2, XCircle, AlertTriangle, Clock, Sparkles, User, Mail, Tag, ChevronDown, FileText } from 'lucide-react'
import { CATEGORY_LABELS } from "@/lib/ai-extraction-constants"
import type { BroadEventCategory, EventStatus, EventAIStatus } from "@/lib/types"
import ClientOnly from "@/components/ClientOnly"
import { getAdminDisplayStatus } from "@/lib/events"

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
  const [isAIAnalysisOpen, setIsAIAnalysisOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const handleModeration = async (action: "approve" | "reject") => {
    if (action === "reject") {
      setIsRejectDialogOpen(true)
      return
    }

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

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setError("Rejection reason is required")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/events/${event.id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          notes: reviewNotes,
          adminId,
          reason: rejectReason,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to reject event")
      }

      router.refresh()
      router.push("/admin/events")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
      setIsRejectDialogOpen(false)
    }
  }

  const renderConfidenceScore = (score: number) => {
    const percentage = Math.round(score * 100)
    const color = percentage >= 80 ? "text-green-600" : percentage >= 60 ? "text-yellow-600" : "text-red-600"
    return <span className={`font-semibold ${color}`}>{percentage}%</span>
  }

  const displayStatus = getAdminDisplayStatus({
    status: event.status as EventStatus,
    aiStatus: event.aiStatus as EventAIStatus | null,
  })

  const StatusIcon = 
    displayStatus.icon === "check" ? CheckCircle2 :
    displayStatus.icon === "alert" ? AlertTriangle :
    displayStatus.icon === "x" ? XCircle :
    Clock

  const iconColor = 
    displayStatus.variant === "success" ? "text-green-600" :
    displayStatus.variant === "warning" ? "text-yellow-600" :
    displayStatus.variant === "destructive" ? "text-red-600" :
    "text-gray-600"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground">Submitted by {event.createdBy.name || event.createdBy.email}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${iconColor}`} />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Event Status</span>
              <Badge variant={displayStatus.variant === "success" ? "default" : displayStatus.variant}>
                {displayStatus.label}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {displayStatus.description}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {event.adminNotes && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <FileText className="h-5 w-5" />
              Admin Notes
            </CardTitle>
            <CardDescription>Reason provided by admin during moderation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm whitespace-pre-wrap">{event.adminNotes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Collapsible open={isAIAnalysisOpen} onOpenChange={setIsAIAnalysisOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">AI Analysis</CardTitle>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    isAIAnalysisOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">AI Status</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant={
                        event.aiStatus === "SAFE"
                          ? "default"
                          : event.aiStatus === "REJECTED"
                            ? "destructive"
                            : event.aiStatus === "NEEDS_REVIEW"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {event.aiStatus}
                    </Badge>
                  </div>
                </div>

                {event.aiAnalyzedAt && (
                  <div>
                    <Label className="text-sm font-medium">Analyzed At</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <ClientOnly>
                        {new Date(event.aiAnalyzedAt).toLocaleString()}
                      </ClientOnly>
                    </p>
                  </div>
                )}
              </div>

              {event.aiSummary && (
                <div>
                  <Label className="text-sm font-medium">AI Summary</Label>
                  <div className="mt-1 rounded-lg border bg-muted/50 p-3">
                    <p className="text-sm text-muted-foreground">{event.aiSummary}</p>
                  </div>
                </div>
              )}

              {!event.aiAnalyzedAt && !event.aiSummary && event.aiStatus === "PENDING" && (
                <p className="text-sm text-muted-foreground italic">
                  AI analysis has not yet been performed on this event.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
            {event.sourceText && (
              <div>
                <Label className="text-sm font-medium">Original User Input</Label>
                <div className="mt-1 rounded-lg border bg-white p-3 text-sm">
                  <p className="text-pretty">{event.sourceText}</p>
                </div>
              </div>
            )}

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
                <ClientOnly>
                  Start: {new Date(event.startAt).toLocaleString()}
                  <br />
                  End: {new Date(event.endAt).toLocaleString()}
                </ClientOnly>
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
                <p className="text-xs text-muted-foreground">
                  <ClientOnly>{new Date(appeal.createdAt).toLocaleString()}</ClientOnly>
                </p>

                {appeal.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => handleModeration("approve")} disabled={loading}>
                      Approve Appeal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleModeration("reject")}
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
                  <span className="text-muted-foreground">
                    <ClientOnly>{new Date(log.createdAt).toLocaleString()}</ClientOnly>
                  </span>
                  <span className="font-medium">{log.actor}</span>
                  <span>{log.action}</span>
                  {log.notes && <span className="text-muted-foreground">- {log.notes}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(event.status === "DRAFT" && (event.aiStatus === "NEEDS_REVIEW" || event.aiStatus === "REJECTED" || event.aiStatus === "PENDING")) && (
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

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Event</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this event. This will be saved and visible to other admins.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Rejection Reason *</Label>
              <Textarea
                id="rejectReason"
                placeholder="Enter the reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                This reason will be stored in the admin notes and audit log.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false)
                setRejectReason("")
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={loading || !rejectReason.trim()}
            >
              {loading ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
