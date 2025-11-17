"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Volume2, VolumeX, Plus } from 'lucide-react'
import { ResultCard } from "@/components/search/result-card"
import { DraftEventCard } from "@/components/events/draft-event-card"
import { DraftsList } from "@/components/events/drafts-list"
import Link from "next/link"
import { speak, stopSpeaking } from "@/lib/tts"
import { toast } from "@/hooks/use-toast"
import { SmartInputBar } from "@/components/search/smart-input-bar"
import ClientOnly from "@/components/ClientOnly"
import { useI18n } from "@/lib/i18n/context"

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
  const { t } = useI18n()
  
  console.log("[v0] Post Event translation:", t("event.postEvent"))
  
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

      const dateDisplay = <ClientOnly>{new Date(draft.date).toLocaleDateString()}</ClientOnly>
      toast({
        title: "Draft Saved",
        description: `"${draft.title}" saved for ${dateDisplay} at ${draft.time} in ${draft.venue || draft.city}`,
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

      if (!intentResponse.ok) {
        const errorText = await intentResponse.text()
        console.error("[v0] Intent API failed:", intentResponse.status, errorText)
        throw new Error(`Intent recognition failed (${intentResponse.status})`)
      }

      const intentData = await intentResponse.json()
      console.log("[v0] Intent data:", intentData)

      if (intentData.paraphrase) {
        setSearchParaphrase(intentData.paraphrase)
      }

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

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text()
        console.error("[v0] Search API failed:", searchResponse.status, errorText)
        throw new Error(`Search failed (${searchResponse.status})`)
      }

      const results = await searchResponse.json()
      const eventsArray = Array.isArray(results) ? results : results.results || []

      if (eventsArray.length === 0) {
        toast({
          title: "No Results",
          description: "No events found. Try different keywords or create your own.",
        })
        setSearchResults([])
        setShowResults(false)
      } else {
        setSearchResults(eventsArray)
        setShowResults(true)
        setShowDraftCard(false)
      }

      if (/create|make|host|post|add|schedule|organize|set up/i.test(query)) {
        toast({
          title: "Want to create an event?",
          description: "Use the Post Event button to submit your event.",
        })
      }
    } catch (error: any) {
      console.error("[v0] Search error:", error)
      toast({
        title: "Search Failed",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl py-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {t("home.hero.title")}
          </h2>
          <p className="mb-8 text-lg text-muted-foreground text-balance">
            {t("home.hero.subtitle")}
          </p>

          <SmartInputBar
            onSearch={handleSmartSearch}
            onError={(error) => {
              toast({
                title: t("home.toast.error"),
                description: error,
                variant: "destructive",
              })
            }}
          />

          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-2xl font-bold text-foreground">
              To create an event, please use this button:
            </p>
            <Button asChild size="lg" className="gap-2 min-w-[200px]">
              <Link href="/add-event" className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                <span>Post Event</span>
              </Link>
            </Button>
          </div>

          {drafts.length > 0 && (
            <Button
              variant="outline"
              className="mt-6 bg-transparent"
              onClick={() => setShowDraftsList(!showDraftsList)}
            >
              {t("home.drafts.viewDrafts").replace("{count}", drafts.length.toString())}
            </Button>
          )}

          <p className="mt-8 text-sm text-muted-foreground">
            {t("home.hero.naturalLanguageHint")}
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
            <h3 className="text-2xl font-semibold mb-6">{t("home.drafts.title")}</h3>
            <DraftsList drafts={drafts} onEdit={handleEditDraft} onDelete={handleDeleteDraft} />
          </div>
        )}

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
                  title={isSpeakingSearch ? t("home.search.speaking") : t("home.search.speak")}
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
                <p className="text-lg text-muted-foreground">{t("home.search.noResults")}</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-16 border-t bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>{t("home.footer.tagline")}</p>
        </div>
      </footer>
    </div>
  )
}
