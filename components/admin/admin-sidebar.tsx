"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Shield } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    name: "Moderation",
    href: "/admin/events",
    icon: Shield,
    badge: 0, // Placeholder badge count
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="border-b border-sidebar-border px-6 py-4">
          <h2 className="text-lg font-semibold text-sidebar-foreground">Admin Panel</h2>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname?.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.name}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
