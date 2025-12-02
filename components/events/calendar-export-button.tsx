"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"
import { toast } from "sonner"

interface CalendarExportButtonProps {
  eventId: string
  eventTitle: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function CalendarExportButton({
  eventId,
  eventTitle,
  variant = "outline",
  size = "default",
}: CalendarExportButtonProps) {
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/calendar`)

      if (!response.ok) {
        throw new Error("Failed to export calendar")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${eventTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("Calendar event downloaded")
    } catch (error) {
      toast.error("Failed to export calendar")
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleExport} className="gap-2">
      <Calendar className="h-4 w-4" />
      {size !== "icon" && "Add to Calendar"}
    </Button>
  )
}
