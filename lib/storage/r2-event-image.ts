import "server-only"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import { extensionForImageMime } from "@/lib/events/event-image-upload"

export type R2EnvConfig = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  /** Public origin for browser-loaded images, e.g. https://pub-xxxxx.r2.dev or https://cdn.example.com (no trailing slash) */
  publicBaseUrl: string
}

/**
 * Read Cloudflare R2 (S3-compatible) settings from env. Returns null if any required var is missing.
 */
export function getR2ConfigFromEnv(): R2EnvConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET_NAME?.trim()
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") || ""

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl }
}

export function createR2S3Client(cfg: R2EnvConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })
}

/**
 * Upload bytes to R2 at `events/{uuid}.{ext}` and return the public HTTPS URL.
 */
export async function uploadEventPosterToR2(
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const cfg = getR2ConfigFromEnv()
  if (!cfg) {
    throw new Error("R2 is not configured (missing env vars).")
  }

  const ext = extensionForImageMime(contentType)
  const key = `events/${randomUUID()}.${ext}`
  const client = createR2S3Client(cfg)

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )

  return `${cfg.publicBaseUrl}/${key}`
}
