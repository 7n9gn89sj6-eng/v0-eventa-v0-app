import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Check Your Email - Eventa",
  description: "Check your email for the magic link",
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const params = await searchParams
  const email = params.email

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            {email ? (
              <>
                We sent a magic link to <strong>{email}</strong>
              </>
            ) : (
              "We sent you a magic link"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>Click the link in the email to sign in to your account.</p>
          <p>If you don't see the email, check your spam folder.</p>
        </CardContent>
      </Card>
    </div>
  )
}
