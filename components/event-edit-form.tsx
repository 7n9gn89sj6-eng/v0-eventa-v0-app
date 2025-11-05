"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { eventFormSchema, type EventFormData } from "@/lib/schemas/event"
import { updateEvent } from "@/app/edit/[eventId]/actions"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2 } from "lucide-react"

interface EventEditFormProps {
  eventId: string
  token: string
  initialData: any
}

export function EventEditForm({ eventId, token, initialData }: EventEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: initialData.title || "",
      description: initialData.description || "",
      startAt: initialData.startAt ? new Date(initialData.startAt).toISOString().slice(0, 16) : "",
      endAt: initialData.endAt ? new Date(initialData.endAt).toISOString().slice(0, 16) : "",
      locationAddress: initialData.locationAddress || "",
      city: initialData.city || "",
      country: initialData.country || "",
      venueName: initialData.venueName || "",
      websiteUrl: initialData.websiteUrl || "",
      externalUrl: initialData.externalUrl || "",
      imageUrl: initialData.imageUrl || "",
      priceFree: initialData.priceFree ?? true,
      priceAmount: initialData.priceAmount || undefined,
    },
  })

  async function onSubmit(data: EventFormData) {
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    const result = await updateEvent(eventId, token, data)

    if (result.error) {
      setSubmitError(result.error)
    } else {
      setSubmitSuccess(true)
    }

    setIsSubmitting(false)
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Your Event</CardTitle>
        <CardDescription>Update your event details below. Changes will be saved immediately.</CardDescription>
      </CardHeader>
      <CardContent>
        {submitSuccess && (
          <Alert className="mb-6 border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">Event updated successfully!</AlertDescription>
          </Alert>
        )}

        {submitError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event title" {...field} />
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
                    <Textarea placeholder="Describe your event" className="min-h-32" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date & Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
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
                    <FormLabel>End Date & Time (Optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="venueName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter venue name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter city" {...field} />
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
                    <FormLabel>Country (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="websiteUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website URL (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="externalUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External Event URL (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://example.com/event" {...field} />
                  </FormControl>
                  <FormDescription>Link to tickets or more information</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://example.com/image.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="priceFree"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Free Event</FormLabel>
                      <FormDescription>Check if this event is free to attend</FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {!form.watch("priceFree") && (
                <FormField
                  control={form.control}
                  name="priceAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (in cents)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000"
                          {...field}
                          onChange={(e) => field.onChange(Number.parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Enter price in cents (e.g., 1000 = $10.00)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
