"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus } from "lucide-react"
import { DateTime } from "luxon"

const CATEGORIES = [
  "market",
  "food",
  "music",
  "festival",
  "culture",
  "art",
  "exhibition",
  "workshop",
  "outdoor",
  "traditional",
  "shopping",
  "wine",
  "craft",
  "cooking",
]

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "el", label: "Ελληνικά" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
]

export function EventForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categories: [] as string[],
    startAt: "",
    endAt: "",
    timezone: DateTime.local().zoneName,
    venueName: "",
    address: "",
    priceFree: true,
    priceAmount: "",
    websiteUrl: "",
    languages: ["en"] as string[],
    imageUrls: [] as string[],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setDateError(null)

    if (formData.startAt && formData.endAt) {
      const startDate = new Date(formData.startAt)
      const endDate = new Date(formData.endAt)

      if (endDate <= startDate) {
        setDateError("End must be after start.")
        setIsLoading(false)
        return
      }
    }

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          priceAmount: formData.priceFree ? null : Number.parseInt(formData.priceAmount) * 100, // Convert to cents
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create event")
      }

      const { event } = await response.json()
      router.push(`/events/${event.id}?created=true`)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }))
  }

  const toggleLanguage = (lang: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang) ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang],
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Event Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Athens Farmers Market"
              required
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your event in detail..."
              rows={5}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Include what makes your event special, what attendees can expect, and any important details.
            </p>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <Label>Categories (select all that apply)</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  disabled={isLoading}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    formData.categories.includes(category)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startAt">
                Start Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={formData.startAt}
                onChange={(e) => {
                  setFormData({ ...formData, startAt: e.target.value })
                  setDateError(null)
                }}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">
                End Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={formData.endAt}
                onChange={(e) => {
                  setFormData({ ...formData, endAt: e.target.value })
                  setDateError(null)
                }}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Events auto-hide after the end time.</p>
              {dateError && <p className="text-sm text-destructive">{dateError}</p>}
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="venueName">Venue Name</Label>
            <Input
              id="venueName"
              value={formData.venueName}
              onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
              placeholder="e.g., Central Park"
              disabled={isLoading}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g., 123 Main St, Athens, Greece"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              We'll automatically geocode this address for map display and distance calculations.
            </p>
          </div>

          {/* Price */}
          <div className="space-y-3">
            <Label>Price</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priceFree"
                checked={formData.priceFree}
                onCheckedChange={(checked) => setFormData({ ...formData, priceFree: checked as boolean })}
                disabled={isLoading}
              />
              <Label htmlFor="priceFree" className="font-normal cursor-pointer">
                This event is free
              </Label>
            </div>
            {!formData.priceFree && (
              <div className="space-y-2">
                <Label htmlFor="priceAmount">Price (in your local currency)</Label>
                <Input
                  id="priceAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.priceAmount}
                  onChange={(e) => setFormData({ ...formData, priceAmount: e.target.value })}
                  placeholder="10.00"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website or Registration Link</Label>
            <Input
              id="websiteUrl"
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              placeholder="https://example.com"
              disabled={isLoading}
            />
          </div>

          {/* Languages */}
          <div className="space-y-3">
            <Label>Event Languages</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  disabled={isLoading}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    formData.languages.includes(lang.code)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating event...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Publish Event
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
