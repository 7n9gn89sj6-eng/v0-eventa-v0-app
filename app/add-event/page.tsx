"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { eventFormSchema } from "@/lib/schemas/event"
import { createEvent } from "./actions"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2, Mail } from "lucide-react"
import { z } from "zod"

const formSchemaWithEmail = eventFormSchema.extend({
  email: z.string().email("Please enter a valid email address"),
})

type FormDataWithEmail = z.infer<typeof formSchemaWithEmail>

export default function AddEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string>("")

  const form = useForm<FormDataWithEmail>({
    resolver: zodResolver(formSchemaWithEmail),
    defaultValues: {
      title: "",
      description: "",
      startAt: "",
      endAt: "",
      locationAddress: "",
      city: "",
      country: "",
      venueName: "",
      websiteUrl: "",
      externalUrl: "",
      imageUrl: "",
      priceFree: true,
      priceAmount: undefined,
      email: "",
    },
  })

  async function onSubmit(data: FormDataWithEmail) {
    console.log("[v0] Submitting event data:", data)
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    const { email, ...eventData } = data
    const result = await createEvent(eventData, email)

    console.log("[v0] Event submitted successfully:", result)

    if (result.error) {
      setSubmitError(result.error)
    } else {
      setSubmitSuccess(true)
      setSubmittedEmail(email)
      form.reset()
    }

    setIsSubmitting(false)
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-green-500">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Event Created Successfully!</CardTitle>
              <CardDescription>Check your email for the magic link to edit your event</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  We've sent an edit link to <strong>{submittedEmail}</strong>. Click the link in the email to edit your
                  event anytime within the next 30 days.
                </AlertDescription>
              </Alert>
              <div className="text-center pt-4">
                <Button onClick={() => setSubmitSuccess(false)} variant="outline">
                  Create Another Event
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Create Your Event</h1>
          <p className="text-muted-foreground">
            Fill out the form below and we'll send you a magic link to edit your event anytime
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>
              After submitting, you'll receive an email with a secure link to edit your event
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitError && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormDescription>We'll send your edit link to this email</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Creating Event..." : "Create Event & Send Magic Link"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
