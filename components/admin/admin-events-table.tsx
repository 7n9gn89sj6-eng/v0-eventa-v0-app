"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, AlertTriangle, Clock, Inbox, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import ClientOnly from "@/components/ClientOnly"
import { BulkActionBar } from "@/components/admin/bulk-action-bar"

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
  
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    setSelectedIds([])
    setSelectAll(false)
  }, [currentTab, currentPage, searchParams?.get('search')])

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedIds(events.map(e => e.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (eventId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, eventId])
    } else {
      setSelectedIds(selectedIds.filter(id => id !== eventId))
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <Badge variant="default">PUBLISHED</Badge>
          </div>
        )
      case "ARCHIVED":
        return (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-red-600" />
            <Badge variant="destructive">ARCHIVED</Badge>
          </div>
        )
      case "DRAFT":
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-yellow-600" />
            <Badge variant="secondary">DRAFT</Badge>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-600" />
            <Badge variant="secondary">{status}</Badge>
          </div>
        )
    }
  }

  const getAIStatusBadge = (aiStatus: string | null) => {
    if (!aiStatus) {
      return <span className="text-sm text-muted-foreground">-</span>
    }

    switch (aiStatus) {
      case "SAFE":
        return (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <Badge variant="default">SAFE</Badge>
          </div>
        )
      case "REJECTED":
        return (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-red-600" />
            <Badge variant="destructive">REJECTED</Badge>
          </div>
        )
      case "NEEDS_REVIEW":
        return (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
            <Badge variant="secondary">NEEDS_REVIEW</Badge>
          </div>
        )
      case "PENDING":
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-600" />
            <Badge variant="outline">PENDING</Badge>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-600" />
            <Badge variant="outline">{aiStatus}</Badge>
          </div>
        )
    }
  }

  const getEmptyStateMessage = (tab: string) => {
    switch (tab) {
      case 'needs-review':
        return 'No events need review right now.'
      case 'ai-rejected':
        return 'No AI-rejected events.'
      case 'auto-approved':
        return 'No auto-approved events yet.'
      case 'all':
        return 'No events found.'
      default:
        return 'No events found.'
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="needs-review">
            Needs Review {stats.needsReview > 0 && `(${stats.needsReview})`}
          </TabsTrigger>
          <TabsTrigger value="ai-rejected">
            AI Rejected {stats.aiRejected > 0 && `(${stats.aiRejected})`}
          </TabsTrigger>
          <TabsTrigger value="auto-approved">
            Auto-Approved {stats.autoApproved > 0 && `(${stats.autoApproved})`}
          </TabsTrigger>
          <TabsTrigger value="all">
            All Events ({stats.all})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <BulkActionBar 
        selectedIds={selectedIds} 
        onClearSelection={handleClearSelection}
      />

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <Inbox className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {getEmptyStateMessage(currentTab)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
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
                    <TableHead>AI Status</TableHead>
                    <TableHead className="w-[50px]">Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(event.id)}
                          onCheckedChange={(checked) => 
                            handleSelectOne(event.id, checked as boolean)
                          }
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
                      <TableCell>
                        {getStatusBadge(event.status)}
                      </TableCell>
                      <TableCell>
                        {getAIStatusBadge(event.aiStatus)}
                      </TableCell>
                      <TableCell>
                        {event.adminNotes && (
                          <FileText 
                            className="h-4 w-4 text-muted-foreground" 
                            title="Has admin notes"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/events/${event.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                >
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
