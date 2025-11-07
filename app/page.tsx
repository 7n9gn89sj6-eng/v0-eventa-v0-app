"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Volume2, VolumeX, List } from "lucide-react"
import { UserNav } from "@/components/auth/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { VersionBadge } from "@/components/version-badge"
import { ResultCard } from "@/components/search/result-card"
import { DraftEventCard } from "@/components/events/draft-event-card"
import { DraftsList } from "@/components/events/drafts-list"
import Link from "next/link"
import { speak, stopSpeaking } from "@/lib/tts"
import { toast } from "@/hooks/use-toast"
import { SmartInputBar } from "@/components/search/smart-input-bar"

interface DraftEvent {
  id: string
  title: string
  category: string
  city: string
  venue: string
  date: string
  time: string
  description: string
  sourceText?: string
}

export default function HomePage() {
  const locale = "en"
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchParaphrase, setSearchParaphrase] = useState("")
  const [showResults, setShowResults] = useState(false)

  const [showDraftCard, setShowDraftCard] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<Partial<DraftEvent> | null>(null)
  const [draftParaphrase, setDraftParaphrase] = useState("")
  const [drafts, setDrafts] = useState<DraftEvent[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("eventa-drafts")
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [showDraftsList, setShowDraftsList] = useState(false)
  const [followUpQuestion, setFollowUpQuestion] = useState("")
  const [isSpeakingSearch, setIsSpeakingSearch] = useState(false)
  const searchBarRef = useRef<{ setQuery: (q: string) => void } | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("eventa-drafts", JSON.stringify(drafts))
    }
  }, [drafts])

  const handleSearch = (results: any[], paraphrase: string) => {
    setSearchResults(results)
    setSearchParaphrase(paraphrase)
    setShowResults(true)
    setShowDraftCard(false)
  }

  const handleCreate = (extracted: any, paraphrase: string) => {
    setShowResults(false)
    setShowDraftCard(true)
    setDraftParaphrase(paraphrase)

    // Check for validation errors
    if (extracted.validation?.pastDate) {
      toast({
        title: "Past Date Detected",
        description: "The date you specified is in the past. Please choose a future date.",
        variant: "destructive",
      })
      return
    }

    if (extracted.validation?.timeConflicts) {
      toast({
        title: "Conflicting Times",
        description: `Multiple conflicting times detected: ${extracted.validation.timeConflicts.join(", ")}. Please clarify.`,
        variant: "destructive",
      })
    }

    if (extracted.validation?.invalidDate) {
      toast({
        title: "Invalid Date",
        description: "The date format is invalid. Please use a valid date.",
        variant: "destructive",
      })
    }

    // Set draft with extracted data
    setCurrentDraft({
      title: extracted.title || "",
      category: extracted.type || "",
      city: extracted.city || "",
      venue: extracted.venue || "",
      date: extracted.date_iso || "",
      time: extracted.time_24h || "",
      description: extracted.description || "",
    })

    // Check for missing fields and ask follow-up
    if (extracted.missingFields && extracted.missingFields.length > 0) {
      const missing = extracted.missingFields[0]
      if (missing === "date") {
        setFollowUpQuestion("When would you like this event to take place?")
      } else if (missing === "time") {
        setFollowUpQuestion("What time should the event start?")
      } else if (missing === "location") {
        setFollowUpQuestion("Where will this event be held?")
      } else if (missing === "title") {
        setFollowUpQuestion("What would you like to call this event?")
      }
    }
  }

  const handleConfirmDraft = (draft: DraftEvent) => {
    try {
      const newDraft = {
        ...draft,
        id: `draft-${Date.now()}`,
      }

      setDrafts((prev) => [...prev, newDraft])
      setShowDraftCard(false)
      setCurrentDraft(null)
      setFollowUpQuestion("")

      toast({
        title: "Draft Saved",
        description: `"${draft.title}" saved for ${new Date(draft.date).toLocaleDateString()} at ${draft.time} in ${draft.venue || draft.city}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCancelDraft = () => {
    setShowDraftCard(false)
    setCurrentDraft(null)
    setFollowUpQuestion("")
  }

  const handleEditDraft = (draft: DraftEvent) => {
    setCurrentDraft(draft)
    setDraftParaphrase(`Edit: ${draft.title}`)
    setShowDraftCard(true)
    setShowDraftsList(false)
  }

  const handleDeleteDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
    toast({
      title: "Draft Deleted",
      description: "Your draft has been removed.",
    })
  }

  const handleError = (error: string) => {
    setShowResults(false)
    setSearchResults([])
  }

  const handleSpeakSearch = () => {
    if (isSpeakingSearch) {
      stopSpeaking()
      setIsSpeakingSearch(false)
    } else {
      speak(searchParaphrase, locale)
      setIsSpeakingSearch(true)

      // Reset speaking state when speech ends
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const checkSpeaking = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            setIsSpeakingSearch(false)
            clearInterval(checkSpeaking)
          }
        }, 100)
      }
    }
  }

  const handleSmartSearch = async (query: string) => {
    console.log("[v0] Smart search:", query)

    try {
      // Call intent API
      const intentResponse = await fetch("/api/search/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode: "text",
          step: 4,
          uiLang: locale,
        }),
      })

      const intentData = await intentResponse.json()

      if (intentData.paraphrase) {
        setSearchParaphrase(intentData.paraphrase)
      }

      // Call dual search
      const searchResponse = await fetch("/api/search/dual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          entities: intentData.extracted,
          input_mode: "text",
          uiLang: locale,
        }),
      })

      const searchData = await searchResponse.json()

      if (searchData.count === 0) {
        toast({
          title: "No Results",
          description: "No events found. Try different keywords or create your own.",
        })
      } else {
        setSearchResults(searchData.results || [])
        setShowResults(true)
        setShowDraftCard(false)
      }
    } catch (error) {
      console.error("[v0] Search error:", error)
      toast({
        title: "Search Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSmartCreate = async (query: string) => {
    console.log("[v0] Smart create:", query)

    try {
      // Call AI extraction
      const extractResponse = await fetch("/api/ai/extract-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_text: query }),
      })

      if (!extractResponse.ok) {
        throw new Error("Extraction failed")
      }

      const extracted = await extractResponse.json()

      // Check confidence
      const avgConfidence =
        (extracted.confidence.datetime + extracted.confidence.location + extracted.confidence.title) / 3

      if (avgConfidence < 0.6) {
        // Low confidence - ask follow-up or route to advanced form
        const lowConfidenceFields = []
        if (extracted.confidence.datetime < 0.6) lowConfidenceFields.push("date/time")
        if (extracted.confidence.location < 0.6) lowConfidenceFields.push("location")

        toast({
          title: "Need More Details",
          description: `Please clarify: ${lowConfidenceFields.join(", ")}`,
        })

        // Route to advanced form with prefilled data
        const params = new URLSearchParams({
          title: extracted.title || "",
          description: extracted.description || "",
          location: extracted.location?.address || "",
        })
        window.location.href = `/events/new?${params.toString()}`
        return
      }

      // Create draft and redirect to review
      const draftId = `draft-${Date.now()}`
      const draft = {
        id: draftId,
        title: extracted.title || "",
        category: extracted.category || "",
        city: extracted.location?.city || "",
        venue: extracted.location?.venue || "",
        date: extracted.datetime?.date || "",
        time: extracted.datetime?.time || "",
        description: extracted.description || "",
        sourceText: query,
      }

      // Save to localStorage
      const existingDrafts = JSON.parse(localStorage.getItem("eventa-drafts") || "[]")
      localStorage.setItem("eventa-drafts", JSON.stringify([...existingDrafts, draft]))

      // Redirect to advanced form with draft
      window.location.href = `/events/new?draftId=${draftId}`
    } catch (error) {
      console.error("[v0] Create error:", error)

      // Route to advanced form on failure
      const params = new URLSearchParams({ description: query })
      window.location.href = `/events/new?${params.toString()}`
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            <h1 className="text-xl font-bold">Eventa</h1>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <VersionBadge />
            </div>

            <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
              <Link href="/events">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Browse</span>
              </Link>
            </Button>

            <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => {}}>
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Location</span>
            </Button>

            <LanguageSwitcher />

            <UserNav />
          </div>
        </div>
        <div className="md:hidden flex justify-center pb-2">
          <VersionBadge />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl py-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">Discover & Create Events</h2>
          <p className="mb-8 text-lg text-muted-foreground text-balance">
            Search for events or create your own with AI assistance
          </p>

          <SmartInputBar
            onSearch={handleSmartSearch}
            onCreate={handleSmartCreate}
            onError={(error) => {
              toast({
                title: "Error",
                description: error,
                variant: "destructive",
              })
            }}
          />

          <div className="mt-6">{/* SearchFiltersComponent removed */}</div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <p className="w-full text-sm text-muted-foreground mb-2">Try these examples:</p>
            {[
              "Create an open mic at The Dock next Saturday 8pm",
              "Create yoga in Lisbon on Saturday",
              "Create jazz night Friday 7pm, start 8pm",
              "Create community picnic yesterday 2pm",
              "Create photography meetup next Thursday 6pm",
              "What's on in Athens this weekend?",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  if (searchBarRef.current) {
                    searchBarRef.current.setQuery(example)
                  }
                }}
                className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                {example}
              </button>
            ))}
          </div>

          {drafts.length > 0 && (
            <Button
              variant="outline"
              className="mt-6 bg-transparent"
              onClick={() => setShowDraftsList(!showDraftsList)}
            >
              View Drafts ({drafts.length})
            </Button>
          )}

          <p className="mt-8 text-sm text-muted-foreground">
            Search for events or create new ones using natural language.
          </p>
        </div>

        {showDraftCard && currentDraft && (
          <div className="mx-auto max-w-2xl mt-12">
            {followUpQuestion && (
              <div className="mb-4 p-4 bg-muted rounded-lg text-center">
                <p className="text-sm font-medium">{followUpQuestion}</p>
              </div>
            )}
            <DraftEventCard
              draft={currentDraft}
              paraphrase={draftParaphrase}
              onConfirm={handleConfirmDraft}
              onCancel={handleCancelDraft}
              onAskFollowUp={(field) => {
                // Handle follow-up questions
              }}
            />
          </div>
        )}

        {showDraftsList && (
          <div className="mx-auto max-w-2xl mt-12">
            <h3 className="text-2xl font-semibold mb-6">Your Drafts</h3>
            <DraftsList drafts={drafts} onEdit={handleEditDraft} onDelete={handleDeleteDraft} />
          </div>
        )}

        {/* Search results */}
        {showResults && (
          <div className="mx-auto max-w-4xl mt-12">
            {searchParaphrase && (
              <div className="flex items-center justify-center gap-3 mb-6">
                <h3 className="text-2xl font-semibold text-center">{searchParaphrase}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSpeakSearch}
                  title={isSpeakingSearch ? "Stop speaking" : "Speak"}
                >
                  {isSpeakingSearch ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
            )}

            {searchResults.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {searchResults.map((result, index) => (
                  <ResultCard
                    key={result.id || `result-${index}`}
                    result={{
                      source: result.source === "internal" ? "eventa" : "web",
                      id: result.id,
                      title: result.title,
                      startAt: result.startAt || result.startsAt,
                      endAt: result.endAt || result.endsAt,
                      venue: result.venueName || result.venue,
                      address: result.address || result.locationAddress,
                      url: result.source === "internal" ? `/events/${result.id}` : result.url,
                      snippet: result.description?.slice(0, 200) + "..." || result.snippet,
                      categories: result.categories,
                      priceFree: result.priceFree,
                      imageUrl: result.imageUrls?.[0] || result.imageUrl,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No results found</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Eventa – AI-powered event discovery</p>
        </div>
      </footer>
    </div>
  )
}
