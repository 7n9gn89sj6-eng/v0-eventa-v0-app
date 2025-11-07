"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react"
import type { EventExtractionOutput, BroadEventCategory } from "@/lib/types"
import { CATEGORY_LABELS } from "@/lib/ai-extraction"
import { useRouter } from "next/navigation"

const EXAMPLE_PLACEHOLDER = `Sat 12 April, 2–5pm at St Kilda Library. Poetry open mic, gold coin donation, family-friendly. Host: Irene. Register via email.`

export function SimpleEventCreator() {
  const router = useRouter()
  const [sourceText, setSourceText] = useState("")
  const [extractedData, setExtractedData] = useState<EventExtractionOutput | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<BroadEventCategory | "auto">("auto")
  const [showOptional, setShowOptional] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [externalLink, setExternalLink] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null)
  const [followUpAnswer, setFollowUpAnswer] = useState("")

  const categories: Array<{ value: BroadEventCategory | "auto"; label: string }> = [
    { value: "auto", label: "Auto" },
    { value: "arts_culture", label: "Arts & Culture" },
    { value: "music_nightlife", label: "Music & Nightlife" },
    { value: "food_drink", label: "Food & Drink" },
    { value: "family_kids", label: "Family & Kids" },
    { value: "sports_outdoors", label: "Sports & Outdoors" },
    { value: "community_causes", label: "Community" },
    { value: "learning_talks", label: "Learning & Talks" },
    { value: "markets_fairs", label: "Markets & Fairs" },
    { value: "online_virtual", label: "Online" },
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

      // Set category if AI assigned one
      if (data.category !== "auto") {
        setSelectedCategory(data.category as BroadEventCategory)
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
      // Submit event to API
      const response = await fetch("/api/events/create-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          extraction: extractedData,
          category: selectedCategory,
          followUpAnswer: followUpAnswer || undefined,
          imageUrl: imageUrl || undefined,
          externalUrl: externalLink || undefined,
          contactInfo: contactInfo || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create event")
      }

      const result = await response.json()

      // Redirect to confirmation page
      router.push(`/event/confirm?id=${result.eventId}`)
    } catch (err: any) {
      setError(err.message || "Failed to create event. Please try again.")
      console.error("[v0] Submission error:", err)
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

        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowOptional(!showOptional)} className="gap-2">
            {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Add optional details
          </Button>

          {showOptional && (
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="image-url">Image URL</Label>
                <Input
                  id="image-url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={isExtracting || isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="external-link">External link (tickets/info)</Label>
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
                    {new Date(extractedData.start).toLocaleString()}
                    {extractedData.end && ` - ${new Date(extractedData.end).toLocaleString()}`}
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
                      : CATEGORY_LABELS[selectedCategory as BroadEventCategory]}
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
                disabled={isSubmitting || (followUpQuestion && !followUpAnswer.trim())}
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
