const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.mailtrap.io',
  port: 587,
  auth: {
    user: 'your_mailtrap_username',  // Replace with your Mailtrap username
    pass: 'your_mailtrap_password'   // Replace with your Mailtrap password
  }
});

const mailOptions = {
  from: 'your-email@example.com',
  to: 'recipient@example.com',  // Any email that should receive the test
  subject: 'Test Email',
  text: 'This is a test email to Mailtrap'
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.log('Error sending email:', error);
  }
  console.log('Email sent:', info.response);
});

