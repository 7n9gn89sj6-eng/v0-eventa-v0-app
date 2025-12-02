import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function EventNotFound() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Event Not Found</h1>
            <p className="text-muted-foreground">This event doesn't exist or has been removed.</p>
          </div>
          <Button asChild className="mt-4">
            <Link href="/">Browse Events</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
