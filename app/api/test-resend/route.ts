import { Resend } from "resend";

export async function GET() {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const data = await resend.emails.send({
      from: "Ithaki Group Tour <no-reply@ithakigrouptour.com>",
      to: "pana2112nostatos@gmail.com",
      subject: "Gmail Delivery Test — ithakigrouptour.com",
      html: "<p>This is a test email from the verified root domain.</p>",
    });

    return Response.json({ success: true, data });
  } catch (error: any) {
    console.error(error);
    return Response.json({ success: false, error: error.message });
  }
}
