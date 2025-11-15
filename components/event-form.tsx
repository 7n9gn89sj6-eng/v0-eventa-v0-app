"use client"

import { useEffect } from "react"
import { useRouter } from 'next/navigation'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus } from 'lucide-react'
import { DateTime } from "luxon"
import { useI18n } from "@/lib/i18n/context"


export function EventForm({ initialData, draftId }: EventFormProps = {}) {
  const router = useRouter()
  const { t } = useI18n()
  const tForm = t("form")

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
        throw new Error(data.error || tForm("errors.createFailed"))
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
              {tForm("fields.title")} <span className="text-destructive">{tForm("fields.required")}</span>
            </Label>
            <Input
              id="title"
              {...register("title")}
              placeholder={tForm("fields.titlePlaceholder")}
              disabled={isSubmitting}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {tForm("fields.description")} <span className="text-destructive">{tForm("fields.required")}</span>
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder={tForm("fields.descriptionPlaceholder")}
              rows={5}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {tForm("fields.descriptionHint")}
            </p>
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <Label>{tForm("fields.categories")}</Label>
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
                {tForm("fields.startAt")} <span className="text-destructive">{tForm("fields.required")}</span>
              </Label>
              <Input id="startAt" type="datetime-local" {...register("startAt")} disabled={isSubmitting} />
              {errors.startAt && <p className="text-sm text-destructive">{errors.startAt.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">
                {tForm("fields.endAt")} <span className="text-destructive">{tForm("fields.required")}</span>
              </Label>
              <Input id="endAt" type="datetime-local" {...register("endAt")} disabled={isSubmitting} />
              <p className="text-xs text-muted-foreground">{tForm("fields.endAtHint")}</p>
              {errors.endAt && <p className="text-sm text-destructive">{errors.endAt.message}</p>}
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label htmlFor="venueName">{tForm("fields.venueName")}</Label>
            <Input id="venueName" {...register("venueName")} placeholder={tForm("fields.venueNamePlaceholder")} disabled={isSubmitting} />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">{tForm("fields.address")}</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder={tForm("fields.addressPlaceholder")}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              {tForm("fields.addressGuidance")}
            </p>
          </div>

          {/* Price */}
          <div className="space-y-3">
            <Label>{tForm("fields.price")}</Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="priceFree" {...register("priceFree")} disabled={isSubmitting} />
              <Label htmlFor="priceFree" className="font-normal cursor-pointer">
                {tForm("fields.priceFree")}
              </Label>
            </div>
            {!formData.priceFree && (
              <div className="space-y-2">
                <Label htmlFor="priceAmount">{tForm("fields.priceAmount")}</Label>
                <Input
                  id="priceAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("priceAmount")}
                  placeholder={tForm("fields.priceAmountPlaceholder")}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">{tForm("fields.websiteUrl")}</Label>
            <Input
              id="websiteUrl"
              type="url"
              {...register("websiteUrl")}
              placeholder={tForm("fields.websiteUrlPlaceholder")}
              disabled={isSubmitting}
            />
          </div>

          {/* Languages */}
          <div className="space-y-3">
            <Label>{tForm("fields.languages")}</Label>
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
              {tForm("buttons.creatingEvent")}
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              {tForm("buttons.publishEvent")}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          {tForm("buttons.cancel")}
        </Button>
      </div>
    </form>
  )
}
