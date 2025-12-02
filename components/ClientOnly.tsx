"use client"
import { useEffect, useState } from "react"
import type React from "react"

export default function ClientOnly({
  children,
  placeholder = null,
}: {
  children: React.ReactNode
  placeholder?: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <>{children}</> : <>{placeholder}</>
}
