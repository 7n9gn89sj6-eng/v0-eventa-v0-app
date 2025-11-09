export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email.server'

export async function GET() {
  try {
    const info = await sendEmail({
      to: 'to@example.com',
      subject: '🔍 Diagnostics email',
      text: 'Diagnostics route reached and sent successfully.',
    })
    return NextResponse.json({ ok: true, messageId: info.messageId })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
