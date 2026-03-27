"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlacesAutocomplete } from "@/components/forms/places-autocomplete"
import { EventPosterUpload } from "@/components/events/event-poster-upload"
import { EventListingPreview } from "@/components/events/event-listing-preview"
import {
  CANONICAL_EVENT_CATEGORY_VALUES,
  CATEGORY_UI_METADATA,
  parseEventCategoryPayload,
  coerceToCanonicalEventCategory,
  isCanonicalEventCategory,
} from "@/lib/categories/canonical-event-category"
import type { EventStatus } from "@prisma/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export type EditPageEventPayload = {
  id: string
  title: string
  description: string | null
  address: string | null
  locationAddress: string | null
  city: string
  state: string | null
  country: string
  postcode: string | null
  startAt: string
  endAt: string
  imageUrl: string | null
  imageUrls: string[]
  externalUrl: string | null
  category: string
  subcategory: string | null
  tags: string[]
  customCategoryLabel: string | null
  originalLanguage: string | null
  status: EventStatus
}

function defaultCategoryValue(raw: string): string {
  const c = coerceToCanonicalEventCategory(raw)
  if (c) return c
  return "COMMUNITY"
}

function defaultImageUrlFromEvent(ev: EditPageEventPayload): string {
  const primary = ev.imageUrl?.trim()
  if (primary) return primary
  const first = ev.imageUrls?.find((u) => u?.trim())
  return first?.trim() ?? ""
}

function streetLineFromEvent(ev: EditPageEventPayload): string {
  return (ev.address ?? ev.locationAddress ?? "").trim()
}

const editMagicLinkSchema = z
  .object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    description: z.string().min(1, "Description is required"),
    category: z.string().min(1, "Please choose an event type"),
    subcategory: z.string().optional(),
    tagsInput: z.string().optional(),
    customCategoryLabel: z.string().optional(),
    originalLanguage: z.string().optional(),
    address: z.string().min(5, "Address is required"),
    postcode: z.string().optional(),
    city: z.string().min(2, "City is required"),
    state: z.string().optional(),
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
    { message: "End must be after start.", path: ["endAt"] },
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
      } else if (e instanceof Error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e.message,
          path: ["category"],
        })
      }
    }
  })

type EditMagicLinkFormValues = z.infer<typeof editMagicLinkSchema>

interface Props {
  event: EditPageEventPayload
  token: string
}

