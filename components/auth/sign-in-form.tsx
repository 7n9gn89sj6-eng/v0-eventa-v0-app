"use client"

import type React from "react"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Loader2, AlertCircle } from "lucide-react"

export function SignInForm() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/add-event", // Updated callbackUrl to /add-event
      })

      if (result?.error) {
        if (result.error.includes("Configuration")) {
          setError("Authentication is not configured yet. Please contact the administrator to set up email service.")
        } else {
          setError("Failed to send magic link. Please try again.")
        }
      } else {
        // Redirect to verify page
        window.location.href = "/auth/verify?email=" + encodeURIComponent(email)
      }
    } catch (err: any) {
      if (err?.message?.includes("503") || err?.message?.includes("not configured")) {
        setError(
          "Authentication is not configured yet. The administrator needs to set up email service environment variables.",
        )
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
      console.error("[v0] Sign in error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in with email</CardTitle>
        <CardDescription>We'll send you a magic link to sign in without a password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending magic link...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send magic link
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>No password needed. Just click the link in your email.</p>
        </div>
      </CardContent>
    </Card>
  )
}
