"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, ArrowLeft, Mail, Phone, Globe, User } from "lucide-react"
import type { EventExtractionOutput } from "@/lib/types"
import {
  CANONICAL_EVENT_CATEGORY_VALUES,
  CATEGORY_UI_METADATA,
  coerceToCanonicalEventCategory,
  eventCategoryPayloadSchema,
  type CanonicalEventCategory,
} from "@/lib/categories/canonical-event-category"
import { PlaceAutocomplete } from "@/components/places/place-autocomplete"
import { EventPosterUpload } from "@/components/events/event-poster-upload"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { SelectedPlaceWire } from "@/lib/places/selected-place"

/** `datetime-local` value in the browser's local timezone (same pattern as event forms). */
function toDatetimeLocalValue(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface DraftData {
  sourceText: string
  extraction: EventExtractionOutput
  /** "auto" | legacy broad slug | canonical enum string (e.g. MUSIC) */
  category: string
  /** Present only when category is OTHER; synced from review step. */
  customCategoryLabel?: string
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
  const [organizerName, setOrganizerName] = useState("")
  /** Required when not signed in: becomes `creatorEmail` for /api/events/submit */
  const [creatorEmailInput, setCreatorEmailInput] = useState("")
  /** Editable canonical category for create-simple (seeded from draft + extraction). */
  const [reviewCategory, setReviewCategory] = useState<CanonicalEventCategory | null>(null)
  /** Required when category is OTHER; max 40 chars aligned with submit schema. */
  const [customOtherLabel, setCustomOtherLabel] = useState("")

  /** When / where — editable before publish (replaces read-only AI extraction). */
  const [startLocal, setStartLocal] = useState("")
  const [endLocal, setEndLocal] = useState("")
  const [timezoneReview, setTimezoneReview] = useState("")
  const [venueName, setVenueName] = useState("")
  const [addressLine, setAddressLine] = useState("")
  /** Mapbox-backed selection — city/country/postcode come from here on submit (same as Post Event). */
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlaceWire | null>(null)
  /** Seed the autocomplete query once from AI venue + address. */
  const [placeInitialQuery, setPlaceInitialQuery] = useState("")

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

      const rawCategory = data.category !== "auto" ? data.category : data.extraction.category
      const coerced = coerceToCanonicalEventCategory(rawCategory) ?? "OTHER"
      setReviewCategory(coerced)

      const topLabel =
        typeof data.customCategoryLabel === "string" ? data.customCategoryLabel.trim().slice(0, 40) : ""
      const ex = data.extraction as unknown as Record<string, unknown>
      const exLabel =
        typeof ex.customCategoryLabel === "string" ? String(ex.customCategoryLabel).trim().slice(0, 40) : ""
      setCustomOtherLabel(coerced === "OTHER" ? topLabel || exLabel : "")

      const exLoc = data.extraction.location
      setStartLocal(toDatetimeLocalValue(data.extraction.start))
      setEndLocal(data.extraction.end ? toDatetimeLocalValue(data.extraction.end) : "")
      setTimezoneReview(data.extraction.timezone ?? "")
      setVenueName(exLoc.name ?? "")
      setAddressLine(exLoc.address ?? "")
      setSelectedPlace(null)
      setPlaceInitialQuery([exLoc.name, exLoc.address].filter(Boolean).join(", ").trim())
    } catch (err) {
      console.error("[v0] Failed to load draft:", err)
      router.push("/create-simple")
    }
  }, [router])

  useEffect(() => {
    if (!draftData || reviewCategory === null) return
    try {
      const stored = sessionStorage.getItem("ai-event-draft")
      if (!stored) return
      const draft = JSON.parse(stored) as DraftData
      draft.category = reviewCategory
      if (reviewCategory === "OTHER") {
        const t = customOtherLabel.trim().slice(0, 40)
        if (t) draft.customCategoryLabel = t
        else delete draft.customCategoryLabel
      } else {
        delete draft.customCategoryLabel
      }
      sessionStorage.setItem("ai-event-draft", JSON.stringify(draft))
    } catch (e) {
      console.error("[v0] Failed to persist draft category to sessionStorage:", e)
    }
  }, [draftData, reviewCategory, customOtherLabel])

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
    if (!draftData || !reviewCategory) return

    setIsSubmitting(true)
    setError(null)

    try {
      const categoryPayload = {
        category: reviewCategory,
        subcategory: null as string | null,
        tags: draftData.extraction.tags ?? [],
        customCategoryLabel: reviewCategory === "OTHER" ? customOtherLabel : null,
        originalLanguage: null as string | null,
      }
      const categoryCheck = eventCategoryPayloadSchema.safeParse(categoryPayload)
      if (!categoryCheck.success) {
        const msg =
          categoryCheck.error.issues[0]?.message ?? "Please check your event category and try again."
        setError(msg)
        setIsSubmitting(false)
        return
      }

      if (!startLocal.trim()) {
        setError("Please set a start date and time.")
        setIsSubmitting(false)
        return
      }
      const startDate = new Date(startLocal)
      if (Number.isNaN(startDate.getTime())) {
        setError("Start date and time is not valid.")
        setIsSubmitting(false)
        return
      }

      let endForPayload: string | null = null
      if (endLocal.trim()) {
        const endDate = new Date(endLocal)
        if (Number.isNaN(endDate.getTime())) {
          setError("End date and time is not valid.")
          setIsSubmitting(false)
          return
        }
        if (endDate.getTime() <= startDate.getTime()) {
          setError("End must be after start.")
          setIsSubmitting(false)
          return
        }
        endForPayload = endDate.toISOString()
      }

      const placeId = selectedPlace?.placeId?.trim()
      if (
        !placeId ||
        !selectedPlace?.city?.trim() ||
        !selectedPlace?.country?.trim()
      ) {
        setError("Choose a location from the suggestions list and confirm it before publishing.")
        setIsSubmitting(false)
        return
      }

      const locationPayload: Record<string, unknown> = {
        name: venueName.trim() || undefined,
        address: addressLine.trim() || undefined,
        city: selectedPlace.city,
        country: selectedPlace.country,
        state: selectedPlace.region ?? undefined,
        postcode: selectedPlace.postcode ?? undefined,
        parentCity: selectedPlace.parentCity ?? null,
        lat: selectedPlace.lat ?? undefined,
        lng: selectedPlace.lng ?? undefined,
        formattedAddress: selectedPlace.formattedAddress,
        mapboxPlaceId: placeId,
      }

      const submitPayload: Record<string, unknown> = {
        title,
        description,
        start: startDate.toISOString(),
        /** `null` = no separate end (create-simple must not fall back to extraction). */
        end: endForPayload,
        timezone: timezoneReview.trim() || draftData.extraction.timezone || undefined,
        location: locationPayload,
        category: reviewCategory,
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
      if (reviewCategory === "OTHER") {
        submitPayload.customCategoryLabel = customOtherLabel.trim().slice(0, 40)
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

  if (!draftData || reviewCategory === null) {
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

            {/* Poster / banner — same drag/drop + URL fallback as Post Event / create-simple */}
            <div>
              <EventPosterUpload
                imageUrl={imageUrl}
                onImageUrlChange={setImageUrl}
                disabled={isSubmitting}
                urlInputId="image-url-review"
              />
            </div>

            {/* Date & Time — editable */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="review-start">Start date & time *</Label>
                <Input
                  id="review-start"
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 max-w-md"
                />
              </div>
              <div>
                <Label htmlFor="review-end">End date & time</Label>
                <Input
                  id="review-end"
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 max-w-md"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. Leave blank to use only the start time (single moment or all-day style).
                </p>
              </div>
              <div>
                <Label htmlFor="review-timezone">Timezone (optional)</Label>
                <Input
                  id="review-timezone"
                  value={timezoneReview}
                  onChange={(e) => setTimezoneReview(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. Australia/Melbourne"
                  className="mt-1 max-w-md"
                />
              </div>
            </div>

            {/* Location — venue + single address combobox (same suggest/resolve flow as manual post) */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="review-draft-venue-name">Venue name</Label>
                <Input
                  id="review-draft-venue-name"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Shown on the event page"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground">
                  You can edit how the venue appears after selecting a place.
                </p>
              </div>

              <PlaceAutocomplete
                disabled={isSubmitting}
                id="review-draft-address"
                testId="review-draft-place-autocomplete"
                allowEditQueryWhileSelected
                initialQuery={placeInitialQuery}
                label="Address (full line)"
                hideDescription
                onQueryChange={setAddressLine}
                onResolved={(place) => {
                  setSelectedPlace(place)
                  setVenueName((prev) => {
                    const v = place.venueName?.trim()
                    return v && v.length > 0 ? v : prev
                  })
                  setAddressLine(place.formattedAddress ?? "")
                }}
                onClear={() => {
                  setSelectedPlace(null)
                  setVenueName("")
                  setAddressLine("")
                }}
              />

              {!selectedPlace?.placeId ? (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                    Choose a location from the suggestions and confirm your selection before publishing.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            {/* Category — editable; OTHER requires short label (same rules as event-form / submit schema). */}
            <div>
              <Label className="text-base font-medium">Event category</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick the type that best fits your event. You can change what you chose on the previous step.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CANONICAL_EVENT_CATEGORY_VALUES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setReviewCategory(key)
                      if (key !== "OTHER") setCustomOtherLabel("")
                    }}
                    disabled={isSubmitting}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                      reviewCategory === key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    {CATEGORY_UI_METADATA[key].defaultLabel}
                  </button>
                ))}
              </div>
              {reviewCategory === "OTHER" ? (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="review-custom-category-label">
                    Describe the event type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="review-custom-category-label"
                    maxLength={40}
                    disabled={isSubmitting}
                    placeholder="Short label (max 40 characters)"
                    value={customOtherLabel}
                    onChange={(e) => setCustomOtherLabel(e.target.value.slice(0, 40))}
                    className="mt-1"
                  />
                </div>
              ) : null}
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
              !startLocal.trim() ||
              sessionLoading ||
              !creatorEmailValid ||
              (reviewCategory === "OTHER" && !customOtherLabel.trim()) ||
              !selectedPlace?.placeId?.trim() ||
              !selectedPlace?.city?.trim() ||
              !selectedPlace?.country?.trim()
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
