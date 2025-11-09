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

const eventFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    categories: z.array(z.string()),
    startAt: z.coerce.date({
      required_error: "Start date and time is required",
      invalid_type_error: "Invalid start date/time",
    }),
    endAt: z.coerce.date({
      required_error: "End date and time is required",
      invalid_type_error: "Invalid end date/time",
    }),
    timezone: z.string(),
    venueName: z.string(),
    address: z.string(),
    priceFree: z.boolean(),
    priceAmount: z.string(),
    websiteUrl: z.string(),
    languages: z.array(z.string()),
    imageUrls: z.array(z.string()),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "End date/time must be after start date/time",
    path: ["endAt"],
  })

type EventFormValues = z.infer<typeof eventFormSchema>

interface EventFormProps {
  initialData?: {
    title?: string
    description?: string
    location?: string
    date?: string
  }
  draftId?: string
}

export function EventForm({ initialData, draftId }: EventFormProps = {}) {
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
      // @ts-expect-error allow empty; RHF will pass "" and Zod will error until user picks a date
      startAt: "",
      // @ts-expect-error allow empty
      endAt: "",
      timezone: DateTime.local().zoneName,
      venueName: "",
      address: "",
      priceFree: true,
      priceAmount: "",
      websiteUrl: "",
      languages: ["en"],
      imageUrls: [],
    },
  })

  const formData = watch()

  useEffect(() => {
    if (draftId && typeof window !== "undefined") {
      const saved = localStorage.getItem("eventa-drafts")
      if (saved) {
        const drafts = JSON.parse(saved)
        const draft = drafts.find((d: any) => d.id === draftId)
        if (draft) {
          const startDateTime = `${draft.date}T${draft.time || "12:00"}`
          const endDate = new Date(new Date(startDateTime).getTime() + 2 * 60 * 60 * 1000)

          setValue("title", draft.title || "")
          setValue("description", draft.description || "")
          setValue("categories", draft.category ? [draft.category.toLowerCase()] : [])
          setValue("startAt", startDateTime as any)
          setValue("endAt", endDate.toISOString().slice(0, 16) as any)
          setValue("venueName", draft.venue || "")
          setValue("address", draft.city || "")
        }
      }
    } else if (initialData) {
      if (initialData.title) setValue("title", initialData.title)
      if (initialData.description) setValue("description", initialData.description)
      if (initialData.location) setValue("address", initialData.location)
      if (initialData.date) setValue("startAt", initialData.date as any)
    }
  }, [draftId, initialData, setValue])

  const onSubmit = async (values: EventFormValues) => {
    try {
      // Convert Dates to ISO strings before sending to API
      const payload = {
        ...values,
        startAt: values.startAt.toISOString(),
        endAt: values.endAt.toISOString(),
        priceAmount: values.priceFree ? null : Number.parseInt(values.priceAmount) * 100,
      }

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create event")
      }

      const { event } = await response.json()

      if (draftId && typeof window !== "undefined") {
        const saved = localStorage.getItem("eventa-drafts")
        if (saved) {
          const drafts = JSON.parse(saved)
          const updatedDrafts = drafts.filter((d: any) => d.id !== draftId)
          localStorage.setItem("eventa-drafts", JSON.stringify(updatedDrafts))
        }
      }

      router.push(`/events/${event.id}?created=true`)
    } catch (err: any) {
      throw err
    }
  }

  const toggleCategory = (category: string) => {
    const current = formData.categories
    setValue("categories", current.includes(category) ? current.filter((c) => c !== category) : [...current, category])
  }

  const toggleLanguage = (lang: string) => {
    const current = formData.languages
    setValue("languages", current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang])
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Event Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="e.g., Athens Farmers Market"
              disabled={isSubmitting}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Describe your event in detail..."
              rows={5}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Include what makes your event special, what attendees can expect, and any important details.
            </p>
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
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
                  disabled={isSubmitting}
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
              <Input id="startAt" type="datetime-local" {...register("startAt")} disabled={isSubmitting} />
              {errors.startAt && <p className="text-sm text-destructive">{errors.startAt.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">
                End Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input id="endAt" type="datetime-local" {...register("endAt")} disabled={isSubmitting} />
              <p className="text-xs text-muted-foreground">Events auto-hide after the end time.</p>
              {errors.endAt && <p className="text-sm text-destructive">{errors.endAt.message}</p>}
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="venueName">Venue Name</Label>
            <Input id="venueName" {...register("venueName")} placeholder="e.g., Central Park" disabled={isSubmitting} />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="e.g., 123 Main St, Athens, Greece"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              We'll automatically geocode this address for map display and distance calculations.
            </p>
          </div>

          {/* Price */}
          <div className="space-y-3">
            <Label>Price</Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="priceFree" {...register("priceFree")} disabled={isSubmitting} />
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
                  {...register("priceAmount")}
                  placeholder="10.00"
                  disabled={isSubmitting}
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
              {...register("websiteUrl")}
              placeholder="https://example.com"
              disabled={isSubmitting}
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
                  disabled={isSubmitting}
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

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? (
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
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
