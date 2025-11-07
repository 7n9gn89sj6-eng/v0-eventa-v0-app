"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, Mail, Phone, Globe, User } from "lucide-react"
import type { EventExtractionOutput, BroadEventCategory } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/ai-extraction"

interface DraftData {
  sourceText: string
  extraction: EventExtractionOutput
  category: BroadEventCategory | "auto"
  followUpAnswer?: string
  imageUrl?: string
  externalUrl?: string
  contactInfo?: string
}

export default function ReviewDraftPage() {
  const router = useRouter()
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [externalUrl, setExternalUrl] = useState("")
  const [organizerName, setOrganizerName] = useState("")

  useEffect(() => {
    // Load draft from session storage
    const stored = sessionStorage.getItem("ai-event-draft")
    if (!stored) {
      router.push("/create-simple")
      return
    }

    try {
      const data: DraftData = JSON.parse(stored)
      setDraftData(data)

      // Pre-fill fields from extraction
      setTitle(data.extraction.title)
      setDescription(data.extraction.description)
      setExternalUrl(data.externalUrl || "")
      setContactEmail(data.contactInfo || "")
      setOrganizerName(data.extraction.organizer_name || "")
    } catch (err) {
      console.error("[v0] Failed to load draft:", err)
      router.push("/create-simple")
    }
  }, [router])

  const handleSubmit = async () => {
    if (!draftData) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/events/create-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText: draftData.sourceText,
          extraction: {
            ...draftData.extraction,
            title,
            description,
            organizer_name: organizerName,
          },
          category: draftData.category,
          followUpAnswer: draftData.followUpAnswer,
          imageUrl: draftData.imageUrl,
          externalUrl: externalUrl || undefined,
          contactInfo: contactEmail || contactPhone || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create event")
      }

      const result = await response.json()

      // Clear session storage
      sessionStorage.removeItem("ai-event-draft")

      // Redirect to event page or confirmation
      router.push(`/events/${result.eventId}?created=true`)
    } catch (err: any) {
      setError(err.message || "Failed to create event. Please try again.")
      console.error("[v0] Submission error:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!draftData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-12">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to editor
      </Button>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Your Event</h1>
          <p className="mt-2 text-muted-foreground">
            Review the AI-extracted details and add contact information before publishing
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Edit any details that need adjustment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div>
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Amazing Event"
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell people about your event..."
                rows={4}
                className="mt-1"
              />
            </div>

            {/* Date & Time (Read-only from AI) */}
            <div>
              <Label>Date & Time</Label>
              <div className="mt-1 rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="font-medium">{new Date(draftData.extraction.start).toLocaleString()}</p>
                {draftData.extraction.end && (
                  <p className="text-muted-foreground">to {new Date(draftData.extraction.end).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Location (Read-only from AI) */}
            <div>
              <Label>Location</Label>
              <div className="mt-1 rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="font-medium">{draftData.extraction.location.name || "Venue"}</p>
                {draftData.extraction.location.address && (
                  <p className="text-muted-foreground">{draftData.extraction.location.address}</p>
                )}
              </div>
            </div>

            {/* Category (Read-only from AI) */}
            <div>
              <Label>Category</Label>
              <div className="mt-1 rounded-lg border bg-muted/50 p-3 text-sm font-medium">
                {draftData.category === "auto"
                  ? "Auto-detect"
                  : CATEGORY_LABELS[draftData.category as BroadEventCategory]}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizer & Contact Information</CardTitle>
            <CardDescription>Help attendees get in touch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Organizer Name */}
            <div>
              <Label htmlFor="organizer">Organizer Name</Label>
              <div className="flex gap-2">
                <User className="mt-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="organizer"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  placeholder="Your name or organization"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Contact Email */}
            <div>
              <Label htmlFor="email">Contact Email</Label>
              <div className="flex gap-2">
                <Mail className="mt-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <Label htmlFor="phone">Contact Phone</Label>
              <div className="flex gap-2">
                <Phone className="mt-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+61 400 000 000"
                  className="flex-1"
                />
              </div>
            </div>

            {/* External URL */}
            <div>
              <Label htmlFor="url">Event Website or Tickets</Label>
              <div className="flex gap-2">
                <Globe className="mt-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting} className="flex-1">
            Back to Edit
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !description.trim()}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Event...
              </>
            ) : (
              "Publish Event"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
