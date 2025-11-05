import { SignInForm } from "@/components/auth/sign-in-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export const metadata = {
  title: "Sign In - Eventa",
  description: "Sign in to your Eventa account",
}

const isAuthConfigured = !!(
  process.env.EMAIL_SERVER_HOST &&
  process.env.EMAIL_SERVER_PORT &&
  process.env.EMAIL_SERVER_USER &&
  process.env.EMAIL_SERVER_PASSWORD &&
  process.env.EMAIL_FROM
)

export default async function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Sign In</h1>
          <p className="mt-2 text-muted-foreground">Enter your email to receive a sign-in link</p>
        </div>

        {!isAuthConfigured && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>Authentication is not configured. Please contact support.</AlertDescription>
          </Alert>
        )}

        <SignInForm />
      </div>
    </div>
  )
}
