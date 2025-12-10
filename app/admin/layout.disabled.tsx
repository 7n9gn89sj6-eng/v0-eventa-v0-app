import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-topbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <div className="flex-1 flex flex-col">
        <AdminTopBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
