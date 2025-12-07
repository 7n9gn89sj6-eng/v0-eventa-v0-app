"use client";

export function AdminTopBar({ admin }: { admin: { email: string } | null }) {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <header className="admin-topbar">
      <div className="admin-breadcrumbs">
        {typeof window !== "undefined" ? window.location.pathname : ""}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {admin?.email}
        </span>

        <button
          onClick={logout}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
