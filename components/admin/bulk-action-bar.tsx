"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BulkActionBarProps {
  selectedIds: string[]
  onClearSelection: () => void
}

export function BulkActionBar({ selectedIds, onClearSelection }: BulkActionBarProps) {
  const router = useRouter()
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleBulkApprove = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/events/bulk-moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          ids: selectedIds,
        }),
      })

      if (response.ok) {
        onClearSelection()
        router.refresh()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || "Failed to approve events"}`)
      }
    } catch (error) {
      console.error("Error bulk approving:", error)
      alert("An error occurred while approving events")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please provide a rejection reason")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/events/bulk-moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          ids: selectedIds,
          reason: rejectReason,
        }),
      })

      if (response.ok) {
        setIsRejectDialogOpen(false)
        setRejectReason("")
        onClearSelection()
        router.refresh()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || "Failed to reject events"}`)
      }
    } catch (error) {
      console.error("Error bulk rejecting:", error)
      alert("An error occurred while rejecting events")
    } finally {
      setIsLoading(false)
    }
  }

  if (selectedIds.length === 0) {
    return null
  }

  return (
    <>
      <Card className="sticky top-0 z-10 mb-4 border-2 border-blue-500 bg-blue-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-blue-900">
              {selectedIds.length} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              disabled={isLoading}
            >
              Clear Selection
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleBulkApprove}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Bulk Approve
            </Button>
            <Button
              onClick={() => setIsRejectDialogOpen(true)}
              disabled={isLoading}
              variant="destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Bulk Reject
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedIds.length} Event(s)</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting these events. This will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkReject}
              disabled={isLoading || !rejectReason.trim()}
            >
              {isLoading ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
