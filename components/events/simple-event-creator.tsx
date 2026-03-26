"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react"
import type { EventExtractionOutput } from "@/lib/types"
import {
  CANONICAL_EVENT_CATEGORY_VALUES,
  CATEGORY_UI_METADATA,
  coerceToCanonicalEventCategory,
  type CanonicalEventCategory,
} from "@/lib/categories/canonical-event-category"
import { useRouter } from "next/navigation"
import ClientOnly from "@/components/ClientOnly"
import { EventPosterUpload } from "@/components/events/event-poster-upload"

const EXAMPLE_PLACEHOLDER = `Sat 12 April, 2–5pm at St Kilda Library. Poetry open mic, gold coin donation, family-friendly. Host: Irene. Register via email.`

export function SimpleEventCreator() {
  const router = useRouter()
  const [sourceText, setSourceText] = useState("")
  const [extractedData, setExtractedData] = useState<EventExtractionOutput | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CanonicalEventCategory | "auto">("auto")
  const [showOptional, setShowOptional] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [externalLink, setExternalLink] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null)
  const [followUpAnswer, setFollowUpAnswer] = useState("")

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ai-event-draft")
      if (!raw) return
      const draft = JSON.parse(raw) as { category?: string }
      const c = draft.category
      if (typeof c !== "string" || !c.trim()) return
      if (c.trim().toLowerCase() === "auto") {
        setSelectedCategory("auto")
        return
      }
      const coerced = coerceToCanonicalEventCategory(c)
      if (coerced) setSelectedCategory(coerced)
    } catch {
      /* ignore bad or missing draft */
    }
  }, [])

  const categories: Array<{ value: CanonicalEventCategory | "auto"; label: string }> = [
    { value: "auto", label: "Auto (use AI)" },
    ...CANONICAL_EVENT_CATEGORY_VALUES.map((key) => ({
      value: key,
      label: CATEGORY_UI_METADATA[key].defaultLabel,
    })),
  ]

  const handleExtract = async () => {
    if (!sourceText.trim()) {
      setError("Please describe your event first")
      return
    }

    setIsExtracting(true)
    setError(null)
    setFollowUpQuestion(null)

    try {
      const response = await fetch("/api/ai/extract-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_text: sourceText,
          image_meta: imageUrl || undefined,
          link: externalLink || undefined,
          contact: contactInfo || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to extract event data")
      }

      const data: EventExtractionOutput = await response.json()
      setExtractedData(data)

      // Check if follow-up is needed
      if (data.confidence.datetime < 0.6) {
        setFollowUpQuestion("What day and time is this event?")
      } else if (data.confidence.location < 0.6) {
        setFollowUpQuestion("Where is this event taking place?")
      }

      // Map AI broad slug → canonical chip when possible
      if (data.category !== "auto") {
        const mapped = coerceToCanonicalEventCategory(String(data.category))
        setSelectedCategory(mapped ?? "auto")
      }
    } catch (err) {
      setError("Couldn't extract event details. Please try rephrasing your description.")
      console.error("[v0] Extraction error:", err)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSubmit = async () => {
    if (!extractedData) return

    // If there's a follow-up question and no answer, prompt user
    if (followUpQuestion && !followUpAnswer.trim()) {
      setError("Please answer the question above before posting")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Store extracted data in session storage for the review form
      const reviewData = {
        sourceText,
        extraction: extractedData,
        category: selectedCategory,
        followUpAnswer: followUpAnswer || undefined,
        imageUrl: imageUrl || undefined,
        externalUrl: externalLink || undefined,
        contactInfo: contactInfo || undefined,
      }

      sessionStorage.setItem("ai-event-draft", JSON.stringify(reviewData))

      // Redirect to review form
      router.push("/events/review-draft")
    } catch (err: any) {
      setError(err.message || "Failed to proceed. Please try again.")
      console.error("[v0] Navigation error:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Input Section */}
      <div className="space-y-6">
        <div>
          <Label htmlFor="event-text" className="text-base font-medium">
            Describe your event
          </Label>
          <Textarea
            id="event-text"
            placeholder={EXAMPLE_PLACEHOLDER}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            className="mt-2 min-h-[200px] resize-y text-base"
            disabled={isExtracting || isSubmitting}
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Category</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                disabled={isExtracting || isSubmitting}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <EventPosterUpload
          imageUrl={imageUrl}
          onImageUrlChange={setImageUrl}
          disabled={isExtracting || isSubmitting}
          urlInputId="image-url-fallback"
        />

        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowOptional(!showOptional)} className="gap-2">
            {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Add optional details
          </Button>

          {showOptional && (
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="external-link">Website or tickets link</Label>
                <Input
                  id="external-link"
                  placeholder="https://..."
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  disabled={isExtracting || isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="contact-info">Contact (email or phone)</Label>
                <Input
                  id="contact-info"
                  placeholder="contact@example.com"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  disabled={isExtracting || isSubmitting}
                />
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleExtract}
          disabled={isExtracting || !sourceText.trim()}
          className="w-full gap-2"
          size="lg"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Preview
            </>
          )}
        </Button>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Right: Preview Section */}
      <div>
        {extractedData ? (
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div>
                <h2 className="text-balance text-2xl font-bold">{extractedData.title}</h2>
                {extractedData.notes_for_user.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {extractedData.notes_for_user.map((note, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        ℹ️ {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                  <p className="text-base">
                    <ClientOnly>
                      {new Date(extractedData.start).toLocaleString()}
                      {extractedData.end && ` - ${new Date(extractedData.end).toLocaleString()}`}
                    </ClientOnly>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confidence: {Math.round(extractedData.confidence.datetime * 100)}%
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="text-base">
                    {extractedData.location.name || extractedData.location.address || "Not specified"}
                  </p>
                  {extractedData.location.address && extractedData.location.name && (
                    <p className="text-sm text-muted-foreground">{extractedData.location.address}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Confidence: {Math.round(extractedData.confidence.location * 100)}%
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-pretty text-sm">{extractedData.description}</p>
                </div>

                <div className="flex flex-wrap gap-4">
                  {extractedData.price && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Price</p>
                      <p className="capitalize">{extractedData.price}</p>
                    </div>
                  )}

                  {extractedData.organizer_name && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Organizer</p>
                      <p>{extractedData.organizer_name}</p>
                    </div>
                  )}
                </div>

                {extractedData.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tags</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {extractedData.tags.map((tag, i) => (
                        <span key={i} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <p>
                    {selectedCategory === "auto"
                      ? "Auto-detect"
                      : CATEGORY_UI_METADATA[selectedCategory].defaultLabel}
                  </p>
                </div>
              </div>

              {followUpQuestion && (
                <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
                  <Label htmlFor="follow-up" className="text-sm font-medium">
                    {followUpQuestion}
                  </Label>
                  <Input
                    id="follow-up"
                    value={followUpAnswer}
                    onChange={(e) => setFollowUpAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="mt-2"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || Boolean(followUpQuestion && !followUpAnswer.trim())}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Looks good → Post"
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex h-full min-h-[400px] items-center justify-center">
            <CardContent className="text-center">
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                Describe your event and click Preview to see how it looks
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
