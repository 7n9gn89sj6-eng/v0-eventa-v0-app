"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/moderation", label: "Moderation Queue" },
    { href: "/admin/events", label: "All Events" },
    { href: "/admin/users", label: "Users" },
  ];

  return (
    <aside className="admin-sidebar">
      <h2 className="text-lg font-semibold mb-4">Eventa Admin</h2>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            pathname === link.href ? "bg-white/10 text-white" : ""
          )}
        >
          {link.label}
        </Link>
      ))}
    </aside>
  );
}
