import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import bcrypt from "bcryptjs"

export default async function EventConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Confirmation Link Required</CardTitle>
              </div>
              <CardDescription>
                You need a valid confirmation link to finalize this event. Check your email for the link that was sent
                when you submitted the event.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const allTokens = await db.eventEditToken.findMany({
    include: {
      event: true,
    },
  })

  let matchedToken = null
  for (const tokenRecord of allTokens) {
    const isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
    if (isMatch) {
      matchedToken = tokenRecord
      break
    }
  }

  if (!matchedToken) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Invalid Confirmation Link</CardTitle>
              </div>
              <CardDescription>
                This confirmation link is invalid. Please check the URL or look for the correct link in your email.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const now = new Date()
  if (matchedToken.expires <= now) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Confirmation Link Expired</CardTitle>
              </div>
              <CardDescription>
                This confirmation link has expired. Confirmation links are valid for 30 days after creation.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const event = matchedToken.event

  if (!event) {
    redirect("/")
  }

  if (event.status === "PUBLISHED") {
    redirect(`/edit/${event.id}?token=${token}`)
  }

  await db.event.update({
    where: { id: event.id },
    data: { status: "PUBLISHED" },
  })

  redirect(`/edit/${event.id}?token=${token}`)
}
