"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Volume2, VolumeX } from "lucide-react"
import { UserNav } from "@/components/auth/user-nav"
import { VersionBadge } from "@/components/version-badge"
import { AISearchBar } from "@/components/search/ai-search-bar"
import { ResultCard } from "@/components/search/result-card"
import { DraftEventCard } from "@/components/events/draft-event-card"
import { DraftsList } from "@/components/events/drafts-list"
import Link from "next/link"
import { speak, stopSpeaking } from "@/lib/tts"
import { toast } from "@/hooks/use-toast"

interface DraftEvent {
  id: string
  title: string
  category: string
  city: string
  venue: string
  date: string
  time: string
  description: string
}

export default function HomePage() {
  const locale = "en"
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchParaphrase, setSearchParaphrase] = useState("")
  const [showResults, setShowResults] = useState(false)

  const [showDraftCard, setShowDraftCard] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<Partial<DraftEvent> | null>(null)
  const [draftParaphrase, setDraftParaphrase] = useState("")
  const [drafts, setDrafts] = useState<DraftEvent[]>([])
  const [showDraftsList, setShowDraftsList] = useState(false)
  const [followUpQuestion, setFollowUpQuestion] = useState("")
  const [isSpeakingSearch, setIsSpeakingSearch] = useState(false)
  const searchBarRef = useRef<{ setQuery: (q: string) => void } | null>(null)

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

            <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => {}}>
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Location</span>
            </Button>

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
          <p className="mb-8 text-lg text-muted-foreground text-balance">Find events or create your own.</p>

          <AISearchBar ref={searchBarRef} onSearch={handleSearch} onCreate={handleCreate} onError={handleError} />

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
