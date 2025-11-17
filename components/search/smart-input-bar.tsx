"use client"

import type React from "react"

import { useState, forwardRef, useImperativeHandle } from "react"
import { Search, Loader2, AlertCircle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"

interface SmartInputBarProps {
  onSearch?: (query: string) => Promise<void>
  onError?: (error: string) => void
  className?: string
}

export interface SmartInputBarRef {
  setQuery: (query: string) => void
}


export const SmartInputBar = forwardRef<SmartInputBarRef, SmartInputBarProps>(
  ({ onSearch, onError, className }, ref) => {
    const { t } = useI18n()
    const tHome = t("home")
    
    const [query, setQuery] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [showExamples, setShowExamples] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useImperativeHandle(ref, () => ({
      setQuery: (newQuery: string) => {
        setQuery(newQuery)
      },
    }))


    const handleInputChange = (value: string) => {
      setQuery(value)
      if (value.trim()) {
        setShowExamples(false)
      } else {
        setShowExamples(true)
      }
    }


    const handleSubmit = async () => {
      if (!query.trim()) return

      setError(null)
      setIsProcessing(true)
      setShowExamples(false)

      try {
        await onSearch?.(query)
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

    const searchExamples = [
      tHome("chips.jazzWeekend"),
      tHome("chips.athensFood"),
      tHome("chips.kidsSaturday"),
      tHome("chips.communityMarkets"),
      tHome("chips.garageSale"),
      tHome("chips.celebrations"),
    ]

    const guidanceText = tHome("search.searchGuidance")

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
                {tHome("search.processing")}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                {tHome("search.go")}
              </>
            )}
          </Button>
        </div>


        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}


        {showExamples && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{tHome("search.tryThese")}</p>
            <div className="flex flex-wrap gap-2">
              {searchExamples.map((example) => (
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
