const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

router.post("/send-email", async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to) {
      return res.status(400).json({ message: "Recipient email missing" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // APP PASSWORD (NOT normal password)
      },
    });

    const info = await transporter.sendMail({
      from: `"Adhyaa Pickles" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("📧 Mail accepted:", info.accepted);
    console.log("📨 Mail response:", info.response);

    if (!info.accepted || info.accepted.length === 0) {
      return res.status(500).json({ message: "Email rejected by SMTP" });
    }

    res.status(200).json({ message: "Email sent successfully" });

  } catch (error) {
    console.error("❌ Email send failed:", error);
    res.status(500).json({ message: "Email failed", error: error.message });
  }
});

module.exports = router;
