"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, MapPin, Tag, X, Volume2, VolumeX } from "lucide-react"
import { speak, stopSpeaking } from "@/lib/tts"
import { isPastDateTime } from "../../lib/i18n/date-parser-inline"

interface DraftEvent {
  id: string
  title: string
  category: string
  city: string
  venue: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  description: string
}

interface DraftEventCardProps {
  draft: Partial<DraftEvent>
  paraphrase: string
  onConfirm: (draft: DraftEvent) => void
  onCancel: () => void
  onAskFollowUp: (field: string) => void
}

const CATEGORIES = ["Music", "Sports", "Arts", "Food", "Tech", "Business", "Health", "Education", "Community", "Other"]

export function DraftEventCard({ draft, paraphrase, onConfirm, onCancel, onAskFollowUp }: DraftEventCardProps) {
  const locale = "en"
  const [editedDraft, setEditedDraft] = useState<Partial<DraftEvent>>(draft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSpeaking, setIsSpeaking] = useState(false)

  const updateField = (field: keyof DraftEvent, value: string) => {
    setEditedDraft((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const validateAndConfirm = () => {
    const newErrors: Record<string, string> = {}

    // Check required fields
    if (!editedDraft.title?.trim()) {
      newErrors.title = "Title is required"
    }
    if (!editedDraft.category) {
      newErrors.category = "Category is required"
    }
    if (!editedDraft.date) {
      newErrors.date = "Date is required"
    }
    if (!editedDraft.time) {
      newErrors.time = "Time is required"
    }
    if (!editedDraft.city?.trim() && !editedDraft.venue?.trim()) {
      newErrors.location = "City or venue is required"
    }

    if (editedDraft.date && editedDraft.time) {
      if (isPastDateTime(editedDraft.date, editedDraft.time)) {
        newErrors.date = "Date/time cannot be in the past"
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // All valid, confirm
    onConfirm(editedDraft as DraftEvent)
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
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-2 text-sm text-muted-foreground border-l-2 border-primary pl-3">
        <span className="flex-1">{paraphrase}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleSpeak}
          title={isSpeaking ? "Stop speaking" : "Speak"}
        >
          {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        </Button>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Event Title
        </Label>
        <Input
          id="title"
          value={editedDraft.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Enter event title"
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select value={editedDraft.category || ""} onValueChange={(value) => updateField("category", value)}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
      </div>

      {/* Location (City + Venue) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            City
          </Label>
          <Input
            id="city"
            value={editedDraft.city || ""}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="e.g., Melbourne"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue">Venue</Label>
          <Input
            id="venue"
            value={editedDraft.venue || ""}
            onChange={(e) => updateField("venue", e.target.value)}
            placeholder="e.g., The Dock"
          />
        </div>
        {errors.location && <p className="text-sm text-destructive col-span-2">{errors.location}</p>}
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date
          </Label>
          <Input
            id="date"
            type="date"
            value={editedDraft.date || ""}
            onChange={(e) => updateField("date", e.target.value)}
          />
          {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="time" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time
          </Label>
          <Input
            id="time"
            type="time"
            value={editedDraft.time || ""}
            onChange={(e) => updateField("time", e.target.value)}
          />
          {errors.time && <p className="text-sm text-destructive">{errors.time}</p>}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={editedDraft.description || ""}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Add more details about the event..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button onClick={validateAndConfirm} className="flex-1">
          Confirm Draft
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </Card>
  )
}
