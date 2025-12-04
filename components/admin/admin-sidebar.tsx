"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();

  const links = [
    {
      href: "/admin/events?tab=needs-review",
      label: "Needs Review",
      match: "/admin/events",
    },
    {
      href: "/admin/events?tab=ai-rejected",
      label: "AI Rejected",
      match: "/admin/events",
    },
    {
      href: "/admin/events?tab=auto-approved",
      label: "AI Approved",
      match: "/admin/events",
    },
    {
      href: "/admin/events?tab=all",
      label: "All Events",
      match: "/admin/events",
    },
    {
      href: "/admin/events/bulk",
      label: "Bulk Review",
      match: "/admin/events/bulk",
    },
  ];

  return (
    <aside className="w-60 border-r bg-muted/20 py-6 px-4">
      <nav className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "block rounded px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(link.match)
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
