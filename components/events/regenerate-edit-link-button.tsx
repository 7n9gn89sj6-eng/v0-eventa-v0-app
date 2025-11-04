"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RefreshCw, Copy, Check, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface RegenerateEditLinkButtonProps {
  eventId: string
}

export function RegenerateEditLinkButton({ eventId }: RegenerateEditLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editUrl, setEditUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleRegenerate = async (sendEmail = false) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/events/${eventId}/regenerate-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      })

      if (!response.ok) {
        throw new Error("Failed to regenerate edit link")
      }

      const data = await response.json()
      setEditUrl(data.editUrl)

      toast({
        title: "Edit link regenerated",
        description: "A new secure edit link has been created.",
      })

      if (data.emailSent) {
        toast({
          title: "Email sent",
          description: "The edit link has been emailed to the event creator.",
        })
      }
    } catch (error) {
      console.error("[v0] Error regenerating edit link:", error)
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!editUrl) return

    try {
      await navigator.clipboard.writeText(editUrl)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Edit link copied to clipboard.",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("[v0] Failed to copy:", error)
      toast({
        title: "Error",
        description: "Failed to copy link. Please copy manually.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setIsOpen(true)
          setEditUrl(null)
          setCopied(false)
        }}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Regenerate Edit Link
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Edit Link</DialogTitle>
            <DialogDescription>
              Create a new secure edit link for this event. Old links will remain valid.
            </DialogDescription>
          </DialogHeader>

          {editUrl ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3">
                <p className="break-all text-sm font-mono">{editUrl}</p>
              </div>
              <Button onClick={handleCopy} className="w-full">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose whether to generate a new link only or also email it to the event creator.
              </p>
            </div>
          )}

          <DialogFooter>
            {!editUrl && (
              <>
                <Button variant="outline" onClick={() => handleRegenerate(false)} disabled={isLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate Only
                </Button>
                <Button onClick={() => handleRegenerate(true)} disabled={isLoading}>
                  <Mail className="mr-2 h-4 w-4" />
                  Generate & Email
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
