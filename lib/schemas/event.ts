import { z } from "zod"

export const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required"),
  startAt: z.string().min(1, "Start date is required"),
  endAt: z.string().optional(),
  locationAddress: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  venueName: z.string().optional(),
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  externalUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  priceFree: z.boolean().default(true),
  priceAmount: z.number().optional(),
})

export type EventFormData = z.infer<typeof eventFormSchema>
