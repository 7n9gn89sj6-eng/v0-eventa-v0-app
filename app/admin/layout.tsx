import { redirect } from 'next/navigation'
import { getSession } from "@/lib/jwt"
import { db } from "@/lib/db"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/verify")
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { isAdmin: true },
  })

  if (!user?.isAdmin) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
