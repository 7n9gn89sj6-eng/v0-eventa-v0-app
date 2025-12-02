"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface FavoriteButtonProps {
  eventId: string
  initialIsFavorited?: boolean
}

export function FavoriteButton({ eventId, initialIsFavorited = false }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const toggleFavorite = async () => {
    setIsLoading(true)
    try {
      if (isFavorited) {
        const response = await fetch(`/api/favorites?eventId=${eventId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error("Failed to remove favorite")
        }

        setIsFavorited(false)
        toast.success("Removed from favorites")
      } else {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        })

        if (!response.ok) {
          const data = await response.json()
          if (data.error === "Unauthorized") {
            toast.error("Please sign in to save favorites")
            return
          }
          throw new Error("Failed to add favorite")
        }

        setIsFavorited(true)
        toast.success("Added to favorites")
      }
      router.refresh()
    } catch (error) {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={isFavorited ? "default" : "outline"}
      size="icon"
      onClick={toggleFavorite}
      disabled={isLoading}
      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`} />
    </Button>
  )
}
