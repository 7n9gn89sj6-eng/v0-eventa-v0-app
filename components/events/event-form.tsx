"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus } from "lucide-react"
import { DateTime } from "luxon"

// ----------------------
// CONSTANTS
// ----------------------

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

// ----------------------
// FORM SCHEMA
// ----------------------

const eventFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),

    categories: z.array(z.string()),
    languages: z.array(z.string()),

    startAt: z.coerce.date({ required_error: "Start time required" }),
    endAt: z.coerce.date({ required_error: "End time required" }),

    venueName: z.string().optional(),
    address: z.string().optional(),

    websiteUrl: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),

    creatorEmail: z.string().email("Valid email required"),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "End time must be after start time",
    path: ["endAt"],
  })

type EventFormValues = z.infer<typeof eventFormSchema>

// ----------------------
// MAIN COMPONENT
// ----------------------

export function EventForm({ initialData, draftId }: any = {}) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      categories: [],
      languages: ["en"],

      startAt: "",
      endAt: "",
      venueName: "",
      address: "",

      websiteUrl: "",
      imageUrls: [],

      creatorEmail: "", // IMPORTANT
    },
  })

  const formData = watch()

  // ----------------------
  // SUBMIT HANDLER
  // ----------------------

  const onSubmit = async (values: EventFormValues) => {
    try {
      const payload = {
        title: values.title,
        description: values.description,

        // backend field names
        start: values.startAt.toISOString(),
        end: values.endAt.toISOString(),
        timezone: DateTime.local().zoneName,

        location: {
          name: values.venueName || "",
          address: values.address || "",
        },

        externalUrl: values.websiteUrl || "",
        imageUrl: values.imageUrls?.[0] || "",

        categories: values.categories,
        languages: values.languages,

        creatorEmail: values.creatorEmail,
      }

      const response = await fetch("/api/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Event creation failed:", data)
        alert(data.error || "Failed to create event")
        return
      }

      router.push(`/event/submitted?eventId=${data.eventId}`)

    } catch (err: any) {
      console.error("Submit error", err)
      alert("An unexpected error occurred.")
    }
  }

  // ----------------------
  // TOGGLERS
  // ----------------------

  const toggleCategory = (category: string) => {
    const current = formData.categories
    setValue(
      "categories",
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    )
  }

  const toggleLanguage = (lang: string) => {
    const current = formData.languages
    setValue(
      "languages",
      current.includes(lang)
        ? current.filter((l) => l !== lang)
        : [...current, lang],
    )
  }

  // ----------------------
  // UI
  // ----------------------

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">

          {/* Creator Email */}
          <div className="space-y-2">
            <Label htmlFor="creatorEmail">
              Your Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="creatorEmail"
              type="email"
              placeholder="you@example.com"
              disabled={isSubmitting}
              {...register("creatorEmail")}
            />
            {errors.creatorEmail && (
              <p className="text-sm text-destructive">{errors.creatorEmail.message}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              disabled={isSubmitting}
              placeholder="e.g., Athens Farmers Market"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              rows={5}
              disabled={isSubmitting}
              placeholder="Describe your event..."
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => toggleCategory(category)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    formData.categories.includes(category)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
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
              <Label>Start *</Label>
              <Input type="datetime-local" {...register("startAt")} />
            </div>
            <div className="space-y-2">
              <Label>End *</Label>
              <Input type="datetime-local" {...register("endAt")} />
              {errors.endAt && (
                <p className="text-sm text-destructive">{errors.endAt.message}</p>
              )}
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="venueName">Venue Name</Label>
            <Input id="venueName" {...register("venueName")} />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website</Label>
            <Input id="websiteUrl" {...register("websiteUrl")} />
          </div>

          {/* Languages */}
          <div className="space-y-3">
            <Label>Event Languages</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`rounded-full px-3 py-1 ${
                    formData.languages.includes(lang.code)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Publish Event
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
