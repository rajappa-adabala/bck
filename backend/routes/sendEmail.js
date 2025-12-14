// routes/sendEmail.js
require("dotenv").config();
const express = require("express");
const { Resend } = require("resend");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/send-email", async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to) return res.status(400).json({ message: "Recipient email missing" });

    const response = await resend.emails.send({
      from: "no-reply@adhyaapickles.in", // verified sender in Resend
      to,
      subject,
      html,
    });

    console.log("📧 Email sent via Resend:", response);

    res.status(200).json({ message: "Email sent successfully", response });

  } catch (err) {
    console.error("❌ Resend email error:", err);
    res.status(500).json({ message: "Email sending failed", error: err.message });
  }
});

module.exports = router;
