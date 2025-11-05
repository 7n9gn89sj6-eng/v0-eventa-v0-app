import packageJson from "@/package.json"

export function VersionBadge() {
  const version = packageJson.version || "0.X.X"
  const buildDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        v{version}
      </div>
      <div className="text-[10px] text-muted-foreground/60">{buildDate}</div>
    </div>
  )
}
