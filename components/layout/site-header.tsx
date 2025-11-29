"use client"

import { Button } from "@/components/ui/button"
import { Calendar, MapPin, List } from "lucide-react"
import { UserNav } from "@/components/auth/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { VersionBadge } from "@/components/version-badge"
import Link from "next/link"
import { useI18n } from "@/lib/i18n/context"

export function SiteHeader() {
  const { t } = useI18n()
  const tCommon = t("common")

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          <h1 className="text-xl font-bold">Eventa</h1>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <VersionBadge />
          </div>

          {/* Browse button */}
          <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
            <Link href="/events">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{tCommon("browse")}</span>
            </Link>
          </Button>

          {/* Location Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={() => {
              if (!navigator.geolocation) {
                alert("Geolocation is not supported on this device.")
                return
              }

              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const lat = pos.coords.latitude
                  const lng = pos.coords.longitude

                  // Always include q= to avoid server-side crash
                  window.location.href = `/discover?q=&lat=${lat}&lng=${lng}`
                },
                () => {
                  alert("Location permission denied or unavailable.")
                }
              )
            }}
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">{tCommon("location")}</span>
          </Button>

          <LanguageSwitcher />
          <UserNav />
        </div>
      </div>

      {/* MOBILE VERSION BADGE */}
      <div className="md:hidden flex justify-center pb-2">
        <VersionBadge />
      </div>
    </header>
  )
}
