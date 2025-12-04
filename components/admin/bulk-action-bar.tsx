"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type BulkActionBarProps = {
  selectedIds: string[];
  onClear?: () => void;
};

export default function BulkActionBar({
  selectedIds,
  onClear,
}: BulkActionBarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const busy = loading || isPending;

  async function doBulkAction(action: string) {
    if (selectedIds.length === 0) {
      alert("No events selected.");
      return;
    }

    const ok = confirm(
      `Apply "${action}" to ${selectedIds.length} selected event(s)?`
    );
    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch("/api/admin/events/bulk-moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: selectedIds,
          action,
        }),
      });

      if (!res.ok) {
        alert("Bulk action failed.");
      } else {
        startTransition(() => router.refresh());
        if (onClear) onClear();
      }
    } catch (err) {
      console.error("[Bulk Action Error]:", err);
      alert("Error performing bulk action.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3 py-4">
      <Button disabled={busy} onClick={() => doBulkAction("approve")}>
        Approve
      </Button>

      <Button
        variant="destructive"
        disabled={busy}
        onClick={() => doBulkAction("reject")}
      >
        Reject
      </Button>

      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => doBulkAction("needs_review")}
      >
        Needs Review
      </Button>

      <Button disabled={busy} onClick={() => doBulkAction("publish")}>
        Publish
      </Button>

      <Button
        disabled={busy}
        variant="outline"
        onClick={() => doBulkAction("unpublish")}
      >
        Unpublish
      </Button>

      {onClear && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onClear()}
        >
          Clear Selection
        </Button>
      )}
    </div>
  );
}
