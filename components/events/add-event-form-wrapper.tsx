"use client";

import { AddEventForm } from "./add-event-form";  // <-- named import

interface AddEventFormWrapperProps {
  initialData?: Record<string, unknown>;
  draftId?: string;
}

export default function AddEventFormWrapper({ initialData, draftId }: AddEventFormWrapperProps) {
  return <AddEventForm initialData={initialData} draftId={draftId} />;
}

