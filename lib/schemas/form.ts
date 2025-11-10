import { z } from "zod"

export const FormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required").max(1000, "Description must be 1000 characters or less"),
  email: z.string().email("Invalid email address").optional(),
})

export type FormInput = z.infer<typeof FormSchema>
