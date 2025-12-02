export function VersionDisplay() {
  const buildTime = new Date().toISOString()
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || "local"

  return (
    <div className="fixed bottom-2 right-2 bg-black/80 text-white text-xs px-3 py-1.5 rounded-md font-mono z-50">
      <div className="flex items-center gap-2">
        <span className="text-green-400">●</span>
        <span>v{version}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-400">{new Date(buildTime).toLocaleString()}</span>
      </div>
    </div>
  )
}
