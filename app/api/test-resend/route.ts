const data = await resend.emails.send({
  from: "Ithaki Group Tour <no-reply@ithakigrouptour.com>",
  to: "pana2112nostatos@gmail.com",
  subject: "Resend Test to Gmail",
  html: "<p>Testing email delivery to Gmail! 🚀</p>",
});

