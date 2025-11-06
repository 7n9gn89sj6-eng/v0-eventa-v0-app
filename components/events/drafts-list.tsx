"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, Pencil, Trash2, Send } from "lucide-react"
import Link from "next/link"

interface DraftEvent {
  id: string
  title: string
  category: string
  city: string
  venue: string
  date: string
  time: string
  description: string
}

interface DraftsListProps {
  drafts: DraftEvent[]
  onEdit: (draft: DraftEvent) => void
  onDelete: (id: string) => void
}

export function DraftsList({ drafts, onEdit, onDelete }: DraftsListProps) {
  if (drafts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No drafts yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create an event to see it here</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {drafts.map((draft) => (
        <Card key={draft.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold">{draft.title}</h3>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(draft.date).toLocaleDateString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {draft.time}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {draft.venue || draft.city}
                </span>
              </div>
              {draft.description && <p className="text-sm text-muted-foreground line-clamp-2">{draft.description}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="default" asChild>
                <Link href={`/add-event?draft=${draft.id}`}>
                  <Send className="h-3 w-3 mr-1" />
                  Submit
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(draft)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(draft.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
