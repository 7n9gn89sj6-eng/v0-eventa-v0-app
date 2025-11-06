import { redirect } from "next/navigation"
import { db } from "@lib/db"
import { Card, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { AlertCircle } from "lucide-react"
import bcrypt from "bcryptjs"

export default async function EventConfirmPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Confirmation Link Required</CardTitle>
          </div>
          <CardDescription>
            You need a valid confirmation link to finalize this event. Check your email for the link that was sent when you submitted the event.
          </CardDescription>
        </Card>
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
    return redirect("/404") // Send to 404 if token not found
  }

  // Success case - Token matched
  return (
    <div className="container mx-auto px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Your Event is Confirmed!</CardTitle>
        </CardHeader>
        <CardDescription>
          Your event "{matchedToken.event.title}" is now confirmed. You can start promoting it.
        </CardDescription>
      </Card>
    </div>
  )
}

