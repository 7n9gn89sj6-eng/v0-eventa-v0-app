"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Upload } from "lucide-react"
import ClientOnly from "@/components/ClientOnly"
import { validateEventImageFile } from "@/lib/events/event-image-upload"
import { isPublicHttpUrl } from "@/lib/events/public-http-url"

export const DEFAULT_EVENT_POSTER_LABELS = {
  title: "Add a poster or banner",
  hint: "Drag and drop an image, or click below to choose a file. JPEG, PNG, or WebP · max 5 MB.",
  dropHint: "Drop an image here, or click to upload",
  ready: "Poster ready",
  remove: "Remove image",
  linkFallback: "Or use an image link instead",
} as const

export type EventPosterUploadLabels = {
  title: string
  hint: string
  dropHint: string
  ready: string
  remove: string
  linkFallback: string
}

export type EventPosterUploadProps = {
  imageUrl: string
  onImageUrlChange: (url: string) => void
  disabled?: boolean
  labels?: Partial<EventPosterUploadLabels>
  urlPlaceholder?: string
  /** Defaults to `event-poster-input` for tests */
  fileInputTestId?: string
  urlInputTestId?: string
  urlInputId?: string
  className?: string
}

export function EventPosterUpload({
  imageUrl,
  onImageUrlChange,
  disabled = false,
  labels: labelsProp,
  urlPlaceholder = "https://example.com/your-flyer.jpg",
  fileInputTestId = "event-poster-input",
  urlInputTestId = "event-image-url-fallback",
  urlInputId = "event-poster-url-fallback",
  className,
}: EventPosterUploadProps) {
  const labels: EventPosterUploadLabels = { ...DEFAULT_EVENT_POSTER_LABELS, ...labelsProp }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadInFlightRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setLocalPreviewUrl(null)
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      if (uploadInFlightRef.current || disabled) return
      setUploadError(null)
      const validation = validateEventImageFile(file)
      if (!validation.ok) {
        setUploadError(validation.error)
        return
      }

      revokeObjectUrl()
      const objectUrl = URL.createObjectURL(file)
      objectUrlRef.current = objectUrl
      setLocalPreviewUrl(objectUrl)

      uploadInFlightRef.current = true
      setIsUploading(true)
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/events/event-image", { method: "POST", body: fd })
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
        if (!res.ok) {
          throw new Error(data.error || "Upload failed")
        }
        if (!data.url) {
          throw new Error("Upload did not return a URL")
        }
        revokeObjectUrl()
        onImageUrlChange(data.url)
        setUploadError(null)
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed")
      } finally {
        uploadInFlightRef.current = false
        setIsUploading(false)
      }
    },
    [disabled, onImageUrlChange, revokeObjectUrl],
  )

  const busy = disabled || isUploading

  return (
    <div className={className ?? "rounded-lg border border-border bg-card p-4 shadow-sm"}>
      <Label className="text-base font-medium">{labels.title}</Label>
      <p className="mt-1 text-sm text-muted-foreground">{labels.hint}</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        data-testid={fileInputTestId}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (f) void handleFile(f)
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload poster or banner image"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            if (!busy) fileInputRef.current?.click()
          }
        }}
        onClick={() => {
          if (!busy) fileInputRef.current?.click()
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!busy) setDropActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDropActive(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDropActive(false)
          const f = e.dataTransfer.files?.[0]
          if (f && !busy) void handleFile(f)
        }}
        className={`mt-3 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          dropActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/30"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        {isUploading && localPreviewUrl ? (
          <div className="relative p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={localPreviewUrl}
              alt=""
              className="max-h-40 max-w-full rounded-md object-contain opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/50">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            </div>
          </div>
        ) : imageUrl.trim() && isPublicHttpUrl(imageUrl) && !localPreviewUrl ? (
          <div className="p-3 text-center">
            <ClientOnly>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl.trim()}
                alt=""
                className="mx-auto max-h-40 max-w-full rounded-md object-contain"
              />
            </ClientOnly>
            <p className="mt-2 text-xs text-muted-foreground">{labels.ready}</p>
          </div>
        ) : localPreviewUrl ? (
          <div className="p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={localPreviewUrl}
              alt=""
              className="mx-auto max-h-40 max-w-full rounded-md object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <Upload className="h-10 w-10 opacity-40" aria-hidden />
            <span>{labels.dropHint}</span>
          </div>
        )}
      </div>

      {uploadError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      ) : null}

      {(imageUrl.trim() || localPreviewUrl) && !isUploading ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-auto px-0 text-muted-foreground underline-offset-4 hover:underline"
          onClick={(e) => {
            e.stopPropagation()
            revokeObjectUrl()
            onImageUrlChange("")
            setUploadError(null)
          }}
        >
          {labels.remove}
        </Button>
      ) : null}

      <div className="mt-4 border-t border-border/70 pt-4">
        <Label htmlFor={urlInputId} className="text-sm font-medium text-muted-foreground">
          {labels.linkFallback}
        </Label>
        <Input
          id={urlInputId}
          type="url"
          data-testid={urlInputTestId}
          placeholder={urlPlaceholder}
          value={imageUrl}
          onChange={(e) => {
            onImageUrlChange(e.target.value)
            revokeObjectUrl()
            setUploadError(null)
          }}
          disabled={busy}
          className="mt-1.5"
        />
      </div>
    </div>
  )
}
