"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type AdminEventReviewProps = {
  event: any; // Prisma Event & relations (from server page)
  adminId: string;
  adminEmail: string | null;
};

export function AdminEventReview({
  event,
  adminId,
  adminEmail,
}: AdminEventReviewProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function performStatusAction(action: string) {
    setLoadingAction(action);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });

      if (!res.ok) {
        console.error("[ADMIN] Status update failed:", await res.text());
        alert("Failed to update event status.");
      } else {
        startTransition(() => router.refresh());
      }
    } catch (err) {
      console.error("[ADMIN] Status update error:", err);
      alert("Error performing action.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function rerunAiModeration() {
    setLoadingAction("re-analyze");
    try {
      const res = await fetch(
        `/api/admin/events/${event.id}/analyze`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        console.error("[ADMIN] Re-analyze failed:", await res.text());
        alert("Failed to re-run AI moderation.");
      } else {
        startTransition(() => router.refresh());
      }
    } catch (err) {
      console.error("[ADMIN] Re-analyze error:", err);
      alert("Error re-running AI moderation.");
    } finally {
      setLoadingAction(null);
    }
  }

  const isBusy = loadingAction !== null || isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* HEADER */}
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">{event.title}</h1>

        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="outline">Status: {event.status}</Badge>
          <Badge variant="outline">AI: {event.aiStatus ?? "PENDING"}</Badge>
          {event.publishedAt && (
            <span className="text-xs text-muted-foreground">
              Published: {new Date(event.publishedAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Creator:</strong>{" "}
            {event.createdBy?.email ?? "Unknown"}{" "}
            {event.createdBy?.name ? `(${event.createdBy.name})` : ""}
          </p>
          <p>
            <strong>Location:</strong> {event.city}, {event.country}
          </p>
          <p>
            <strong>Created at:</strong>{" "}
            {new Date(event.createdAt).toLocaleString()}
          </p>
        </div>
      </header>

      {/* DESCRIPTION */}
      <section className="space-y-2">
        <h2 className="font-semibold text-lg">Description</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {event.description || "No description provided."}
        </p>
      </section>

      {/* AI INFO */}
      {(event.aiStatus || event.aiReason) && (
        <section className="space-y-2 border rounded-md p-4 bg-muted/40">
          <h2 className="font-semibold text-lg">AI Moderation</h2>
          <p className="text-sm">
            <strong>AI Status:</strong> {event.aiStatus ?? "PENDING"}
          </p>
          {event.aiReason && (
            <p className="text-sm whitespace-pre-wrap">
              <strong>AI Reason:</strong> {event.aiReason}
            </p>
          )}
          {event.aiAnalyzedAt && (
            <p className="text-xs text-muted-foreground">
              Last analyzed:{" "}
              {new Date(event.aiAnalyzedAt).toLocaleString()}
            </p>
          )}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={rerunAiModeration}
            >
              {loadingAction === "re-analyze"
                ? "Re-running AI…"
                : "Re-run AI Moderation"}
            </Button>
          </div>
        </section>
      )}

      {/* ADMIN REASON */}
      <section className="space-y-2">
        <h2 className="font-semibold text-lg">Admin Notes (optional)</h2>
        <Textarea
          placeholder="Reason for approval, rejection, or review (optional, but recommended)."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </section>

      {/* ACTION BUTTONS */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {/* Primary */}
          <Button
            onClick={() => performStatusAction("approve")}
            disabled={isBusy}
          >
            {loadingAction === "approve"
              ? "Approving…"
              : "Approve & Publish"}
          </Button>

          {/* Danger */}
          <Button
            variant="destructive"
            onClick={() => {
              const ok = confirm(
                "Reject this event? It will remain a draft with AI status REJECTED."
              );
              if (ok) performStatusAction("reject");
            }}
            disabled={isBusy}
          >
            {loadingAction === "reject" ? "Rejecting…" : "Reject"}
          </Button>

          {/* Needs Review */}
          <Button
            variant="secondary"
            onClick={() => performStatusAction("needs_review")}
            disabled={isBusy}
          >
            {loadingAction === "needs_review"
              ? "Updating…"
              : "Mark as Needs Review"}
          </Button>

          {/* Publish / Unpublish */}
          <Button
            variant="outline"
            onClick={() => performStatusAction("publish")}
            disabled={isBusy}
          >
            {loadingAction === "publish"
              ? "Publishing…"
              : "Publish (Override)"}
          </Button>

          <Button
            variant="outline"
            onClick={() => performStatusAction("unpublish")}
            disabled={isBusy}
          >
            {loadingAction === "unpublish"
              ? "Unpublishing…"
              : "Unpublish"}
          </Button>
        </div>
      </section>

      {/* AUDIT LOG */}
      <section className="space-y-3 pt-6">
        <h2 className="text-lg font-semibold">Audit Log</h2>

        {(!event.auditLogs || event.auditLogs.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No audit entries yet.
          </p>
        )}

        <div className="space-y-3">
          {event.auditLogs?.map((log: any) => (
            <div
              key={log.id}
              className="border rounded-md p-3 bg-muted/30 space-y-1"
            >
              <div className="flex justify-between text-sm">
                <span className="font-medium">{log.action}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {log.reason && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {log.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
