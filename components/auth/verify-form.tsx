"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

const verifySchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers"),
})

type VerifyFormData = z.infer<typeof verifySchema>

export function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      email: searchParams.get("email") || "",
      code: searchParams.get("code") || "",
    },
  })

  const onSubmit = async (data: VerifyFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Verification failed")
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/my/events")
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <AlertDescription className="text-green-800">
          Email verified successfully! Redirecting to your dashboard...
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" type="email" placeholder="your@email.com" {...register("email")} disabled={isSubmitting} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Verification Code</Label>
        <Input
          id="code"
          type="text"
          placeholder="123456"
          maxLength={6}
          {...register("code")}
          disabled={isSubmitting}
          className="text-center text-2xl tracking-widest"
        />
        {errors.code && <p className="text-sm text-red-600">{errors.code.message}</p>}
        <p className="text-sm text-muted-foreground">Enter the 6-digit code from your email</p>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Verifying..." : "Verify Email"}
      </Button>
    </form>
  )
}
