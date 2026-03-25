import { NextResponse } from "next/server"
import { checkRateLimit, getClientIdentifier, rateLimiters } from "@/lib/rate-limit"
import { validateEventImageFile } from "@/lib/events/event-image-upload"
import { getR2ConfigFromEnv, uploadEventPosterToR2 } from "@/lib/storage/r2-event-image"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!getR2ConfigFromEnv()) {
    return NextResponse.json(
      { error: "Image upload is not configured. Use the image link field below, or ask the site admin to set R2 env vars." },
      { status: 503 },
    )
  }

  const rate = await checkRateLimit(getClientIdentifier(request), rateLimiters.api)
  if (!rate.success) {
    return NextResponse.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file. Use the field name \"file\"." }, { status: 400 })
  }

  const validation = validateEventImageFile(file)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadEventPosterToR2(buffer, file.type)
    return NextResponse.json({ url })
  } catch (err) {
    console.error("[event-image] R2 upload failed:", err)
    return NextResponse.json({ error: "Could not upload image. Try again or paste an image link." }, { status: 500 })
  }
}
