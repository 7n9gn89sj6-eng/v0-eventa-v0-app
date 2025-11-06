import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Confirmation link required</CardTitle>
            </div>
            <CardDescription>
              Open the link from your email to finish publishing your event.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <CardTitle>Event confirmed</CardTitle>
          </div>
          <CardDescription>
            Your event has been confirmed. You can edit details any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a className="underline" href={`/event/edit?token=${encodeURIComponent(token)}`}>
            Go to edit page
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
