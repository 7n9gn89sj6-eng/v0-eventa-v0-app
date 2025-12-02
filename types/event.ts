import { z } from "zod"

export const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().min(1, "Description is required").max(5000, "Description must be 5000 characters or less"),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  startAt: z.coerce.date({ required_error: "Start date is required" }),
  endAt: z.coerce.date({ required_error: "End date is required" }),
  timezone: z.string().min(1, "Timezone is required"),
  venueName: z.string().default(""),
  address: z.string().default(""),
  priceFree: z.boolean().default(false),
  priceAmount: z.string().default(""),
  websiteUrl: z
    .string()
    .default("")
    .refine((val) => !val || val === "" || z.string().url().safeParse(val).success, {
      message: "Invalid URL format",
    }),
  languages: z.array(z.string()).default([]),
  imageUrls: z.array(z.string()).default([]),
})

// Infer TypeScript type from schema
export type EventFormValues = z.infer<typeof eventFormSchema>

// Event categories
export const CATEGORIES = [
  "Music",
  "Arts",
  "Sports",
  "Food & Drink",
  "Community",
  "Business",
  "Health & Wellness",
  "Technology",
  "Education",
  "Entertainment",
  "Charity",
  "Other",
]

// Supported languages with codes and labels
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
]
