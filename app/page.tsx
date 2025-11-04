"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Plus, Volume2, VolumeX } from "lucide-react"
import { UserNav } from "@/components/auth/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { AISearchBar } from "@/components/search/ai-search-bar"
import { ResultCard } from "@/components/search/result-card"
import { DraftEventCard } from "@/components/events/draft-event-card"
import { DraftsList } from "@/components/events/drafts-list"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { speak, stopSpeaking } from "@/lib/tts"

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
  const locale = useLocale()
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

  const { toast } = useToast()
  const t = useTranslations("common")
  const tHome = useTranslations("home")
  const tToast = useTranslations("toast")

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
        title: tToast("pastDateTitle"),
        description: tToast("pastDateDescription"),
        variant: "destructive",
      })
      return
    }

    if (extracted.validation?.timeConflicts) {
      toast({
        title: tToast("conflictingTimesTitle"),
        description: tToast("conflictingTimesDescription", {
          times: extracted.validation.timeConflicts.join(", "),
        }),
        variant: "destructive",
      })
    }

    if (extracted.validation?.invalidDate) {
      toast({
        title: tToast("invalidDateTitle"),
        description: tToast("invalidDateDescription"),
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
        setFollowUpQuestion(tToast("missingDate"))
      } else if (missing === "time") {
        setFollowUpQuestion(tToast("missingTime"))
      } else if (missing === "location") {
        setFollowUpQuestion(tToast("missingLocation"))
      } else if (missing === "title") {
        setFollowUpQuestion(tToast("missingTitle"))
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
        title: tToast("draftSavedTitle"),
        description: tToast("draftSavedDescription", {
          title: draft.title,
          date: new Date(draft.date).toLocaleDateString(),
          time: draft.time,
          venue: draft.venue || draft.city,
        }),
      })

      console.log("[v0] Draft saved:", newDraft)
    } catch (error) {
      console.error("[v0] ERR_DRAFT_SAVE:", error)
      toast({
        title: t("error"),
        description: tToast("draftSaveError"),
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
      title: tToast("draftDeletedTitle"),
      description: tToast("draftDeletedDescription"),
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
            <h1 className="text-xl font-bold">{t("eventa")}</h1>
          </Link>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => {}}>
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">{tHome("location")}</span>
            </Button>

            <LanguageSwitcher />

            <Button asChild size="sm" className="gap-2">
              <Link href="/add-event">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{tHome("addEvent")}</span>
              </Link>
            </Button>

            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl py-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">{tHome("heroTitle")}</h2>
          <p className="mb-8 text-lg text-muted-foreground text-balance">{tHome("heroSubtitle")}</p>

          <AISearchBar ref={searchBarRef} onSearch={handleSearch} onCreate={handleCreate} onError={handleError} />

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <p className="w-full text-sm text-muted-foreground mb-2">{tHome("tryTestCases")}</p>
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
              {tHome("viewDrafts", { count: drafts.length })}
            </Button>
          )}

          <p className="mt-8 text-sm text-muted-foreground">{tHome("consoleNote")}</p>
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
            <h3 className="text-2xl font-semibold mb-6">{tHome("yourDrafts")}</h3>
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
                <p className="text-lg text-muted-foreground">{tHome("noResults")}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>{tHome("footerText")}</p>
        </div>
      </footer>
    </div>
  )
}
