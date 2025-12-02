import { NextResponse } from "next/server"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token") || ""

  if (!token) {
    return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 })
  }

  try {
    const allTokens = await prisma.eventEditToken.findMany({
      include: {
        event: {
          select: {
            id: true,
            status: true,
            title: true,
          },
        },
      },
    })

    let matchedToken: any = null
    for (const tokenRecord of allTokens) {
      const isMatch = await bcrypt.compare(token, tokenRecord.tokenHash)
      if (isMatch) {
        matchedToken = tokenRecord
        break
      }
    }

    if (!matchedToken) {
      return NextResponse.json({ ok: false, error: "token not found" }, { status: 404 })
    }

    const now = new Date()
    if (new Date(matchedToken.expires) <= now) {
      return NextResponse.json({ ok: false, error: "token expired" }, { status: 410 })
    }

    return NextResponse.json({
      ok: true,
      note: "Token lookup succeeded (no writes performed)",
      event: {
        id: matchedToken.event.id,
        title: matchedToken.event.title,
        status: matchedToken.event.status,
      },
      tokenExpires: matchedToken.expires,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
