"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export function UserNav() {
  return (
    <Button asChild variant="default" size="sm">
      <Link href="/add-event">
        <Plus className="mr-2 h-4 w-4" />
        Post Event
      </Link>
    </Button>
  )
}
