"use client";

import { LogOut } from "lucide-react";

export function AdminTopBar({ admin }: { admin: any }) {
  return (
    <header
      style={{
        height: "60px",
        borderBottom: "1px solid #eee",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div>
        <strong>Admin Panel</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "14px", color: "#333" }}>
          {admin?.email || "Admin"}
        </span>

        <form action="/api/admin/logout" method="POST">
          <button
            type="submit"
            style={{
              border: "none",
              background: "#f5f5f5",
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </form>
      </div>
    </header>
  );
}
