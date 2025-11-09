export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email.server'

export async function GET() {
  try {
    const info = await sendEmail({
      to: 'to@example.com',
      subject: '✅ Mailtrap SMTP Test',
      text: 'Your Mailtrap setup works perfectly!',
    })
    return NextResponse.json({ ok: true, messageId: info.messageId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
