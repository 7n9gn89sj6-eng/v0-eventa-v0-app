"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Plus } from "lucide-react"
import { DateTime } from "luxon"

import { PlaceAutocomplete } from "@/components/places/place-autocomplete"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { SelectedPlaceWire } from "@/lib/places/selected-place"
import {
  CANONICAL_EVENT_CATEGORY_VALUES,
  CATEGORY_UI_METADATA,
  parseEventCategoryPayload,
} from "@/lib/categories/canonical-event-category"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "el", label: "Ελληνικά" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
]

const eventFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),

    category: z.string().min(1, "Choose an event type"),
    subcategory: z.string().optional(),
    tagsInput: z.string().optional(),
    customCategoryLabel: z.string().optional(),
    originalLanguage: z.string().optional(),

    languages: z.array(z.string()),

    startAt: z.string().min(1, "Start time required"),
    endAt: z.string().min(1, "End time required"),

    venueName: z.string().optional(),
    address: z.string().optional(),

    websiteUrl: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),

    creatorEmail: z.string().email("Valid email required"),
  })
  .refine(
    (d) => {
      const a = new Date(d.startAt).getTime()
      const b = new Date(d.endAt).getTime()
      return !Number.isNaN(a) && !Number.isNaN(b) && b > a
    },
    {
      message: "End time must be after start time",
      path: ["endAt"],
    },
  )
  .superRefine((data, ctx) => {
    const tags = data.tagsInput
      ? data.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []
    try {
      parseEventCategoryPayload({
        category: data.category,
        subcategory: data.subcategory,
        tags,
        customCategoryLabel: data.customCategoryLabel,
        originalLanguage: data.originalLanguage,
      })
    } catch (e) {
      if (e instanceof z.ZodError) {
        for (const issue of e.issues) ctx.addIssue(issue)
      }
    }
  })

type EventFormValues = z.infer<typeof eventFormSchema>

export function EventForm({ initialData, draftId }: any = {}) {
  const router = useRouter()
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlaceWire | null>(null)

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
      category: "",
      subcategory: "",
      tagsInput: "",
      customCategoryLabel: "",
      originalLanguage: "",
      languages: ["en"],

      startAt: "",
      endAt: "",
      venueName: "",
      address: "",

      websiteUrl: "",
      imageUrls: [],

      creatorEmail: "",
    },
  })

  const formData = watch()
  const categoryValue = formData.category

  const onSubmit = async (values: EventFormValues) => {
    try {
      const placeId = selectedPlace?.placeId?.trim()
      if (
        !placeId ||
        !selectedPlace?.city?.trim() ||
        !selectedPlace?.country?.trim()
      ) {
        alert("Choose a location from the suggestions list and confirm it before publishing.")
        return
      }

      const tags = values.tagsInput
        ? values.tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : []

      const payload = {
        title: values.title,
        description: values.description,

        start: new Date(values.startAt).toISOString(),
        end: new Date(values.endAt).toISOString(),
        timezone: DateTime.local().zoneName,

        location: {
          name: values.venueName || "",
          address: values.address || "",
          city: selectedPlace.city,
          country: selectedPlace.country,
          state: selectedPlace.region ?? undefined,
          parentCity: selectedPlace.parentCity ?? null,
          lat: selectedPlace.lat ?? undefined,
          lng: selectedPlace.lng ?? undefined,
          formattedAddress: selectedPlace.formattedAddress,
          mapboxPlaceId: placeId,
        },

        externalUrl: values.websiteUrl || "",
        imageUrl: values.imageUrls?.[0] || "",

        category: values.category,
        subcategory: values.subcategory?.trim() || null,
        tags,
        customCategoryLabel: values.customCategoryLabel?.trim() || null,
        originalLanguage: values.originalLanguage?.trim() || null,

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

  const toggleLanguage = (lang: string) => {
    const current = formData.languages
    setValue(
      "languages",
      current.includes(lang)
        ? current.filter((l) => l !== lang)
        : [...current, lang],
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
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

          <div className="space-y-2">
            <Label>
              Event type <span className="text-destructive">*</span>
            </Label>
            <Select
              disabled={isSubmitting}
              value={categoryValue || undefined}
              onValueChange={(v) => setValue("category", v, { shouldValidate: true })}
            >
              <SelectTrigger className="w-full max-w-md" id="event-category">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CANONICAL_EVENT_CATEGORY_VALUES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {CATEGORY_UI_METADATA[key].defaultLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          {categoryValue === "OTHER" ? (
            <div className="space-y-2">
              <Label htmlFor="customCategoryLabel">
                Describe the event type <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customCategoryLabel"
                maxLength={40}
                disabled={isSubmitting}
                placeholder="Short label (max 40 characters)"
                {...register("customCategoryLabel")}
              />
              {errors.customCategoryLabel && (
                <p className="text-sm text-destructive">{errors.customCategoryLabel.message}</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <Input
              id="subcategory"
              disabled={isSubmitting}
              placeholder="Optional"
              {...register("subcategory")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagsInput">Tags</Label>
            <Input
              id="tagsInput"
              disabled={isSubmitting}
              placeholder="Optional, comma-separated"
              {...register("tagsInput")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="originalLanguage">Original language (optional)</Label>
            <select
              id="originalLanguage"
              className="border-input flex h-9 w-full max-w-md rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              disabled={isSubmitting}
              {...register("originalLanguage")}
            >
              <option value="">Not set</option>
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

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

          <PlaceAutocomplete
            disabled={isSubmitting}
            id="event-location-search"
            allowEditQueryWhileSelected
            onResolved={(place) => {
              setSelectedPlace(place)
              setValue("venueName", place.venueName?.trim() || "")
              setValue("address", place.formattedAddress)
            }}
            onClear={() => {
              setSelectedPlace(null)
              setValue("venueName", "")
              setValue("address", "")
            }}
          />

          {!selectedPlace?.placeId ? (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                Choose a location from the suggestions and confirm your selection before publishing.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="venueName">Venue name</Label>
            <Input
              id="venueName"
              placeholder="Shown on the event page"
              disabled={isSubmitting}
              {...register("venueName")}
            />
            <p className="text-xs text-muted-foreground">You can edit how the venue appears after selecting a place.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address (full line)</Label>
            <Input
              id="address"
              placeholder="Filled when you pick a location from the list"
              disabled={isSubmitting}
              {...register("address")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website</Label>
            <Input id="websiteUrl" {...register("websiteUrl")} />
          </div>

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
