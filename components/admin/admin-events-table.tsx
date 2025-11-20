"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Inbox,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  X,
  Loader2,
} from "lucide-react"
import ClientOnly from "@/components/ClientOnly"
import { BulkActionBar } from "@/components/admin/bulk-action-bar"
import { getAdminDisplayStatus } from "@/lib/events"
import type { EventStatus, EventAIStatus } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface Event {
  id: string
  title: string
  createdAt: Date
  status: string
  aiStatus: string | null
  moderationStatus: string
  moderationSeverity: string | null
  moderationCategory: string | null
  moderationReason: string | null
  adminNotes: string | null
  createdBy: {
    name: string | null
    email: string
  }
}

interface AdminEventsTableProps {
  events: Event[]
  stats: {
    needsReview: number
    aiRejected: number
    autoApproved: number
    all: number
  }
  currentTab: string
  currentPage: number
  totalPages: number
}

export function AdminEventsTable({ events, stats, currentTab, currentPage, totalPages }: AdminEventsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [loadingEventIds, setLoadingEventIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedIds([])
    setSelectAll(false)
  }, [currentTab, currentPage, searchParams?.get("search")])

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedIds(events.map((e) => e.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (eventId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, eventId])
    } else {
      setSelectedIds(selectedIds.filter((id) => id !== eventId))
      setSelectAll(false)
    }
  }

  const handleClearSelection = () => {
    setSelectedIds([])
    setSelectAll(false)
  }

  const handleTabChange = (tab: string) => {
    router.push(`/admin/events?tab=${tab}&page=1`)
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      router.push(`/admin/events?tab=${currentTab}&page=${currentPage - 1}`)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      router.push(`/admin/events?tab=${currentTab}&page=${currentPage + 1}`)
    }
  }

  const getStatusBadge = (event: Event) => {
    const displayStatus = getAdminDisplayStatus({
      status: event.status as EventStatus,
      aiStatus: event.aiStatus as EventAIStatus | null,
    })

    const IconComponent =
      displayStatus.icon === "check"
        ? CheckCircle2
        : displayStatus.icon === "alert"
          ? AlertTriangle
          : displayStatus.icon === "x"
            ? XCircle
            : Clock

    const iconColor =
      displayStatus.variant === "success"
        ? "text-green-600"
        : displayStatus.variant === "warning"
          ? "text-yellow-600"
          : displayStatus.variant === "destructive"
            ? "text-red-600"
            : "text-gray-600"

    return (
      <div className="flex items-center gap-1.5" title={displayStatus.description}>
        <IconComponent className={`h-3.5 w-3.5 ${iconColor}`} />
        <Badge variant={displayStatus.variant === "success" ? "default" : displayStatus.variant}>
          {displayStatus.label}
        </Badge>
      </div>
    )
  }

  const getEmptyStateMessage = (tab: string) => {
    switch (tab) {
      case "needs-review":
        return "No events need review right now."
      case "ai-rejected":
        return "No AI-rejected events."
      case "auto-approved":
        return "No auto-approved events yet."
      case "all":
        return "No events found."
      default:
        return "No events found."
    }
  }

  const handleQuickModeration = async (eventId: string, action: "approve" | "reject") => {
    setLoadingEventIds((prev) => new Set(prev).add(eventId))

    try {
      const response = await fetch(`/api/admin/events/${eventId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: `Quick ${action} from events table`,
          adminId: "current-admin", // This will be validated by the backend
          reason: action === "reject" ? "Rejected via quick action" : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to ${action} event`)
      }

      toast({
        title: action === "approve" ? "Event approved" : "Event rejected",
        description:
          action === "approve"
            ? "The event has been published and is now visible to users."
            : "The event has been rejected and hidden from public view.",
        variant: action === "approve" ? "default" : "destructive",
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Couldn't ${action} this event. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setLoadingEventIds((prev) => {
        const next = new Set(prev)
        next.delete(eventId)
        return next
      })
    }
  }

  const getQuickActions = (event: Event): { canApprove: boolean; canReject: boolean } => {
    const displayStatus = getAdminDisplayStatus({
      status: event.status as EventStatus,
      aiStatus: event.aiStatus as EventAIStatus | null,
    })

    const canApprove = displayStatus.label !== "Published"
    const canReject = displayStatus.label !== "Rejected"

    return { canApprove, canReject }
  }

  return (
    <div className="space-y-6">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="needs-review" className="text-xs sm:text-sm whitespace-nowrap">
            <span className="hidden sm:inline">Needs Review</span>
            <span className="sm:hidden">Review</span>
            {stats.needsReview > 0 && ` (${stats.needsReview})`}
          </TabsTrigger>
          <TabsTrigger value="ai-rejected" className="text-xs sm:text-sm whitespace-nowrap">
            <span className="hidden sm:inline">AI Rejected</span>
            <span className="sm:hidden">AI</span>
            {stats.aiRejected > 0 && ` (${stats.aiRejected})`}
          </TabsTrigger>
          <TabsTrigger value="auto-approved" className="text-xs sm:text-sm whitespace-nowrap">
            <span className="hidden sm:inline">Auto-Approved</span>
            <span className="sm:hidden">Auto</span>
            {stats.autoApproved > 0 && ` (${stats.autoApproved})`}
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs sm:text-sm whitespace-nowrap">
            All ({stats.all})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <BulkActionBar selectedIds={selectedIds} onClearSelection={handleClearSelection} />

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <Inbox className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">{getEmptyStateMessage(currentTab)}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all events"
                        />
                      </TableHead>
                      <TableHead>Event Title</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]">Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => {
                      const { canApprove, canReject } = getQuickActions(event)
                      const isLoading = loadingEventIds.has(event.id)

                      return (
                        <TableRow key={event.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(event.id)}
                              onCheckedChange={(checked) => handleSelectOne(event.id, checked as boolean)}
                              aria-label={`Select ${event.title}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link href={`/admin/events/${event.id}`} className="hover:underline">
                              {event.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              <ClientOnly>{new Date(event.createdAt).toLocaleDateString()}</ClientOnly>
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(event)}</TableCell>
                          <TableCell>
                            {event.adminNotes && (
                              <FileText className="h-4 w-4 text-muted-foreground" title="Has admin notes" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canApprove && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-11 w-11 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleQuickModeration(event.id, "approve")}
                                  disabled={isLoading}
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Check className="h-5 w-5" />
                                  )}
                                </Button>
                              )}
                              {canReject && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-11 w-11 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleQuickModeration(event.id, "reject")}
                                  disabled={isLoading}
                                >
                                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
                                </Button>
                              )}
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/admin/events/${event.id}`}>View</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden divide-y">
                {events.map((event) => {
                  const { canApprove, canReject } = getQuickActions(event)
                  const isLoading = loadingEventIds.has(event.id)

                  return (
                    <div key={event.id} className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.includes(event.id)}
                          onCheckedChange={(checked) => handleSelectOne(event.id, checked as boolean)}
                          aria-label={`Select ${event.title}`}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="font-medium hover:underline text-base block"
                          >
                            {event.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              <ClientOnly>{new Date(event.createdAt).toLocaleDateString()}</ClientOnly>
                            </span>
                            {event.adminNotes && (
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" title="Has admin notes" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div>{getStatusBadge(event)}</div>

                      <div className="flex items-center gap-2 pt-2">
                        {canApprove && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-11 flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 font-medium"
                            onClick={() => handleQuickModeration(event.id, "approve")}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-5 w-5 mr-2" />
                                Approve
                              </>
                            )}
                          </Button>
                        )}
                        {canReject && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-11 flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
                            onClick={() => handleQuickModeration(event.id, "reject")}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <>
                                <X className="h-5 w-5 mr-2" />
                                Reject
                              </>
                            )}
                          </Button>
                        )}
                        <Button asChild variant="outline" size="sm" className="h-11 flex-1 bg-transparent">
                          <Link href={`/admin/events/${event.id}`}>View Details</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
