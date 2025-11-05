"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Loader2 } from "lucide-react"

export function AIModerationSummary() {
  const [summary, setSummary] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch("/api/admin/summary")
        if (response.ok) {
          const data = await response.json()
          setSummary(data.summary)
        }
      } catch (error) {
        console.error("Failed to fetch AI summary:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSummary()
  }, [])

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          AI Moderation Assistant
        </CardTitle>
        <CardDescription>Intelligent insights and recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing events...
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{summary}</p>
        )}
      </CardContent>
    </Card>
  )
}
