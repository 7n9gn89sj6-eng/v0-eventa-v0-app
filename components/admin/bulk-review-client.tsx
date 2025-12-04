"use client";

import { useState } from "react";
import BulkActionBar from "./bulk-action-bar";

/* Group events by AI status */
function groupEvents(events: any[]) {
  return {
    needsReview: events.filter((e: any) => e.aiStatus === "NEEDS_REVIEW"),
    rejected: events.filter((e: any) => e.aiStatus === "REJECTED"),
    safe: events.filter((e: any) => e.aiStatus === "SAFE"),
  };
}

/* Sort events inside each group */
function sortEvents(items: any[], sort: string) {
  const sorted = [...items];

  switch (sort) {
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "title-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "newest":
      return sorted.sort(
        (a, b) =>
          Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))
      );
    case "oldest":
      return sorted.sort(
        (a, b) =>
          Number(new Date(a.createdAt)) - Number(new Date(b.createdAt))
      );
    case "city-asc":
      return sorted.sort((a, b) => a.city.localeCompare(b.city));
    default:
      return items;
  }
}

export default function BulkReviewClient({ events }: { events: any[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState("title-asc");

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clear = () => setSelectedIds([]);

  const groupsRaw = groupEvents(events);
  const groups = {
    needsReview: sortEvents(groupsRaw.needsReview, sort),
    rejected: sortEvents(groupsRaw.rejected, sort),
    safe: sortEvents(groupsRaw.safe, sort),
  };

  const allIds = events.map((e) => e.id);
  const isAllSelected =
    allIds.length > 0 && selectedIds.length === allIds.length;

  const toggleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : allIds);
  };

  const renderGroup = (
    label: string,
    items: any[],
    colorClass: string
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-3">
        <h3 className={`text-lg font-semibold ${colorClass}`}>
          {label} ({items.length})
        </h3>

        <div className="border rounded-md divide-y">
          {items.map((event) => (
            <div key={event.id} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(event.id)}
                onChange={() => toggle(event.id)}
                className="h-4 w-4"
              />

              <div className="flex-1">
                <div className="font-medium">{event.title}</div>
                <div className="text-sm text-muted-foreground">
                  {event.city}, {event.country}
                </div>
              </div>

              <span
                className={
                  "text-xs px-2 py-1 rounded border " + colorClass
                }
              >
                {event.aiStatus}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xl font-semibold">Bulk Review</h2>
        <span className="text-sm text-muted-foreground">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="flex items-center gap-3 py-2 border-b">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={toggleSelectAll}
          className="h-4 w-4"
        />
        <span className="text-sm">
          Select All ({events.length} events)
        </span>

        <div className="flex-1" />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="title-asc">Title A → Z</option>
          <option value="title-desc">Title Z → A</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="city-asc">City A → Z</option>
        </select>
      </div>

      {renderGroup(
        "Needs Review",
        groups.needsReview,
        "border-yellow-400 text-yellow-600"
      )}

      {renderGroup(
        "Rejected",
        groups.rejected,
        "border-red-400 text-red-600"
      )}

      {renderGroup(
        "Safe",
        groups.safe,
        "border-green-400 text-green-600"
      )}

      <BulkActionBar selectedIds={selectedIds} onClear={clear} />
    </div>
  );
}
