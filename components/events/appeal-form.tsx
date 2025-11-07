"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface AppealFormProps {
  eventId: string
  existingAppeal?: {
    id: string
    reason: string
    status: string
    createdAt: Date
    reviewNotes: string | null
  }
}

export function AppealForm({ eventId, existingAppeal }: AppealFormProps) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/events/${eventId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit appeal")
      }

      router.push(`/my/events`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (existingAppeal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Existing Appeal</CardTitle>
          <CardDescription>You have already submitted an appeal for this event</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Status</Label>
            <div className="mt-1">
              <Badge
                variant={
                  existingAppeal.status === "approved"
                    ? "default"
                    : existingAppeal.status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
              >
                {existingAppeal.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div>
            <Label>Your Appeal</Label>
            <p className="text-sm text-muted-foreground mt-1">{existingAppeal.reason}</p>
          </div>

          {existingAppeal.reviewNotes && (
            <div>
              <Label>Admin Response</Label>
              <p className="text-sm text-muted-foreground mt-1">{existingAppeal.reviewNotes}</p>
            </div>
          )}

          <div>
            <Label>Submitted</Label>
            <p className="text-sm text-muted-foreground mt-1">{new Date(existingAppeal.createdAt).toLocaleString()}</p>
          </div>

          <Button onClick={() => router.push("/my/events")} variant="outline" className="w-full">
            Back to My Events
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Appeal</CardTitle>
        <CardDescription>Explain why you believe your event should be approved</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Appeal Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you believe this event was incorrectly rejected..."
              rows={6}
              required
              minLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 50 characters. Be specific about why your event complies with our policies.
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || reason.length < 50} className="flex-1">
              {loading ? "Submitting..." : "Submit Appeal"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/my/events")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
