import type { ReactNode } from "react";
import { AdminTopBar } from "@/components/admin/admin-topbar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getAdminInfo } from "@/lib/get-admin-info";
import "./admin.css";

export const metadata = {
  title: "Eventa Admin",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminInfo(); // read from JWT cookie

  return (
    <div className="admin-root">
      <AdminSidebar />

      <div className="admin-main">
        <AdminTopBar admin={admin} />

        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
