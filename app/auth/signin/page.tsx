import { SignInForm } from "@/components/auth/sign-in-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { getTranslations } from "@/lib/i18n/server"
import { adminCredentialsConfigured } from "@/lib/admin-credentials-config"

export async function generateMetadata() {
  const t = await getTranslations("metadata")
  return {
    title: t("signInTitle"),
    description: t("signInDescription"),
  }
}

const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"

const emailMagicLinkReady =
  AUTH_ENABLED &&
  !!(
    process.env.EMAIL_SERVER_HOST &&
    process.env.EMAIL_SERVER_PORT &&
    process.env.EMAIL_SERVER_USER &&
    process.env.EMAIL_SERVER_PASSWORD &&
    process.env.EMAIL_FROM
  )

const noSignInMethod = AUTH_ENABLED && !emailMagicLinkReady && !adminCredentialsConfigured

export default async function SignInPage() {
  const t = await getTranslations("auth")

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{t("signInTitle")}</h1>
          <p className="mt-2 text-muted-foreground">{t("signInSubtitle")}</p>
        </div>

        {noSignInMethod && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("authError")}</AlertTitle>
            <AlertDescription>{t("authNotConfigured")}</AlertDescription>
          </Alert>
        )}

        {AUTH_ENABLED && !emailMagicLinkReady && adminCredentialsConfigured && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Magic link unavailable</AlertTitle>
            <AlertDescription>
              Email sign-in is not configured. You can still sign in with the admin account below.
            </AlertDescription>
          </Alert>
        )}

        <SignInForm
          emailMagicLinkReady={emailMagicLinkReady}
          showAdminLogin={adminCredentialsConfigured}
        />
      </div>
    </div>
  )
}
