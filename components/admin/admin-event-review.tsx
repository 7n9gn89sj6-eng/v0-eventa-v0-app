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
          <Badge variant={event.moderationStatus === "APPROVED" ? "default" : "destructive"}>
            Moderation: {event.moderationStatus ?? "NULL"}
          </Badge>
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
          <p>
            <strong>Detected Language:</strong>{" "}
            {event.language ? (
              <Badge variant="outline" className="ml-1">
                {event.language}
              </Badge>
            ) : (
              <span className="text-muted-foreground">Not detected</span>
            )}
          </p>
          <p>
            <strong>Embedding:</strong>{" "}
            {event.hasEmbedding ? (
              <Badge variant="outline" className="ml-1 text-green-600">
                Present
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-1 text-muted-foreground">
                Missing
              </Badge>
            )}
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

      {/* MODERATION STATUS FIX */}
      {event.status === "PUBLISHED" && event.aiStatus === "SAFE" && event.moderationStatus !== "APPROVED" && (
        <section className="space-y-2 border rounded-md p-4 bg-yellow-50 dark:bg-yellow-900/20">
          <h2 className="font-semibold text-lg text-yellow-800 dark:text-yellow-200">
            ⚠️ Event Not Visible in Search
          </h2>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            This event is PUBLISHED and SAFE, but <strong>moderationStatus</strong> is not "APPROVED". 
            It will not appear in search results until this is fixed.
          </p>
          <Button
            onClick={async () => {
              if (!confirm("Fix moderationStatus to APPROVED?")) return;
              setLoadingAction("fix-status");
              try {
                const res = await fetch(`/api/events/${event.id}/fix-status`, {
                  method: "POST",
                });
                if (!res.ok) {
                  alert("Failed to fix moderation status");
                } else {
                  startTransition(() => router.refresh());
                }
              } catch (err) {
                console.error("[ADMIN] Fix status error:", err);
                alert("Error fixing moderation status");
              } finally {
                setLoadingAction(null);
              }
            }}
            disabled={isBusy}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {loadingAction === "fix-status" ? "Fixing..." : "Fix Moderation Status"}
          </Button>
        </section>
      )}

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
