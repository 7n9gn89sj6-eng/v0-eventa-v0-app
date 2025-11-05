"use client"

import type React from "react"
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { Search, Mic, MicOff, Loader2, Sparkles, RotateCcw, Volume2, VolumeX } from "lucide-react"
import { Button } from "../ui/button"
import { Alert, AlertDescription } from "../ui/alert"
import { speak, stopSpeaking } from "../../lib/tts"

interface AISearchBarProps {
  onSearch?: (results: any[], paraphrase: string) => void
  onCreate?: (draft: any, paraphrase: string) => void
  onError?: (error: string) => void
}

export interface AISearchBarRef {
  setQuery: (query: string) => void
}

function getRecognitionLanguage(locale: string): string {
  const languageMap: Record<string, string> = {
    el: "el-GR",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    en: "en-US",
  }
  return languageMap[locale] || "en-US"
}

export const AISearchBar = forwardRef<AISearchBarRef, AISearchBarProps>(({ onSearch, onCreate, onError }, ref) => {
  const locale = "en" // Hardcoded locale to 'en'
  const [query, setQuery] = useState("")
  const [lastQuery, setLastQuery] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [feedback, setFeedback] = useState("")
  const [paraphrase, setParaphrase] = useState("")
  const [intent, setIntent] = useState<"search" | "create" | "unclear" | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef<any>(null)

  useImperativeHandle(ref, () => ({
    setQuery: (newQuery: string) => {
      setQuery(newQuery)
    },
  }))

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = getRecognitionLanguage(locale)

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex
        const transcriptText = event.results[current][0].transcript
        setTranscript(transcriptText)

        if (event.results[current].isFinal) {
          setQuery(transcriptText)
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false)
        if (event.error === "not-allowed") {
          setFeedback("I didn't catch that—try again or use the keyboard.")
        } else {
          setFeedback("I didn't catch that—try again or use the keyboard.")
        }
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [locale])

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setFeedback("I didn't catch that—try again or use the keyboard.")
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
      setTranscript("")
      setFeedback("Listening...")
      setParaphrase("")
      setIntent(null)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      setFeedback("Please type or say what you want to do.")
      return
    }

    setIsProcessing(true)
    setFeedback("Understanding your request...")
    setLastQuery(query)
    setParaphrase("")
    setIntent(null)

    try {
      const intentResponse = await fetch("/api/search/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode: isListening ? "voice" : "text",
          step: 4,
          uiLang: locale,
        }),
      })

      const intentData = await intentResponse.json()

      if (intentData.paraphrase) {
        setParaphrase(intentData.paraphrase)
      }

      setIntent(intentData.intent)

      if (intentData.intent === "unclear") {
        setFeedback("Do you want to search or create?")
      } else if (intentData.intent === "create") {
        setFeedback("")
        if (onCreate) {
          onCreate(intentData.extracted, intentData.paraphrase)
        }
      } else if (intentData.intent === "search") {
        setFeedback("Searching...")

        const searchResponse = await fetch("/api/search/dual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            entities: intentData.extracted,
            input_mode: isListening ? "voice" : "text",
            uiLang: locale,
          }),
        })

        const searchData = await searchResponse.json()

        if (searchData.errors?.internal && searchData.errors?.external) {
          setFeedback("We couldn't fetch results right now. Please try again.")
          if (onError) onError(searchData.message || "Both sources unavailable")
        } else if (searchData.errors?.internal) {
          setFeedback("We couldn't reach Eventa right now. Showing web results if available.")
          if (searchData.count === 0) {
            setFeedback("No results found. Try different keywords or create your own event.")
          } else {
            setFeedback("")
            if (onSearch) onSearch(searchData.results, intentData.paraphrase)
          }
        } else if (searchData.errors?.external) {
          setFeedback("Some web sources aren't responding. Showing what we have.")
          if (onSearch) onSearch(searchData.results, intentData.paraphrase)
        } else if (searchData.count === 0) {
          setFeedback("No results found. Try different keywords or create your own event.")
        } else {
          setFeedback("")
          if (onSearch) onSearch(searchData.results, intentData.paraphrase)
        }
      }
    } catch (error) {
      console.error("Search error:", error)
      setFeedback("Something went wrong showing results.")
      if (onError) onError("Something went wrong showing results.")
    } finally {
      setIsProcessing(false)
    }
  }

  const replayLastInput = () => {
    if (lastQuery) {
      setQuery(lastQuery)
      setFeedback("")
      setParaphrase("")
      setIntent(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking()
      setIsSpeaking(false)
    } else {
      speak(paraphrase, locale)
      setIsSpeaking(true)

      // Reset speaking state when speech ends
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const checkSpeaking = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            setIsSpeaking(false)
            clearInterval(checkSpeaking)
          }
        }, 100)
      }
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for events or create a new one..."
            className="w-full rounded-lg border bg-background px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            disabled={isProcessing || isListening}
          />
          <Button
            type="button"
            size="icon"
            variant={isListening ? "default" : "ghost"}
            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
            onClick={toggleVoiceInput}
            disabled={isProcessing}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>
        <Button onClick={handleSearch} disabled={!query.trim() || isProcessing} size="lg" className="gap-2">
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Go
            </>
          )}
        </Button>
        {lastQuery && !isProcessing && (
          <Button onClick={replayLastInput} variant="outline" size="icon" title="Replay last input (QA)">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isListening && transcript && (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm">
          <p className="text-muted-foreground">You said: {transcript}</p>
        </div>
      )}

      {paraphrase && !isProcessing && (
        <Alert className="border-primary/50 bg-primary/10">
          <div className="flex items-start justify-between gap-2">
            <AlertDescription className="text-sm font-medium text-primary flex-1">{paraphrase}</AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSpeak}
              title={isSpeaking ? "Stop speaking" : "Speak"}
            >
              {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </Alert>
      )}

      {intent && intent !== "unclear" && feedback && !isProcessing && (
        <Alert className="border-muted-foreground/30 bg-muted">
          <AlertDescription className="text-sm text-muted-foreground">{feedback}</AlertDescription>
        </Alert>
      )}

      {feedback && !paraphrase && !isListening && intent === "unclear" && (
        <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">{feedback}</div>
      )}

      {feedback && !paraphrase && !isListening && !intent && (
        <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">{feedback}</div>
      )}
    </div>
  )
})

AISearchBar.displayName = "AISearchBar"
