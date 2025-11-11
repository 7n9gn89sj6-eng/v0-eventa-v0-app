const onSubmit = async (values: AddEventFormData) => {
  // Build a single address string the API can parse
  const addressBits = [
    values.address?.trim(),
    values.city?.trim(),
    values.postcode?.trim(),
    values.country?.trim(),
  ].filter(Boolean);
  const address = addressBits.join(", ");

  // API expects: title, description, start, end, timezone?, location?, organizer_name?, creatorEmail (required)
  const payload = {
    title: values.title,
    description: values.description || "",
    start: new Date(values.startAt),          // server uses z.coerce.date()
    end: values.endAt ? new Date(values.endAt) : undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: {
      name: undefined,                        // you can map a venue field here if you add one
      address: address || undefined,
    },
    organizer_name: values.name || undefined,
    organizer_contact: undefined,             // map a contact field if you add one
    creatorEmail: values.email,               // ⚠ required by the route
    imageUrl: values.imageUrl || "",
    externalUrl: values.externalUrl || "",
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Submit failed (${res.status})`);
    }

    const data = await res.json();
    // Optional: route to the edit/confirm page returned by the API
    // router.push(data.editUrl);  // you already import useRouter
    alert("Event created! Check your email for the edit link.");
  } catch (e:any) {
    console.error("Submit error:", e);
    alert(e.message || "Failed to submit event");
  }
};
