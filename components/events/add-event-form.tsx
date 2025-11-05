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
import { Loader2, CheckCircle2, Sparkles } from "lucide-react"

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
  }
}

export function AddEventForm({ initialData }: AddEventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
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

      if (initialData.location) {
        // Try to parse location into city/country
        const parts = initialData.location.split(",").map((p) => p.trim())
        if (parts.length >= 2) {
          form.setValue("city", parts[0])
          form.setValue("country", parts[parts.length - 1])
        } else {
          form.setValue("city", initialData.location)
        }
      }

      if (initialData.date) {
        try {
          const date = new Date(initialData.date)
          const formatted = date.toISOString().slice(0, 16)
          form.setValue("startAt", formatted)
          // Set end time to 2 hours after start
          const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000)
          form.setValue("endAt", endDate.toISOString().slice(0, 16))
        } catch (e) {
          console.error("[v0] Failed to parse date:", e)
        }
      }
    }
  }, [initialData, form])

  const onSubmit = async (data: AddEventFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      console.log("[v0] Submitting event data:", data)

      const response = await fetch("/api/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Event submission failed:", errorData)

        // Show validation errors if available
        if (errorData.details && Array.isArray(errorData.details)) {
          const errorMessages = errorData.details.map((err: any) => err.message).join(", ")
          throw new Error(errorMessages)
        }

        throw new Error(errorData.error || "Failed to submit event")
      }

      const result = await response.json()
      console.log("[v0] Event submitted successfully:", result)

      setIsSuccess(true)
      form.reset()
    } catch (err: any) {
      console.error("[v0] Error in form submission:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="size-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Check your email to verify & finish</h2>
              <p className="text-muted-foreground text-pretty">
                We've sent a verification link to your email address. Click the link to publish your event.
              </p>
            </div>
            <Button onClick={() => setIsSuccess(false)} variant="outline" className="mt-4">
              Submit another event
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {isPrefilled && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              We've prefilled some fields based on your request. Please review and complete the remaining details.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Your Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Your Information</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} disabled={isSubmitting} />
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
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormDescription>We'll send a verification link to this email</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="humanCheck"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Human Check</FormLabel>
                    <FormDescription>Type the last word of this sentence: eventa connects communities</FormDescription>
                    <FormControl>
                      <Input placeholder="Type the last word..." {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Event Details */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Event Details</h3>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Athens Farmers Market" {...field} disabled={isSubmitting} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your event in detail..."
                        rows={5}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Include what makes your event special, what attendees can expect, and any important details
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Location</h3>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} disabled={isSubmitting} />
                    </FormControl>
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
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Athens" {...field} disabled={isSubmitting} />
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
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Greece" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Date & Time */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Date & Time</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={isSubmitting} />
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
                      <FormLabel>End Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormDescription>Events auto-hide after the end time.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Optional Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Optional Information</h3>

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>Link to an image for your event</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="externalUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>External URL (optional)</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://example.com" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormDescription>Link to your event website or registration page</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Submitting event...
            </>
          ) : (
            "Submit Event"
          )}
        </Button>
      </form>
    </Form>
  )
}
