"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus } from "lucide-react"
import { DateTime } from "luxon"
import { useI18n } from "@/lib/i18n/context"
import { CATEGORIES, LANGUAGES } from "@/types/event"
import { z } from "zod"

// --------------------------------------------------------------
// NEW SCHEMA: Matches the backend /api/events/submit route EXACTLY
// --------------------------------------------------------------

const fixedEventFormSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  venueName: z.string().optional(),
  address: z.string().optional(),
  websiteUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  languages: z.array(z.string()).optional(),
  creatorEmail: z.string().email({ message: "Valid email required" }),
})

// Final Type
type FixedEventFormValues = z.infer<typeof fixedEventFormSchema>

// --------------------------------------------------------------
// COMPONENT
// --------------------------------------------------------------
export function EventForm() {
  const router = useRouter()
  const { t } = useI18n()
  const tForm = t("form")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FixedEventFormValues>({
    resolver: zodResolver(fixedEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      categories: [],
      startAt: new Date(),
      endAt: new Date(),
      venueName: "",
      address: "",
      websiteUrl: "",
      imageUrl: "",
      languages: [],
      creatorEmail: "",
    },
  })

  const formData = watch()

  // --------------------------------------------------------------
  // SUBMIT HANDLER — Posts to /api/events/submit (corrected)
  // --------------------------------------------------------------
  const onSubmit = async (values: FixedEventFormValues) => {
    try {
      const payload = {
        title: values.title,
        description: values.description,
        start: values.startAt,
        end: values.endAt,
        creatorEmail: values.creatorEmail,
        timezone: DateTime.local().zoneName,
        location: {
          name: values.venueName || null,
          address: values.address || null,
        },
        imageUrl: values.imageUrl || null,
        externalUrl: values.websiteUrl || null,
        categories: values.categories,
      }

      const response = await fetch("/api/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create event")

      // Redirect to success page
      router.push(`/event/confirm-success?event=${data.eventId}`)
    } catch (err) {
      console.error("Form submission error:", err)
      alert("Error submitting event: " + (err as any).message)
    }
  }

  // Category toggle
  const toggleCategory = (cat: string) => {
    const current = formData.categories || []
    setValue(
      "categories",
      current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat],
    )
  }

  const toggleLanguage = (lang: string) => {
    const current = formData.languages || []
    setValue(
      "languages",
      current.includes(lang)
        ? current.filter((l) => l !== lang)
        : [...current, lang],
    )
  }

  // --------------------------------------------------------------
  // RENDER FORM
  // --------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">

          {/* TITLE */}
          <div className="space-y-2">
            <Label>Event Title *</Label>
            <Input {...register("title")} disabled={isSubmitting} />
            {errors.title && <p className="text-red-500">{errors.title.message}</p>}
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea rows={5} {...register("description")} disabled={isSubmitting} />
            {errors.description && <p className="text-red-500">{errors.description.message}</p>}
          </div>

          {/* CREATOR EMAIL */}
          <div className="space-y-2">
            <Label>Your Email *</Label>
            <Input type="email" {...register("creatorEmail")} disabled={isSubmitting} />
            {errors.creatorEmail && <p className="text-red-500">{errors.creatorEmail.message}</p>}
          </div>

          {/* CATEGORIES */}
          <div className="space-y-3">
            <Label>Categories *</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    formData.categories?.includes(cat)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {errors.categories && <p className="text-red-500">{errors.categories.message}</p>}
          </div>

          {/* DATE/TIME */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Start *</Label>
              <Input type="datetime-local" {...register("startAt")} disabled={isSubmitting} />
              {errors.startAt && <p className="text-red-500">{errors.startAt.message}</p>}
            </div>
            <div>
              <Label>End *</Label>
              <Input type="datetime-local" {...register("endAt")} disabled={isSubmitting} />
              {errors.endAt && <p className="text-red-500">{errors.endAt.message}</p>}
            </div>
          </div>

          {/* VENUE */}
          <div className="space-y-2">
            <Label>Venue Name</Label>
            <Input {...register("venueName")} disabled={isSubmitting} />
          </div>

          {/* ADDRESS */}
          <div className="space-y-2">
            <Label>Address</Label>
            <Input {...register("address")} disabled={isSubmitting} />
          </div>

          {/* WEBSITE */}
          <div className="space-y-2">
            <Label>External Website</Label>
            <Input {...register("websiteUrl")} disabled={isSubmitting} />
          </div>

          {/* IMAGE URL */}
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input {...register("imageUrl")} disabled={isSubmitting} />
          </div>

          {/* LANGUAGES */}
          <div className="space-y-3">
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    formData.languages?.includes(lang.code)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* SUBMIT BUTTON */}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Publishing event...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Publish Event
          </>
        )}
      </Button>
    </form>
  )
}
