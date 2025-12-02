"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Loader2, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from "@/lib/i18n/context"
import type { EventSubmitResponse } from "@/lib/types"

const API_URL = "/api/events/submit"

const addEventSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    humanCheck: z
      .string()
      .toLowerCase()
      .refine((val) => val === "communities", {
        message: "Please type the correct word from the challenge",
      }),
    title: z.string().min(5, "Event title must be at least 5 characters"),
    description: z.string().min(20, "Description must be at least 20 characters"),
    address: z.string().min(5, "Address is required"),
    postcode: z.string().optional(),
    city: z.string().min(2, "City is required"),
    country: z.string().min(2, "Country is required"),
    startAt: z.string().min(1, "Start date and time is required"),
    endAt: z.string().min(1, "End date and time is required"),
    imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    externalUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt) > new Date(data.startAt)
      }
      return true
    },
    {
      message: "End must be after start.",
      path: ["endAt"],
    },
  )

type AddEventFormData = z.infer<typeof addEventSchema>

interface AddEventFormProps {
  initialData?: {
    title?: string
    description?: string
    location?: string
    date?: string
    city?: string
    venue?: string
    startAt?: string
    endAt?: string
    postcode?: string
  }
}

export function AddEventForm({ initialData }: AddEventFormProps) {
  const router = useRouter()
  const { t } = useI18n()
  const tForm = t("form")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<EventSubmitResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPrefilled, setIsPrefilled] = useState(false)

  const form = useForm<AddEventFormData>({
    resolver: zodResolver(addEventSchema),
    defaultValues: {
      name: "",
      email: "",
      humanCheck: "",
      title: "",
      description: "",
      address: "",
      postcode: "",
      city: "",
      country: "",
      startAt: "",
      endAt: "",
      imageUrl: "",
      externalUrl: "",
    },
  })

  useEffect(() => {
    if (initialData && (initialData.title || initialData.description || initialData.location || initialData.date)) {
      setIsPrefilled(true)

      if (initialData.title) {
        form.setValue("title", initialData.title)
      }

      if (initialData.description) {
        form.setValue("description", initialData.description)
      }

      if (initialData.venue) {
        form.setValue("address", initialData.venue)
      }

      if (initialData.location || initialData.city) {
        const city = initialData.city || initialData.location
        if (city) {
          const parts = city.split(",").map((p) => p.trim())
          if (parts.length >= 2) {
            form.setValue("city", parts[0])
            form.setValue("country", parts[parts.length - 1])
          } else {
            form.setValue("city", city)
          }
        }
      }

      if (initialData.startAt) {
        form.setValue("startAt", initialData.startAt)
      } else if (initialData.date) {
        try {
          const date = new Date(initialData.date)
          const formatted = date.toISOString().slice(0, 16)
          form.setValue("startAt", formatted)
        } catch (e) {
        }
      }

      if (initialData.endAt) {
        form.setValue("endAt", initialData.endAt)
      } else if (initialData.startAt || initialData.date) {
        try {
          const startDate = new Date(initialData.startAt || initialData.date)
          const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)
          form.setValue("endAt", endDate.toISOString().slice(0, 16))
        } catch (e) {
        }
      }

      if (initialData.postcode) {
        form.setValue("postcode", initialData.postcode)
      }
    }
  }, [initialData, form])

  const onSubmit = async (data: AddEventFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSubmitResult(null)

    try {
      console.log("[v0] Starting form submission...")

      const submitPayload = {
        title: data.title,
        description: data.description,
        start: new Date(data.startAt).toISOString(),
        end: new Date(data.endAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: {
          address: `${data.address}, ${data.city}, ${data.country}`,
          name: data.address,
        },
        imageUrl: data.imageUrl || "",
        externalUrl: data.externalUrl || "",
        organizer_name: data.name,
        organizer_contact: data.email,
        creatorEmail: data.email,
      }

      console.log("[v0] Sending POST request to:", API_URL)

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submitPayload),
      })

      console.log("[v0] Response status:", response.status)

      const contentType = response.headers.get("content-type")
      const text = await response.text()

      let json: EventSubmitResponse | null = null
      if (contentType?.includes("application/json")) {
        try {
          json = JSON.parse(text)
        } catch (parseError) {
          console.error("[v0] Failed to parse response as JSON:", parseError)
          if (!response.ok) {
            throw new Error(text || `Server error (${response.status})`)
          }
        }
      } else {
        if (!response.ok) {
          throw new Error(text || `Server error (${response.status})`)
        }
      }

      if (!response.ok) {
        const requestId = response.headers.get("x-request-id")
        let errorMessage = "An error occurred while submitting your event"
        
        if (json && 'error' in json) {
          errorMessage = json.error as string
        } else if (json && 'details' in json) {
          errorMessage = json.details as string
        } else if (text) {
          errorMessage = text
        }

        if (requestId) {
          errorMessage += ` (Request ID: ${requestId})`
        }

        console.error("[v0] Request failed with error:", errorMessage)
        throw new Error(errorMessage)
      }

      console.log("[v0] Form submission successful!")
      
      if (json) {
        setSubmitResult(json)
      }
      
      form.reset()

      if (typeof window !== "undefined" && initialData) {
        const urlParams = new URLSearchParams(window.location.search)
        const draftId = urlParams.get("draft")
        if (draftId) {
          const saved = localStorage.getItem("eventa-drafts")
          if (saved) {
            const drafts = JSON.parse(saved)
            const filtered = drafts.filter((d: any) => d.id !== draftId)
            localStorage.setItem("eventa-drafts", JSON.stringify(filtered))
          }
        }
      }
    } catch (err: any) {
      console.error("[v0] Error in form submission:", err)

      let errorMessage = err.message || "An unexpected error occurred"
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        errorMessage = "Network error. Please check your internet connection and try again."
      } else if (errorMessage.includes("Environment validation failed") || errorMessage.includes("Server configuration")) {
        errorMessage = "The server is not properly configured. Please contact support."
      } else if (errorMessage.includes("timeout")) {
        errorMessage = "Request timed out. Please try again."
      }
      
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onInvalid = (errors: any) => {
    console.error("[v0] Form validation errors:", errors)
    const firstError = Object.values(errors)[0] as any
    if (firstError?.message) {
      setError(`Please fix the following: ${firstError.message}`)
    }
  }

  if (submitResult) {
    const hasEmailWarning = submitResult.emailWarning && !submitResult.emailSent
    
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="size-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{tForm("success.title")}</h2>
              <p className="text-muted-foreground text-pretty">
                {submitResult.emailSent 
                  ? "Your event has been submitted successfully! Check your email for a link to edit your event details."
                  : tForm("success.message")}
              </p>
            </div>
            
            {hasEmailWarning && (
              <Alert className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-left text-sm">
                  {submitResult.emailWarning}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-3 mt-4">
              <Button onClick={() => router.push("/")} variant="outline">
                {tForm("buttons.backToHome")}
              </Button>
              <Button onClick={() => setSubmitResult(null)}>
                {tForm("buttons.submitAnother")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        {isPrefilled && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              {tForm("alerts.prefilled")}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Your Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{tForm("sections.yourInfo")}</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tForm("fields.namePlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={tForm("fields.emailPlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>{tForm("fields.emailHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="humanCheck"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.humanCheck")}</FormLabel>
                    <FormDescription>{tForm("fields.humanCheckHint")}</FormDescription>
                    <FormControl>
                      <Input
                        placeholder={tForm("fields.humanCheckPlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Event Details */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">{tForm("sections.eventDetails")}</h3>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.title")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tForm("fields.titlePlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={tForm("fields.descriptionPlaceholder")}
                        rows={5}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      {tForm("fields.descriptionHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">{tForm("sections.location")}</h3>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.address")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tForm("fields.addressPlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.postcode")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tForm("fields.postcodePlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>{tForm("fields.postcodeOptional")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tForm("fields.city")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tForm("fields.cityPlaceholder")}
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tForm("fields.country")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tForm("fields.countryPlaceholder")}
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Date & Time */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">{tForm("sections.dateTime")}</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tForm("fields.startAt")}</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tForm("fields.endAt")}</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>{tForm("fields.endAtHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Optional Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">{tForm("sections.optional")}</h3>

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.imageUrl")}</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder={tForm("fields.imageUrlPlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>{tForm("fields.imageUrlHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="externalUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tForm("fields.externalUrl")}</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder={tForm("fields.externalUrlPlaceholder")}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>{tForm("fields.externalUrlHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {tForm("buttons.submitting")}
            </>
          ) : (
            tForm("buttons.submit")
          )}
        </Button>
      </form>
    </Form>
  )
}
