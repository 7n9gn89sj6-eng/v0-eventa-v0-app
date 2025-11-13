import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  // Read the actual code file to see what's deployed
  const fs = require("fs")
  const path = require("path")

  try {
    const submitRoutePath = path.join(process.cwd(), "app/api/events/submit/route.ts")
    const confirmPagePath = path.join(process.cwd(), "app/event/confirm/page.tsx")

    const submitCode = fs.readFileSync(submitRoutePath, "utf-8")
    const confirmCode = fs.readFileSync(confirmPagePath, "utf-8")

    // Check for key indicators
    const hasBcryptImport = submitCode.includes('import bcrypt from "bcryptjs"')
    const hasBcryptHash = submitCode.includes("bcrypt.hash(token")
    const hasGranularDiagnostics = confirmCode.includes("Step 1: Parse searchParams")
    const hasDiagnosticMode = confirmCode.includes("diagnosticMode")

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || "unknown",
      region: process.env.VERCEL_REGION || "unknown",
      nodeVersion: process.version,
      checks: {
        submitRoute_hasBcryptImport: hasBcryptImport,
        submitRoute_hasBcryptHash: hasBcryptHash,
        confirmPage_hasGranularDiagnostics: hasGranularDiagnostics,
        confirmPage_hasDiagnosticMode: hasDiagnosticMode,
      },
      summary:
        hasBcryptImport && hasBcryptHash && hasGranularDiagnostics && hasDiagnosticMode
          ? "✅ LATEST CODE IS DEPLOYED"
          : "❌ OLD CODE IS DEPLOYED",
      submitRoutePreview: submitCode.substring(0, 500),
      confirmPagePreview: confirmCode.substring(0, 500),
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      message: "Could not read source files",
    })
  }
}
