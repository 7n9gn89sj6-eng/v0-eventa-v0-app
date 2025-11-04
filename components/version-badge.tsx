import packageJson from "@/package.json"

export function VersionBadge() {
  const version = packageJson.version || "0.X.X"

  return (
    <div className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
      v{version}
    </div>
  )
}
