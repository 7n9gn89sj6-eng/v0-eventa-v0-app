"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ClientOnly from "@/components/ClientOnly"

interface Event {
  id: string
  title: string
  createdAt: Date
  moderationStatus: string
  moderationSeverity: string | null
  moderationCategory: string | null
  moderationReason: string | null
  createdBy: {
    name: string | null
    email: string
  }
}

interface AdminEventsTableProps {
  events: Event[]
  stats: {
    pending: number
    approved: number
    flagged: number
    rejected: number
  }
  currentFilter?: string
}

export function AdminEventsTable({ events, stats, currentFilter }: AdminEventsTableProps) {
  const router = useRouter()

  const handleFilterChange = (status: string | null) => {
    if (status) {
      router.push(`/admin/events?status=${status}`)
    } else {
      router.push("/admin/events")
    }
  }

  const getModerationBadgeVariant = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "default"
      case "PENDING":
        return "secondary"
      case "FLAGGED":
        return "destructive"
      case "REJECTED":
        return "outline"
      default:
        return "secondary"
    }
  }

  const getSeverityBadgeVariant = (severity: string | null) => {
    switch (severity) {
      case "HIGH":
        return "destructive"
      case "MEDIUM":
        return "secondary"
      case "LOW":
        return "outline"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={`cursor-pointer transition-colors ${!currentFilter ? "border-primary" : "hover:border-primary/50"}`}
          onClick={() => handleFilterChange(null)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">All Events</CardTitle>
            <div className="text-2xl font-bold">{stats.pending + stats.approved + stats.flagged + stats.rejected}</div>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${currentFilter === "PENDING" ? "border-primary" : "hover:border-primary/50"}`}
          onClick={() => handleFilterChange("PENDING")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${currentFilter === "FLAGGED" ? "border-primary" : "hover:border-primary/50"}`}
          onClick={() => handleFilterChange("FLAGGED")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flagged</CardTitle>
            <div className="text-2xl font-bold text-red-600">{stats.flagged}</div>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${currentFilter === "REJECTED" ? "border-primary" : "hover:border-primary/50"}`}
          onClick={() => handleFilterChange("REJECTED")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
            <div className="text-2xl font-bold text-gray-600">{stats.rejected}</div>
          </CardHeader>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Title</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No events found
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/events/${event.id}`} className="hover:underline">
                        {event.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{event.createdBy.name || "Unknown"}</div>
                        <div className="text-muted-foreground">{event.createdBy.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getModerationBadgeVariant(event.moderationStatus)}>
                        {event.moderationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {event.moderationSeverity && (
                        <Badge variant={getSeverityBadgeVariant(event.moderationSeverity)}>
                          {event.moderationSeverity}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{event.moderationCategory || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        <ClientOnly>{new Date(event.createdAt).toLocaleDateString()}</ClientOnly>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/events/${event.id}`}>Review</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
