"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { DraftEventCard } from "@/components/events/draft-event-card"
import { DraftsList } from "@/components/events/drafts-list"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  const tHomeHero = t("home.hero")
  const tHomeToast = t("home.toast")
  const tHomeDrafts = t("home.drafts")
  const tHomeSearch = t("home.search")
  const tHomeFooter = t("home.footer")

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

    router.push(`/discover?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl py-16 text-center">
          <SmartInputBar
            onSearch={handleSmartSearch}
            onError={(error) => {
              toast({
                title: tHomeToast("error"),
                description: error,
                variant: "destructive",
              })
            }}
          />

          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-2xl font-bold text-foreground">To create an event, please use this button:</p>
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
              {tHomeDrafts("viewDrafts").replace("{count}", drafts.length.toString())}
            </Button>
          )}
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
            <h3 className="text-2xl font-semibold mb-6">{tHomeDrafts("title")}</h3>
            <DraftsList drafts={drafts} onEdit={handleEditDraft} onDelete={handleDeleteDraft} />
          </div>
        )}
      </main>
    </div>
  )
}
