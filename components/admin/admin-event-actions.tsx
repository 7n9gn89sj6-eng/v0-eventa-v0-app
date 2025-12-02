"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreVertical, CheckCircle, XCircle, Archive, Eye } from "lucide-react"
import { toast } from "sonner"

interface AdminEventActionsProps {
  eventId: string
  currentStatus: string
}

export function AdminEventActions({ eventId, currentStatus }: AdminEventActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const updateStatus = async (newStatus: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update status")
      }

      toast.success(`Event ${newStatus.toLowerCase()}`)
      router.refresh()
    } catch (error) {
      toast.error("Failed to update event status")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isLoading}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/events/${eventId}`)}>
          <Eye className="mr-2 h-4 w-4" />
          View Event
        </DropdownMenuItem>
        {currentStatus !== "PUBLISHED" && (
          <DropdownMenuItem onClick={() => updateStatus("PUBLISHED")}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Publish
          </DropdownMenuItem>
        )}
        {currentStatus !== "DRAFT" && (
          <DropdownMenuItem onClick={() => updateStatus("DRAFT")}>
            <XCircle className="mr-2 h-4 w-4" />
            Unpublish
          </DropdownMenuItem>
        )}
        {currentStatus !== "ARCHIVED" && (
          <DropdownMenuItem onClick={() => updateStatus("ARCHIVED")}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
