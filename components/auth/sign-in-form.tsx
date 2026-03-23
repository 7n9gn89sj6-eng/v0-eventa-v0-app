"use client"

import type React from "react"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Loader2, AlertCircle, Shield } from "lucide-react"

type SignInFormProps = {
  emailMagicLinkReady?: boolean
  showAdminLogin?: boolean
}

export function SignInForm({
  emailMagicLinkReady = true,
  showAdminLogin = false,
}: SignInFormProps) {
  const [email, setEmail] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAdminLoading, setIsAdminLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)

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

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsAdminLoading(true)
    setAdminError(null)

    try {
      const result = await signIn("credentials", {
        email: adminEmail,
        password: adminPassword,
        redirect: false,
        callbackUrl: "/add-event",
      })

      if (result?.error) {
        setAdminError("Invalid email or password.")
      } else if (result?.ok && result.url) {
        window.location.href = result.url
      } else {
        setAdminError("Sign in failed. Please try again.")
      }
    } catch (err) {
      console.error("[v0] Admin sign in error:", err)
      setAdminError("An unexpected error occurred. Please try again.")
    } finally {
      setIsAdminLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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
                required={emailMagicLinkReady}
                disabled={isLoading || !emailMagicLinkReady}
                autoComplete="email"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!emailMagicLinkReady && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Magic link sign-in is not configured (email server environment variables are missing).
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || !emailMagicLinkReady}>
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

      {showAdminLogin && (
        <Card>
          <CardHeader>
            <CardTitle>Admin sign-in</CardTitle>
            <CardDescription>Email and password from your deployment environment (no magic link).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  disabled={isAdminLoading}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  disabled={isAdminLoading}
                  autoComplete="current-password"
                />
              </div>

              {adminError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{adminError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" variant="secondary" className="w-full" disabled={isAdminLoading}>
                {isAdminLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Sign in as admin
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
