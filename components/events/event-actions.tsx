"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface EventActionsProps {
  eventId: string
  status: string
}

export function EventActions({ eventId, status }: EventActionsProps) {
  const router = useRouter()
  const [isPublishing, setIsPublishing] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const response = await fetch(`/api/events/${eventId}/publish`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to publish event")
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to publish event")
    } finally {
      setIsPublishing(false)
    }
  }

  const handleArchive = async () => {
    setIsArchiving(true)
    try {
      const response = await fetch(`/api/events/${eventId}/archive`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to archive event")
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to archive event")
    } finally {
      setIsArchiving(false)
    }
  }

  const handleRestore = async () => {
    setIsRestoring(true)
    try {
      const response = await fetch(`/api/events/${eventId}/restore`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to restore event")
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to restore event")
    } finally {
      setIsRestoring(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        alert("Failed to delete event")
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to delete event")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mt-4 flex gap-2">
      <Button asChild variant="outline" size="sm" className="flex-1 bg-transparent">
        <Link href={`/my/events/${eventId}/edit`}>Edit</Link>
      </Button>

      {status === "DRAFT" && (
        <Button onClick={handlePublish} disabled={isPublishing} size="sm" className="flex-1">
          {isPublishing ? "Publishing..." : "Publish"}
        </Button>
      )}

      {status === "PUBLISHED" && (
        <Button onClick={handleArchive} disabled={isArchiving} size="sm" variant="secondary" className="flex-1">
          {isArchiving ? "Archiving..." : "Archive"}
        </Button>
      )}

      {status === "ARCHIVED" && (
        <Button onClick={handleRestore} disabled={isRestoring} size="sm" className="flex-1">
          {isRestoring ? "Restoring..." : "Restore"}
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={isDeleting}>
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
