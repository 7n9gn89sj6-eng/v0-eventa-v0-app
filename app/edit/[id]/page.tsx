import Link from "next/link";
import db from "@/lib/db";
import { validateEventEditToken } from "@/lib/eventEditToken";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import EditEventForm, {
  type EditPageEventPayload,
} from "./EditEventForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function EditLinkErrorView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Edit Event</h1>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-pretty">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/discover">Browse events</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/add-event">Post an event</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface EditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function EditEventPage(props: EditPageProps) {
  let params: { id: string };
  let searchParams: { token?: string };
  let eventId: string;
  let token: string | null;

  try {
    params = await props.params;
    searchParams = await props.searchParams;
    eventId = params.id;
    token = searchParams.token ?? null;
  } catch (error) {
    return (
      <EditLinkErrorView
        title="Something went wrong"
        description="We couldn’t load the editor. Wait a moment and refresh the page, or go back using the buttons below."
      />
    );
  }

  if (!eventId || !token) {
    return (
      <EditLinkErrorView
        title="We couldn’t open this edit link"
        description="This link looks incomplete. Open the full link from your Eventa email, or start from Discover below."
      />
    );
  }

  let isValid: boolean;
  try {
    isValid = await validateEventEditToken(eventId, token);
  } catch (error) {
    return (
      <EditLinkErrorView
        title="Something went wrong"
        description="We couldn’t load the editor. Wait a moment and refresh the page, or go back using the buttons below."
      />
    );
  }

  if (!isValid) {
    return (
      <EditLinkErrorView
        title="This edit link is no longer valid"
        description="Links expire for security. Check your email for a newer message from Eventa, or post your event again."
      />
    );
  }

  let event;
  try {
    event = await db.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        description: true,
        address: true,
        locationAddress: true,
        city: true,
        region: true,
        country: true,
        postcode: true,
        startAt: true,
        endAt: true,
        imageUrl: true,
        imageUrls: true,
        externalUrl: true,
        category: true,
        subcategory: true,
        tags: true,
        customCategoryLabel: true,
        originalLanguage: true,
        status: true,
      },
    });
  } catch (error) {
    return (
      <EditLinkErrorView
        title="Something went wrong"
        description="We couldn’t load the editor. Wait a moment and refresh the page, or go back using the buttons below."
      />
    );
  }

  if (!event) {
    return notFound();
  }

  const serializableEvent: EditPageEventPayload = {
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    address: event.address ?? null,
    locationAddress: event.locationAddress ?? null,
    city: event.city,
    state: event.region ?? null,
    country: event.country,
    postcode: event.postcode ?? null,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    imageUrl: event.imageUrl ?? null,
    imageUrls: event.imageUrls ?? [],
    externalUrl: event.externalUrl ?? null,
    category: event.category,
    subcategory: event.subcategory ?? null,
    tags: event.tags ?? [],
    customCategoryLabel: event.customCategoryLabel ?? null,
    originalLanguage: event.originalLanguage ?? null,
    status: event.status,
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-6">Edit Event</h1>
      <EditEventForm event={serializableEvent} token={token} />
    </div>
  );
}
