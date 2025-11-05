"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

const editEventSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    locationAddress: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    country: z.string().min(1, "Country is required"),
    startAt: z.string().min(1, "Start date/time is required"),
    endAt: z.string().min(1, "End date/time is required"),
    imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    externalUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
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

type EditEventFormData = z.infer<typeof editEventSchema>

interface EditEventFormProps {
  event: {
    id: string
    title: string
    description: string
    locationAddress: string | null
    city: string | null
    country: string | null
    startAt: Date
    endAt: Date | null
    imageUrl: string | null
    externalUrl: string | null
  }
  token?: string
}

export function EditEventForm({ event, token }: EditEventFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditEventFormData>({
    resolver: zodResolver(editEventSchema),
    defaultValues: {
      title: event.title,
      description: event.description,
      locationAddress: event.locationAddress || "",
      city: event.city || "",
      country: event.country || "",
      startAt: new Date(event.startAt).toISOString().slice(0, 16),
      endAt: event.endAt ? new Date(event.endAt).toISOString().slice(0, 16) : "",
      imageUrl: event.imageUrl || "",
      externalUrl: event.externalUrl || "",
    },
  })

  const onSubmit = async (data: EditEventFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update event")
      }

      toast({
        title: "Changes saved",
        description: "Your event has been updated successfully.",
      })

      if (token) {
        router.push(`/events/${event.id}`)
      } else {
        router.push("/my/events")
      }
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" rows={4} {...register("description")} />
            {errors.description && <p className="text-sm text-red-600">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationAddress">Address *</Label>
            <Input id="locationAddress" {...register("locationAddress")} />
            {errors.locationAddress && <p className="text-sm text-red-600">{errors.locationAddress.message}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" {...register("city")} />
              {errors.city && <p className="text-sm text-red-600">{errors.city.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input id="country" {...register("country")} />
              {errors.country && <p className="text-sm text-red-600">{errors.country.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startAt">Start Date/Time *</Label>
              <Input id="startAt" type="datetime-local" {...register("startAt")} />
              {errors.startAt && <p className="text-sm text-red-600">{errors.startAt.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endAt">End Date/Time *</Label>
              <Input id="endAt" type="datetime-local" {...register("endAt")} />
              <p className="text-xs text-muted-foreground">Events auto-hide after the end time.</p>
              {errors.endAt && <p className="text-sm text-red-600">{errors.endAt.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input id="imageUrl" type="url" placeholder="https://..." {...register("imageUrl")} />
            {errors.imageUrl && <p className="text-sm text-red-600">{errors.imageUrl.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalUrl">External URL (optional)</Label>
            <Input id="externalUrl" type="url" placeholder="https://..." {...register("externalUrl")} />
            {errors.externalUrl && <p className="text-sm text-red-600">{errors.externalUrl.message}</p>}
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/my/events")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
