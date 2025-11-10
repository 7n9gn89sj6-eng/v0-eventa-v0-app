"use client"

import type React from "react"

import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { Search, Sparkles, Loader2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface SmartInputBarProps {
  onSearch?: (query: string) => Promise<void>
  onCreate?: (query: string) => Promise<void>
  onError?: (error: string) => void
  className?: string
}

export interface SmartInputBarRef {
  setQuery: (query: string) => void
}

const INTENT_PATTERNS = /^\s*(create|make|host|post|add|schedule|organize|set up|i want to run|my event)\b/i

const SEARCH_EXAMPLES = ["jazz this weekend", "Athens food", "kids Saturday"]
const CREATE_EXAMPLES = [
  "Open mic at The Dock next Saturday 8pm",
  "yoga in Lisbon on Saturday",
  "community picnic tomorrow 2pm",
]

export const SmartInputBar = forwardRef<SmartInputBarRef, SmartInputBarProps>(
  ({ onSearch, onCreate, onError, className }, ref) => {
    const [query, setQuery] = useState("")
    const [mode, setMode] = useState<"search" | "create">("search")
    const [detectedMode, setDetectedMode] = useState<"create" | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [showExamples, setShowExamples] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useImperativeHandle(ref, () => ({
      setQuery: (newQuery: string) => {
        setQuery(newQuery)
        detectIntent(newQuery)
      },
    }))

    useEffect(() => {
      if (typeof window !== "undefined") {
        const savedMode = localStorage.getItem("eventa-input-mode") as "search" | "create" | null
        if (savedMode) {
          setMode(savedMode)
        }
      }
    }, [])

    useEffect(() => {
      if (typeof window !== "undefined") {
        localStorage.setItem("eventa-input-mode", mode)
      }
    }, [mode])

    const detectIntent = (text: string) => {
      if (INTENT_PATTERNS.test(text)) {
        if (mode === "search") {
          setDetectedMode("create")
        }
      } else {
        setDetectedMode(null)
      }
    }

    const handleInputChange = (value: string) => {
      setQuery(value)
      detectIntent(value)
      if (value.trim()) {
        setShowExamples(false)
      } else {
        setShowExamples(true)
      }
    }

    const handleSwitchToCreate = () => {
      setMode("create")
      setDetectedMode(null)
    }

    const handleUndoSwitch = () => {
      setMode("search")
      setDetectedMode(null)
    }

    const handleSubmit = async () => {
      if (!query.trim()) return

      setError(null)
      setIsProcessing(true)
      setShowExamples(false)

      try {
        if (mode === "search") {
          await onSearch?.(query)
        } else {
          await onCreate?.(query)
        }
      } catch (error: any) {
        console.error("[v0] Smart input error:", error)
        const errorMessage = error?.message || "Something went wrong. Please try again."
        setError(errorMessage)
        onError?.(errorMessage)
      } finally {
        setIsProcessing(false)
      }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }

    const examples = mode === "search" ? SEARCH_EXAMPLES : CREATE_EXAMPLES
    const guidanceText =
      mode === "search" ? "Find events by location, date, or type..." : "Describe your event in plain language..."

    return (
      <div className={cn("w-full space-y-3", className)}>
        <div className="relative flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={guidanceText}
              className="w-full rounded-lg border bg-background px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              disabled={isProcessing}
              autoFocus
            />
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <div className="inline-flex rounded-lg border bg-background p-1">
              <button
                type="button"
                onClick={() => setMode("search")}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  mode === "search"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                disabled={isProcessing}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setMode("create")}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  mode === "create"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                disabled={isProcessing}
              >
                Create
              </button>
            </div>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!query.trim() || isProcessing}
              size="lg"
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : mode === "search" ? (
                <>
                  <Search className="h-4 w-4" />
                  Go
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex sm:hidden items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("search")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                mode === "search"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground border-border",
              )}
              disabled={isProcessing}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                mode === "create"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground border-border",
              )}
              disabled={isProcessing}
            >
              Create
            </button>
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!query.trim() || isProcessing}
            className="flex-1 gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing
              </>
            ) : mode === "search" ? (
              "Go"
            ) : (
              "Create"
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {detectedMode === "create" && mode === "search" && (
          <Alert className="border-primary/50 bg-primary/10">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between gap-2">
              <span className="text-sm text-primary">Switched to Create mode</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSwitchToCreate} className="h-7 text-xs">
                  Continue
                </Button>
                <Button variant="ghost" size="sm" onClick={handleUndoSwitch} className="h-7 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Undo
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showExamples && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Try these:</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setQuery(example)
                    setShowExamples(false)
                  }}
                  className="rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
)

SmartInputBar.displayName = "SmartInputBar"
