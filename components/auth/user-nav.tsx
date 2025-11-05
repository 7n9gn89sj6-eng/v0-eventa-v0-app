"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

export function UserNav() {
  const tEvent = useTranslations("event")

  return (
    <Button asChild variant="default" size="sm">
      <Link href="/add-event">
        <Plus className="mr-2 h-4 w-4" />
        {tEvent("postEvent")}
      </Link>
    </Button>
  )
}
