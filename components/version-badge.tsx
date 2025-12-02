import packageJson from "@/package.json"
import ClientOnly from "@/components/ClientOnly"

export function VersionBadge() {
  const version = packageJson.version || "0.X.X"

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        v{version}
      </div>
      <ClientOnly placeholder={<div className="text-[10px] text-muted-foreground/60">—</div>}>
        <div className="text-[10px] text-muted-foreground/60">
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </ClientOnly>
    </div>
  )
}
