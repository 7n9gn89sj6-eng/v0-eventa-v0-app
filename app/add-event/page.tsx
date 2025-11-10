import { Suspense } from "react";
import AddEventFormWrapper from "@/components/events/add-event-form-wrapper";

export default async function AddEventPage({
  searchParams,
}: {
  // Next.js 16: searchParams is a Promise
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const draftId =
    typeof sp?.draft === "string"
      ? sp.draft
      : Array.isArray(sp?.draft)
      ? sp.draft[0]
      : undefined;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Create an event</h1>
        <p className="text-muted-foreground">Fill in the details below.</p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <AddEventFormWrapper initialData={sp ?? {}} draftId={draftId} />
      </Suspense>
    </div>
  );
}