export default function EditEventForm({ event, token }: Props) {
  const [saveError, setSaveError] = useState<string | null>(null)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const isWithdrawn = event.status === "ARCHIVED"
  const form = useForm<EditMagicLinkFormValues>({
    resolver: zodResolver(editMagicLinkSchema),
    defaultValues: {
      title: event.title,
      description: event.description ?? "",
      category: defaultCategoryValue(event.category),
      subcategory: event.subcategory ?? "",
      tagsInput: (event.tags ?? []).join(", "),
      customCategoryLabel: event.customCategoryLabel ?? "",
      originalLanguage: event.originalLanguage ?? "",
      address: streetLineFromEvent(event),
      postcode: event.postcode ?? "",
      city: event.city,
      state: event.state ?? "",
      country: event.country,
      startAt: new Date(event.startAt).toISOString().slice(0, 16),
      endAt: new Date(event.endAt).toISOString().slice(0, 16),
      imageUrl: defaultImageUrlFromEvent(event),
      externalUrl: event.externalUrl ?? "",
    },
  })

  const categoryWatch = form.watch("category")
  const watched = form.watch()
  const saving = form.formState.isSubmitting

  const previewLocationLine = (() => {
    const chunks: string[] = []
    const a = watched.address?.trim()
    if (a) chunks.push(a)
    const mid = [watched.city?.trim(), watched.state?.trim(), watched.postcode?.trim()]
      .filter(Boolean)
      .join(" ")
    if (mid) chunks.push(mid)
    const c = watched.country?.trim()
    if (c) chunks.push(c)
    return chunks.join(" · ")
  })()

  const previewCategoryLabel =
    watched.category === "OTHER" && watched.customCategoryLabel?.trim()
      ? watched.customCategoryLabel.trim()
      : isCanonicalEventCategory(watched.category)
        ? CATEGORY_UI_METADATA[watched.category].defaultLabel
        : undefined

  async function onSubmit(data: EditMagicLinkFormValues) {
    setSaveError(null)
    const tags = data.tagsInput
      ? data.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []

    const res = await fetch(`/api/events/${event.id}?token=${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        locationAddress: data.address,
        city: data.city,
        state: data.state || null,
        country: data.country,
        postcode: data.postcode || null,
        startAt: data.startAt,
        endAt: data.endAt,
        imageUrl: data.imageUrl || "",
        externalUrl: data.externalUrl || "",
        category: data.category,
        subcategory: data.subcategory?.trim() || null,
        tags,
        customCategoryLabel: data.customCategoryLabel?.trim() || null,
        originalLanguage: data.originalLanguage?.trim() || null,
      }),
    })

    if (!res.ok) {
      let msg = "Save failed"
      try {
        const j = (await res.json()) as { error?: string; issues?: z.ZodIssue[] }
        if (j.error) msg = j.error
        if (j.issues?.length) msg = j.issues.map((i) => i.message).join("; ")
      } catch {
        const text = await res.text()
        if (text) msg = text
      }
      setSaveError(msg)
      return
    }

    window.location.href = `/events/${event.id}`
  }

  async function withdrawListing() {
    setWithdrawError(null)
    setWithdrawing(true)
    try {
      const res = await fetch(`/api/events/${event.id}?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdraw: true }),
      })
      if (!res.ok) {
        let msg = "Something went wrong. Please try again."
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error) msg = j.error
        } catch {
          /* ignore */
        }
        setWithdrawError(msg)
        return
      }
      window.location.href = "/?listingRemoved=1"
    } catch {
      setWithdrawError("Something went wrong. Please try again.")
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {saveError ? (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}
        {isWithdrawn ? (
          <Alert>
            <AlertDescription>
              This listing is no longer shown in Eventa search or on the public event page. You can still edit
              details below if you want a copy for your records.
            </AlertDescription>
          </Alert>
        ) : null}
        {withdrawError ? (
          <Alert variant="destructive">
            <AlertDescription>{withdrawError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div className="order-2 min-w-0 flex-1 space-y-6 lg:order-1">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Event details</h2>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={saving} />
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
                      <Textarea rows={5} {...field} disabled={saving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event type</FormLabel>
                    <Select disabled={saving} onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CANONICAL_EVENT_CATEGORY_VALUES.map((key) => (
                          <SelectItem key={key} value={key}>
                            {CATEGORY_UI_METADATA[key].defaultLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {categoryWatch === "OTHER" ? (
                <FormField
                  control={form.control}
                  name="customCategoryLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Describe the event type</FormLabel>
                      <FormControl>
                        <Input maxLength={40} placeholder="Short label" {...field} disabled={saving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} disabled={saving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tagsInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional, comma-separated" {...field} disabled={saving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="originalLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original language (optional)</FormLabel>
                    <FormControl>
                      <select
                        className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                        disabled={saving}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      >
                        <option value="">Not set</option>
                        <option value="en">English</option>
                        <option value="it">Italiano</option>
                        <option value="el">Ελληνικά</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 border-t pt-6">
              <h2 className="text-lg font-semibold">Location</h2>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <PlacesAutocomplete
                        value={field.value}
                        onChange={field.onChange}
                        onPlaceSelect={(place) => {
                          if (place.city || place.suburb) {
                            form.setValue("city", place.city || place.suburb || "", { shouldValidate: true })
                          }
                          if (place.state) form.setValue("state", place.state, { shouldValidate: true })
                          if (place.country) form.setValue("country", place.country, { shouldValidate: true })
                          if (place.postcode) form.setValue("postcode", place.postcode, { shouldValidate: true })
                        }}
                        placeholder="Enter an address"
                        disabled={saving}
                      />
                    </FormControl>
                    <FormDescription>Start typing and pick a suggestion to fill city and country.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode / ZIP</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={saving} />
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
                        <Input {...field} disabled={saving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State / Province</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={saving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={saving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 border-t pt-6">
              <h2 className="text-lg font-semibold">Date &amp; time</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={saving} />
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
                      <FormLabel>End</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled={saving} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h2 className="text-lg font-semibold">Links &amp; image</h2>

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <EventPosterUpload
                        imageUrl={field.value ?? ""}
                        onImageUrlChange={(url) => {
                          field.onChange(url)
                          form.clearErrors("imageUrl")
                        }}
                        disabled={saving}
                        urlInputId="edit-event-poster-url"
                      />
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
                    <FormLabel>External link (website or tickets)</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://…" {...field} disabled={saving} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

            {!isWithdrawn ? (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-medium">Listing on Eventa</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Finished or need to take a break? Remove your listing from search and the public page. Your event
                    details stay saved — nothing is permanently deleted.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={saving || withdrawing} className="w-full sm:w-auto">
                      Remove listing
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this listing?</AlertDialogTitle>
                      <AlertDialogDescription>
                        It will disappear from Eventa search and the public event page. You can keep this page open if
                        you still want to copy anything first.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={withdrawing}>Cancel</AlertDialogCancel>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={withdrawing}
                        onClick={() => void withdrawListing()}
                      >
                        {withdrawing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            Removing…
                          </>
                        ) : (
                          "Remove listing"
                        )}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}

            <Button type="submit" disabled={saving} className="w-full sm:w-auto" size="lg">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>

          <div className="order-1 w-full lg:order-2 lg:sticky lg:top-24 lg:max-w-sm xl:max-w-md lg:shrink-0">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Listing preview</p>
            <p className="mb-3 text-xs text-muted-foreground">
              This updates as you type so you can see roughly how your event will read on Eventa.
            </p>
            <EventListingPreview
              title={watched.title}
              description={watched.description}
              imageUrl={watched.imageUrl}
              startAt={watched.startAt}
              endAt={watched.endAt}
              locationLine={previewLocationLine}
              categoryLabel={previewCategoryLabel}
              externalUrl={watched.externalUrl}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
