"use client"

import { MessageSquare } from "lucide-react"
import { openBetaFeedback } from "@/lib/beta-feedback"

export function SiteFooter() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <span>© {new Date().getFullYear()} Eventa</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Beta</span>
          </div>
          
          <button
            onClick={openBetaFeedback}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm underline-offset-4 hover:underline"
            aria-label="Send beta feedback - opens your email client"
            title="If anything feels confusing, broken, or unclear — click here and write it in your own words"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Beta feedback</span>
          </button>
        </div>
      </div>
    </footer>
  )
}

