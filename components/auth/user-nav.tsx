"use client"

import { signOut, useSession, signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, LogOut, Plus, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { isAuthEnabled } from "@/lib/auth-config"
import { useTranslations } from "next-intl"

function UserNavWithAuth() {
  const [mounted, setMounted] = useState(false)
  const { data: session, status } = useSession()
  const t = useTranslations("common")
  const tEvent = useTranslations("event")

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-8 w-8" />
  }

  if (status === "loading") {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          data-testid="landing-signin"
          onClick={() => signIn(undefined, { callbackUrl: "/add-event" })}
        >
          {t("signIn")}
        </Button>
        <a
          href="/api/auth/signin?callbackUrl=%2Fadd-event"
          className="sr-only sm:not-sr-only text-xs underline opacity-70"
        >
          Sign in (fallback)
        </a>
      </div>
    )
  }

  const initials =
    session.user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ||
    session.user.email?.[0].toUpperCase() ||
    "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{session.user.name || t("user")}</p>
            <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/add-event" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            {tEvent("postEvent")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/events/my-events" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            {tEvent("myEvents")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function UserNav() {
  const [mounted, setMounted] = useState(false)
  const t = useTranslations("common")
  const tAuth = useTranslations("auth")

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-8 w-8" />
  }

  if (!isAuthEnabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" disabled className="gap-2 bg-transparent">
              <AlertCircle className="h-4 w-4" />
              {t("signIn")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tAuth("authNotConfigured")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return <UserNavWithAuth />
}
