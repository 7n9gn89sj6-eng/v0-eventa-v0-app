// Generate iCalendar (.ics) format for events
export function generateICS(event: {
  id: string
  title: string
  description: string
  startAt: Date
  endAt: Date
  city: string
  country: string
  venueName?: string | null
  address?: string | null
  externalUrl?: string | null
}) {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  }

  const escapeText = (text: string) => {
    return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
  }

  const location = [event.venueName, event.address, event.city, event.country].filter(Boolean).join(", ")

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eventa//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@eventa.app`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(new Date(event.startAt))}`,
    `DTEND:${formatDate(new Date(event.endAt))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    location ? `LOCATION:${escapeText(location)}` : "",
    event.externalUrl ? `URL:${event.externalUrl}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n")

  return icsContent
}

export function downloadICS(icsContent: string, filename: string) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
