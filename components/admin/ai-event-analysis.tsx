"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"

interface EventAnalysis {
  qualityScore: number
  spamProbability: number
  contentFlags: string[]
  suggestedCategories: string[]
  sentiment: "positive" | "neutral" | "negative"
  recommendations: string[]
  shouldAutoApprove: boolean
}

interface AIEventAnalysisProps {
  eventId: string
}

export function AIEventAnalysis({ eventId }: AIEventAnalysisProps) {
  const [analysis, setAnalysis] = useState<EventAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzeEvent = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch(`/api/admin/events/${eventId}/analyze`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to analyze event")
      }

      const data = await response.json()
      setAnalysis(data)
      toast.success("AI analysis complete")
    } catch (error) {
      toast.error("Failed to analyze event")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-4">
      {!analysis ? (
        <Button onClick={analyzeEvent} disabled={isAnalyzing} variant="outline" className="w-full bg-transparent">
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing with AI...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analyze with AI
            </>
          )}
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Analysis
            </CardTitle>
            <CardDescription>Automated content analysis and recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quality Score */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Quality Score</span>
                <Badge variant={analysis.qualityScore >= 70 ? "default" : "secondary"}>
                  {analysis.qualityScore}/100
                </Badge>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${analysis.qualityScore}%` }} />
              </div>
            </div>

            {/* Spam Probability */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Spam Risk</span>
                <Badge variant={analysis.spamProbability < 0.3 ? "default" : "destructive"}>
                  {(analysis.spamProbability * 100).toFixed(0)}%
                </Badge>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-destructive transition-all"
                  style={{ width: `${analysis.spamProbability * 100}%` }}
                />
              </div>
            </div>

            {/* Auto-Approve Recommendation */}
            <div className="flex items-center gap-2 rounded-lg border p-3">
              {analysis.shouldAutoApprove ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Recommended for auto-approval</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium">Manual review recommended</span>
                </>
              )}
            </div>

            {/* Content Flags */}
            {analysis.contentFlags.length > 0 && (
              <div>
                <span className="mb-2 block text-sm font-medium">Content Flags</span>
                <div className="flex flex-wrap gap-2">
                  {analysis.contentFlags.map((flag, i) => (
                    <Badge key={i} variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Categories */}
            <div>
              <span className="mb-2 block text-sm font-medium">Suggested Categories</span>
              <div className="flex flex-wrap gap-2">
                {analysis.suggestedCategories.map((category, i) => (
                  <Badge key={i} variant="outline">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Sentiment */}
            <div>
              <span className="mb-2 block text-sm font-medium">Sentiment</span>
              <Badge
                variant={
                  analysis.sentiment === "positive"
                    ? "default"
                    : analysis.sentiment === "neutral"
                      ? "secondary"
                      : "destructive"
                }
              >
                {analysis.sentiment}
              </Badge>
            </div>

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
              <div>
                <span className="mb-2 block text-sm font-medium">Recommendations</span>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={analyzeEvent} variant="ghost" size="sm" className="w-full">
              Re-analyze
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
