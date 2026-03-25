"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, Mail, Phone, Globe, User, ImageIcon } from "lucide-react"
import type { EventExtractionOutput, BroadEventCategory } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/ai-extraction-constants"
import {
  CATEGORY_UI_METADATA,
  coerceToCanonicalEventCategory,
} from "@/lib/categories/canonical-event-category"
import ClientOnly from "@/components/ClientOnly"
import { isPublicHttpUrl } from "@/lib/events/public-http-url"

interface DraftData {
  sourceText: string
  extraction: EventExtractionOutput
  /** "auto" | legacy broad slug | canonical enum string (e.g. MUSIC) */
  category: string
  followUpAnswer?: string
  imageUrl?: string
  externalUrl?: string
  contactInfo?: string
}

function labelForDraftCategory(category: string): string {
  if (category === "auto") return "Auto-detect"
  const canonical = coerceToCanonicalEventCategory(category)
  if (canonical) return CATEGORY_UI_METADATA[canonical].defaultLabel
  if (Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, category)) {
    return CATEGORY_LABELS[category as BroadEventCategory]
  }
  return category
}

export default function ReviewDraftPage() {
  const router = useRouter()
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Next-Auth session email (via /api/auth/session — works without client SessionProvider). */
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  // Editable fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [externalUrl, setExternalUrl] = useState("")
  /** Editable on review; seeded from simple-flow draft `imageUrl`. */
  const [imageUrl, setImageUrl] = useState("")
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false)
  const [organizerName, setOrganizerName] = useState("")
  /** Required when not signed in: becomes `creatorEmail` for /api/events/submit */
  const [creatorEmailInput, setCreatorEmailInput] = useState("")

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
      setImageUrl(data.imageUrl?.trim() || "")
      setContactEmail(data.contactInfo || "")
      setOrganizerName(data.extraction.organizer_name || "")
    } catch (err) {
      console.error("[v0] Failed to load draft:", err)
      router.push("/create-simple")
    }
  }, [router])

  useEffect(() => {
    let cancelled = false
    setSessionLoading(true)
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { user?: { email?: string | null } }) => {
        if (cancelled) return
        const e = data?.user?.email?.trim()
        setSessionEmail(e && e.length > 0 ? e : null)
        if (e) setCreatorEmailInput(e)
      })
      .catch(() => {
        if (!cancelled) setSessionEmail(null)
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sessionCreatorEmail = sessionEmail ?? ""
  const effectiveCreatorEmail = sessionCreatorEmail || creatorEmailInput.trim()

  const creatorEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveCreatorEmail)

  const handleSubmit = async () => {
    if (!draftData) return

    setIsSubmitting(true)
    setError(null)

    try {
      const resolvedCategory =
        draftData.category !== "auto" ? draftData.category : draftData.extraction.category

      const submitPayload = {
        title,
        description,
        start: draftData.extraction.start,
        end: draftData.extraction.end,
        timezone: draftData.extraction.timezone,
        location: draftData.extraction.location,
        category: resolvedCategory,
        price: draftData.extraction.price,
        organizer_name: organizerName,
        organizer_contact: contactEmail || contactPhone || undefined,
        source_text: draftData.sourceText,
        imageUrl: imageUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        tags: draftData.extraction.tags,
        extractionConfidence: draftData.extraction.confidence,
        creatorEmail: effectiveCreatorEmail,
      }

      const response = await fetch("/api/events/create-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
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

            {/* Poster / banner image URL (from simple flow optional field; editable here) */}
            <div>
              <Label htmlFor="image-url-review">Poster or banner image (URL)</Label>
              <div className="flex gap-2">
                <ImageIcon className="mt-2.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    id="image-url-review"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value)
                      setImagePreviewFailed(false)
                    }}
                    placeholder="https://example.com/poster.jpg"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Paste a link to an image — same as on the previous step. You can fix typos here before
                    publishing.
                  </p>
                  {imageUrl.trim() && isPublicHttpUrl(imageUrl) && !imagePreviewFailed ? (
                    <ClientOnly>
                      <div className="overflow-hidden rounded-md border bg-muted/30 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl.trim()}
                          alt=""
                          className="mx-auto max-h-48 w-auto max-w-full object-contain"
                          onError={() => setImagePreviewFailed(true)}
                        />
                      </div>
                    </ClientOnly>
                  ) : null}
                  {imageUrl.trim() && imagePreviewFailed ? (
                    <p className="text-xs text-amber-700 dark:text-amber-500">
                      Preview unavailable (blocked URL or not an image). The link will still be saved if it is valid.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Date & Time (Read-only from AI) */}
            <div>
              <Label>Date & Time</Label>
              <div className="mt-1 rounded-lg border bg-muted/50 p-3 text-sm">
                <ClientOnly>
                  <p className="font-medium">{new Date(draftData.extraction.start).toLocaleString()}</p>
                  {draftData.extraction.end && (
                    <p className="text-muted-foreground">to {new Date(draftData.extraction.end).toLocaleString()}</p>
                  )}
                </ClientOnly>
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

            {/* Category (user + AI resolution, read-only here) */}
            <div>
              <Label>Category</Label>
              <div className="mt-1 rounded-lg border bg-muted/50 p-3 text-sm font-medium">
                {labelForDraftCategory(
                  draftData.category !== "auto" ? draftData.category : draftData.extraction.category,
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>
              {sessionCreatorEmail
                ? "Signed in — we use your account email for the edit link."
                : "Enter the email you want to use for your Eventa account and the edit link."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionCreatorEmail ? (
              <div>
                <Label>Creator email</Label>
                <p className="mt-1 rounded-lg border bg-muted/50 p-3 text-sm">{sessionCreatorEmail}</p>
              </div>
            ) : (
              <div>
                <Label htmlFor="creator-email">
                  Your email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="creator-email"
                  type="email"
                  value={creatorEmailInput}
                  onChange={(e) => setCreatorEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1"
                  autoComplete="email"
                />
              </div>
            )}
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
              <Label htmlFor="url">Website or tickets link</Label>
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
            disabled={
              isSubmitting ||
              !title.trim() ||
              !description.trim() ||
              sessionLoading ||
              !creatorEmailValid
            }
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
